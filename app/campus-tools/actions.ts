"use server";
import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { forbidden, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { account, staffGroups, staffStudents } from "@/lib/access";
import { db } from "@/lib/db";
import { availableSlots, categories, portfolioKinds, publicUrl, serializable, slotLabels } from "@/lib/campus-tools";
import { dateLabel, timeLabel } from "@/lib/model";

function field(data: FormData, key: string, max = 120) {
  const value = data.get(key);
  return typeof value === "string" && value.trim().length <= max ? value.trim() : "";
}
class Invalid extends Error {}
function requireInput(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Invalid(message);
}

type Student = Awaited<ReturnType<typeof account>>;
type Operation = (tx: Prisma.TransactionClient, user: Student, data: FormData) => Promise<void>;
async function submit(section: string, data: FormData, operation: Operation, staff = false) {
  const user = await account(staff ? "STAFF" : "STUDENT");
  const root = staff ? "/staff/campus" : "/campus-tools";
  const target = root + "?tab=" + section;
  try {
    await serializable((tx) => operation(tx, user, data));
  } catch (error) {
    if (error instanceof Invalid) redirect(target + "&error=" + encodeURIComponent(error.message));
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      redirect(target + "&error=" + encodeURIComponent("Данные изменились. Обновите страницу и попробуйте ещё раз."));
    }
    throw error;
  }
  revalidatePath("/cabinet", "layout");
  revalidatePath("/campus-tools");
  revalidatePath("/staff/campus");
  redirect(target + "&saved=1");
}

export async function booking(data: FormData) {
  await submit("booking", data, async (tx, user, form) => {
    const slotId = field(form, "id");
    const key = { slotId, userId: user.id };
    if (form.get("command") === "cancel") {
      const cancelled = await tx.campusBooking.deleteMany({ where: { ...key, slot: { startsAt: { gt: new Date() } } } });
      requireInput(cancelled.count, "Отменить можно только предстоящую запись.");
      return;
    }
    requireInput(slotId, "Выберите слот.");
    const [slot] = await availableSlots(tx, user, slotId);
    requireInput(slot, "Этот слот недоступен.");
    if (slot.bookings.length) return;
    requireInput(slot._count.bookings < slot.capacity, "Свободных мест больше нет.");
    const scheduleWindow = { startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt } };
    const [personalLesson, groupLesson] = await Promise.all([
      tx.lesson.findFirst({ where: { userId: user.id, ...scheduleWindow }, select: { id: true } }),
      user.groupId ? tx.groupLesson.findFirst({ where: { groupId: user.groupId, ...scheduleWindow }, select: { id: true } }) : null,
    ]);
    requireInput(!personalLesson && !groupLesson, "В это время у вас занятие.");
    const overlaps = await tx.campusBooking.findFirst({ where: { userId: user.id, slot: { startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt } } } });
    requireInput(!overlaps, "У вас уже есть запись на это время.");
    await tx.campusBooking.create({ data: key });
    const when = dateLabel(slot.startsAt) + ", " + timeLabel(slot.startsAt);
    await tx.notification.create({ data: { userId: user.id, title: "Подтверждена запись · " + slot.title, body: when + " МСК · " + slot.place } });
  });
}

export async function createSlot(data: FormData) {
  await submit("slots", data, async (tx, user, form) => {
    const kind = field(form, "kind");
    const title = field(form, "title");
    const place = field(form, "place");
    const start = field(form, "start", 16);
    const end = field(form, "end", 16);
    const startsAt = new Date(start + ":00+03:00");
    const endsAt = new Date(end + ":00+03:00");
    const capacity = Number(field(form, "capacity", 3));
    const groupId = field(form, "group") || null;
    const retakeTerm = kind === "RETAKE" ? Number(field(form, "term", 2)) : null;
    requireInput(kind === "CONSULTATION" || kind === "RETAKE" || kind === "ROOM" || kind === "COWORKING" || kind === "EQUIPMENT" || kind === "SPORT", "Выберите тип записи.");
    requireInput(title && place && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(end)
      && +startsAt > Date.now() && +endsAt > +startsAt && Number.isInteger(capacity) && capacity >= 1 && capacity <= 100, "Проверьте название, время и вместимость.");
    requireInput(groupId, "Выберите группу.");
    requireInput(kind !== "RETAKE" || (retakeTerm && Number.isInteger(retakeTerm) && retakeTerm >= 1 && retakeTerm <= 20), "Для пересдачи выберите группу и семестр.");
    if (groupId && !await tx.studyGroup.findFirst({ where: { id: groupId, ...staffGroups(user.id) } })) forbidden();
    const conflict = await tx.campusSlot.findFirst({ where: { place, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
    requireInput(!conflict, "Место уже занято в этот интервал.");
    await tx.campusSlot.create({ data: { kind, title, place, startsAt, endsAt, capacity, staffId: user.id, groupId, retakeTerm } });
  }, true);
}

export async function confirmSport(data: FormData) {
  await submit("slots", data, async (tx, user, form) => {
    const updated = await tx.campusBooking.updateMany({ where: {
      slotId: field(form, "id"), userId: field(form, "student"),
      slot: { staffId: user.id, kind: "SPORT", startsAt: { lte: new Date() } },
      user: staffStudents(user.id),
    }, data: { attended: true } });
    if (!updated.count) forbidden();
  }, true);
}

export async function library(data: FormData) {
  await submit("library", data, async (tx, user, form) => {
    const bookId = field(form, "id");
    const book = await tx.campusBook.findUnique({ where: { id: bookId } });
    requireInput(book, "Книга не найдена.");
    const key = { bookId, userId: user.id };
    const command = form.get("command");
    if (command === "unhold") {
      await tx.campusHold.deleteMany({ where: key });
    } else if (command === "hold") {
      requireInput(!await tx.campusLoan.findUnique({ where: { bookId_userId: key } }), "Эта книга уже у вас.");
      await tx.campusHold.upsert({ where: { bookId_userId: key }, create: key, update: {} });
    } else if (command === "renew") {
      const loan = await tx.campusLoan.findUnique({ where: { bookId_userId: key } });
      requireInput(loan && !loan.renewed && +loan.dueAt > Date.now(), "Продление недоступно.");
      requireInput(!await tx.campusHold.findFirst({ where: { bookId, userId: { not: user.id } } }), "Другой студент ожидает книгу.");
      const dueAt = new Date(+loan.dueAt + 7 * 86400000);
      await tx.campusLoan.update({ where: { bookId_userId: key }, data: { renewed: true, dueAt } });
      await tx.notification.create({ data: { userId: user.id, title: "Книга продлена · " + book.title, body: "Новый срок возврата — " + dateLabel(dueAt) } });
    }
  });
}

export async function board(data: FormData) {
  await submit("board", data, async (tx, user, form) => {
    const id = field(form, "id");
    const command = form.get("command");
    if (command === "create") {
      const title = field(form, "title");
      const body = field(form, "body", 1000);
      const category = categories.find((value) => value === form.get("category"));
      const contactPhone = field(form, "contactPhone", 40) || null;
      const contactEmail = field(form, "contactEmail", 120) || null;
      requireInput(title && body && category, "Заполните объявление.");
      if (contactPhone) {
        requireInput(/^[\d\s+\-()]+$/.test(contactPhone) && contactPhone.replace(/\D/g, "").length >= 5,
          "Проверьте телефон: минимум 5 цифр, допустимы цифры, пробелы и символы + - ( ).");
      }
      if (contactEmail) requireInput(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail), "Проверьте email для связи.");
      await tx.campusPost.create({ data: { userId: user.id, title, body, category, contactPhone, contactEmail, expiresAt: new Date(Date.now() + 14 * 86400000) } });
    } else if (command === "close") {
      await tx.campusPost.updateMany({ where: { id, userId: user.id }, data: { closed: true } });
    } else {
      const post = await tx.campusPost.findFirst({ where: { id, closed: false, expiresAt: { gt: new Date() }, userId: { not: user.id } } });
      requireInput(post, "Объявление закрыто или срок истёк.");
      if (command === "report") await tx.campusPost.update({ where: { id }, data: { flagged: true } });
      if (command === "reply") {
        const body = field(form, "body", 500);
        requireInput(body, "Напишите отклик.");
        await tx.campusReply.upsert({ where: { postId_userId: { postId: id, userId: user.id } },
          create: { postId: id, userId: user.id, body }, update: { body } });
      }
    }
  });
}

export async function moderatePost(data: FormData) {
  await submit("board", data, async (tx, user, form) => {
    await tx.campusPost.updateMany({ where: { id: field(form, "id"), flagged: true, user: staffStudents(user.id) },
      data: { flagged: false, ...(form.get("command") === "close" ? { closed: true } : {}) } });
  }, true);
}

export async function portfolio(data: FormData) {
  await submit("portfolio", data, async (tx, user, form) => {
    const id = field(form, "id");
    const command = form.get("command");
    if (command === "remove") {
      await tx.campusPortfolio.deleteMany({ where: { id, userId: user.id } });
    } else if (command === "share" || command === "hide") {
      await tx.campusPortfolio.updateMany({ where: { id, userId: user.id }, data: { shared: command === "share" } });
    } else {
      const title = field(form, "title");
      const description = field(form, "body", 1000);
      const date = field(form, "date", 10);
      const occurredAt = new Date(date + "T12:00:00+03:00");
      const kind = portfolioKinds.find((item) => item === form.get("kind"));
      const rawLink = field(form, "link", 500);
      const link = rawLink ? publicUrl(rawLink) : null;
      requireInput(title && description && kind && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(+occurredAt)
        && (!rawLink || link), "Заполните карточку и проверьте ссылку.");
      await tx.campusPortfolio.create({ data: { userId: user.id, title, description, occurredAt, kind, link } });
    }
  });
}

export async function issuePass() {
  const user = await account("STUDENT");
  const token = randomBytes(24).toString("hex");
  const data = { digest: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 120000) };
  await db.campusPass.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  redirect("/campus-tools?tab=profile&pass=" + token);
}
