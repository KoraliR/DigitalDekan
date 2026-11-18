"use server";
import { Prisma, RequestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { forbidden, redirect } from "next/navigation";
import { account, staffGroups, staffStudents } from "@/lib/access";
import { db } from "@/lib/db";
import { campusDay, dateLabel, services, statuses, timeLabel } from "@/lib/model";
import { transitions } from "@/lib/workflow";

function field(form: FormData, key: string, max: number) {
  const value = form.get(key);
  return typeof value === "string" && value.trim().length <= max ? value.trim() : "";
}

class InputError extends Error {}

function requireInput(condition: unknown, message: string): asserts condition {
  if (!condition) throw new InputError(message);
}

type Operation = (tx: Prisma.TransactionClient, staffId: string, form: FormData) => Promise<void>;
async function mutate(section: string, form: FormData, operation: Operation) {
  const staff = await account("STAFF");
  try {
    await db.$transaction((tx) => operation(tx, staff.id, form));
  } catch (error) {
    if (error instanceof InputError) redirect("/staff?section=" + section + "&error=" + encodeURIComponent(error.message));
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      redirect("/staff?section=" + section + "&error=" + encodeURIComponent("Данные изменились. Проверьте и повторите."));
    }
    throw error;
  }
  revalidatePath("/cabinet", "layout");
  revalidatePath("/staff");
  redirect("/staff?section=" + section + "&saved=1");
}

export async function processRequest(form: FormData) {
  await mutate("requests", form, async (tx, staffId, input) => {
    const scope = staffStudents(staffId);
    const id = field(input, "id", 100);
    const request = await tx.serviceRequest.findFirst({
      where: { id, user: scope },
      select: { id: true, userId: true, type: true, revision: true, status: true, user: { select: { studentProfile: { select: { groupId: true } } } } },
    });
    if (!request) forbidden();
    const status = field(input, "status", 20) as RequestStatus;
    const comment = field(input, "comment", 1000);
    const deadline = field(input, "readyBy", 10);
    const readyBy = deadline ? new Date(deadline + "T23:59:59+03:00") : null;
    requireInput(Object.values(RequestStatus).includes(status) &&
      (status === request.status || transitions[request.status].includes(status)), "Недопустимый переход статуса.");
    requireInput(!readyBy || (!isNaN(+readyBy) && campusDay(readyBy) === deadline), "Проверьте срок готовности.");
    requireInput(status !== "REJECTED" || comment, "Укажите причину отклонения.");
    const changed = await tx.serviceRequest.updateMany({
      where: { id, user: scope, revision: Number(field(input, "revision", 10)) },
      data: { status, comment, readyBy, revision: { increment: 1 } },
    });
    requireInput(changed.count, "Заявка уже изменилась. Проверьте актуальные данные.");
    await tx.notification.create({ data: {
      userId: request.userId, title: services[request.type] + " · " + statuses[status],
      body: [comment, readyBy ? "Срок готовности — " + dateLabel(readyBy) : ""].filter(Boolean).join("\n") || "Заявка обновлена.",
    } });
    await tx.auditEntry.create({ data: { actorId: staffId, groupId: request.user.studentProfile?.groupId, summary: "Заявка " + id + " · " + statuses[request.status] + " → " + statuses[status] } });
  });
}

export async function publish(form: FormData) {
  await mutate("news", form, async (tx, staffId, input) => {
    const selected = field(input, "audience", 200);
    const index = selected.indexOf(":");
    const kind = index < 0 ? selected : selected.slice(0, index);
    const value = index < 0 ? "" : selected.slice(index + 1);
    const title = field(input, "title", 120);
    const body = field(input, "body", 2000);
    requireInput(title && body && ["all", "faculty", "course", "group"].includes(kind), "Заполните заголовок, текст и аудиторию.");
    const groups = await tx.studyGroup.findMany({ where: {
      ...staffGroups(staffId),
      ...(kind === "faculty" ? { faculty: value } : {}),
      ...(kind === "course" ? { course: Number(value) } : {}),
      ...(kind === "group" ? { id: value } : {}),
    }, select: { id: true } });
    const recipients = await tx.user.findMany({ where: staffStudents(staffId, { in: groups.map((group) => group.id) }), select: { id: true } });
    requireInput(recipients.length, "В этой аудитории нет доступных студентов.");
    const prefix = field(input, "kind", 15) === "reminder" ? "Напоминание · " : "";
    await tx.notification.createMany({ data: recipients.map(({ id }) => ({ userId: id, title: prefix + title, body })) });
  });
}

export async function saveLesson(form: FormData) {
  await mutate("schedule", form, async (tx, staffId, input) => {
    const id = field(input, "id", 100);
    const starts = field(input, "startsAt", 16);
    const ends = field(input, "endsAt", 16);
    const startsAt = new Date(starts + ":00+03:00");
    const endsAt = new Date(ends + ":00+03:00");
    requireInput(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(starts) &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(ends) && +endsAt > +startsAt &&
      campusDay(startsAt) === starts.slice(0, 10) && campusDay(endsAt) === ends.slice(0, 10), "Проверьте время занятия.");
    let groupId = field(input, "group", 100);
    let title = field(input, "title", 120);
    let oldTime = "";
    if (id) {
      const lesson = await tx.groupLesson.findFirst({ where: { id, group: staffGroups(staffId) } });
      if (!lesson) forbidden();
      ({ groupId, title } = lesson);
      oldTime = dateLabel(lesson.startsAt) + ", " + timeLabel(lesson.startsAt);
      const changed = await tx.groupLesson.updateMany({ where: { id, group: staffGroups(staffId), startsAt: lesson.startsAt, endsAt: lesson.endsAt }, data: { startsAt, endsAt } });
      requireInput(changed.count, "Занятие уже изменилось.");
    } else {
      const group = await tx.studyGroup.findFirst({ where: { id: groupId, ...staffGroups(staffId) } });
      if (!group) forbidden();
      const teacher = field(input, "teacher", 100);
      const room = field(input, "room", 30);
      const type = field(input, "type", 15);
      requireInput(title && teacher && room && (type === "LECTURE" || type === "PRACTICE"), "Заполните данные занятия.");
      await tx.groupLesson.create({ data: { groupId, title, teacher, room, type, startsAt, endsAt } });
    }
    const students = await tx.user.findMany({ where: staffStudents(staffId, groupId), select: { id: true } });
    const newTime = dateLabel(startsAt) + ", " + timeLabel(startsAt) + "–" + timeLabel(endsAt);
    if (students.length) await tx.notification.createMany({ data: students.map((student) => ({
      userId: student.id, title: (id ? "Перенос занятия · " : "Новое занятие · ") + title,
      body: oldTime ? oldTime + " → " + newTime : newTime,
    })) });
  });
}

export async function saveGrade(form: FormData) {
  await mutate("grades", form, async (tx, staffId, input) => {
    const student = await tx.user.findFirst({
      where: { id: field(input, "student", 100), ...staffStudents(staffId) },
      select: { id: true, name: true, studentProfile: { select: { groupId: true } } },
    });
    if (!student) forbidden();
    const title = field(input, "title", 120);
    const scoreText = field(input, "score", 3);
    const score = Number(scoreText);
    const threshold = Number(field(input, "threshold", 3));
    const term = Number(field(input, "term", 2));
    requireInput(title && /^\d+$/.test(scoreText) && score <= 100 &&
      Number.isInteger(threshold) && threshold >= 1 && threshold <= 100 &&
      Number.isInteger(term) && term > 0 && term <= 20, "Проверьте дисциплину, семестр и баллы.");
    const key = { userId: student.id, title, term };
    const previous = await tx.grade.findUnique({ where: { userId_title_term: key } });
    if (previous) {
      const changed = await tx.grade.updateMany({
        where: { id: previous.id, score: previous.score, threshold: previous.threshold, user: staffStudents(staffId) },
        data: { score, threshold },
      });
      requireInput(changed.count, "Оценка уже изменилась. Проверьте актуальные баллы.");
    } else {
      await tx.grade.create({ data: { ...key, score, threshold } });
    }
    await tx.auditEntry.create({ data: {
      actorId: staffId, groupId: student.studentProfile?.groupId,
      summary: student.name + " · " + title + " · семестр " + term + " · " + (previous ? previous.score + "/" + previous.threshold + " → " : "") + score + "/" + threshold,
    } });
  });
}