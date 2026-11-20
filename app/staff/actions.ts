"use server";
import { AssessmentType, AttendanceStatus, LessonType, Prisma, RequestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { forbidden, redirect } from "next/navigation";
import { account, staffGroups, staffStudents } from "@/lib/access";
import { db } from "@/lib/db";
import { attendanceStatuses, campusDay, dateLabel, services, statuses, timeLabel } from "@/lib/model";
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
  const query = new URLSearchParams({ section });
  if (section === "schedule") query.set("date", field(form, "startsAt", 16).slice(0, 10));
  if (section === "grades" && form.get("register") === "1") {
    query.set("subject", field(form, "title", 120));
    query.set("term", field(form, "term", 2));
    query.set("student", field(form, "student", 100));
    const group = field(form, "group", 100);
    if (group) query.set("group", group);
  }
  const returnTo = "/staff?" + query;
  try {
    await db.$transaction((tx) => operation(tx, staff.id, form));
  } catch (error) {
    if (error instanceof InputError) redirect(returnTo + "&error=" + encodeURIComponent(error.message));
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      redirect(returnTo + "&error=" + encodeURIComponent("Данные изменились. Проверьте и повторите."));
    }
    throw error;
  }
  revalidatePath("/cabinet", "layout");
  revalidatePath("/staff");
  redirect(returnTo + "&saved=1");
}

export async function processRequest(form: FormData) {
  await mutate("requests", form, async (tx, staffId, input) => {
    const scope = staffStudents(staffId);
    const id = field(input, "id", 100);
    const request = await tx.serviceRequest.findFirst({
      where: { id, user: scope },
      select: {
        id: true, userId: true, type: true, revision: true, status: true, number: true, comment: true, readyBy: true,
        user: { select: { studentProfile: { select: { groupId: true } } } },
      },
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
    const unchanged = status === request.status && comment === (request.comment ?? "") &&
      (readyBy?.getTime() ?? null) === (request.readyBy?.getTime() ?? null);
    if (unchanged) return;
    const changed = await tx.serviceRequest.updateMany({
      where: { id, user: scope, revision: Number(field(input, "revision", 10)) },
      data: { status, comment, readyBy, revision: { increment: 1 } },
    });
    requireInput(changed.count, "Заявка уже изменилась. Проверьте актуальные данные.");
    const label = request.number ?? request.id;
    await tx.notification.create({ data: {
      userId: request.userId, title: services[request.type] + " · " + statuses[status],
      body: [comment, readyBy ? "Срок готовности — " + dateLabel(readyBy) : ""].filter(Boolean).join("\n") || "Заявка обновлена.",
    } });
    await tx.auditEntry.create({ data: { actorId: staffId, groupId: request.user.studentProfile?.groupId, summary: "Заявка " + label + " · " + statuses[request.status] + " → " + statuses[status] } });
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
    const typeText = field(input, "type", 15);
    requireInput(!typeText || Object.values(LessonType).includes(typeText as LessonType), "Проверьте тип занятия.");
    const campus = field(input, "campus", 120) || null;
    let groupId = field(input, "group", 100);
    let title = field(input, "title", 120);
    const rawComment = input.get("comment");
    requireInput(rawComment === null || (typeof rawComment === "string" && rawComment.trim().length <= 1000), "Комментарий должен содержать до 1000 символов.");
    const comment = typeof rawComment === "string" ? rawComment.trim() || null : undefined;
    let oldTime = "";
    let moved = false;
    if (id) {
      const lesson = await tx.groupLesson.findFirst({ where: { id, group: staffGroups(staffId) } });
      if (!lesson) forbidden();
      ({ groupId } = lesson);
      title = title || lesson.title;
      const type = (typeText as LessonType) || lesson.type;
      const teacher = field(input, "teacher", 100) || lesson.teacher;
      const room = field(input, "room", 30) || lesson.room;
      moved = +lesson.startsAt !== +startsAt || +lesson.endsAt !== +endsAt;
      oldTime = dateLabel(lesson.startsAt) + ", " + timeLabel(lesson.startsAt);
      const changed = await tx.groupLesson.updateMany({
        where: { id, group: staffGroups(staffId), startsAt: lesson.startsAt, endsAt: lesson.endsAt },
        data: { startsAt, endsAt, title, type, teacher, room, campus, comment },
      });
      requireInput(changed.count, "Занятие уже изменилось.");
    } else {
      const group = await tx.studyGroup.findFirst({ where: { id: groupId, ...staffGroups(staffId) } });
      if (!group) forbidden();
      const teacher = field(input, "teacher", 100);
      const room = field(input, "room", 30);
      requireInput(title && teacher && room && typeText, "Заполните данные занятия.");
      await tx.groupLesson.create({ data: { groupId, title, teacher, room, type: typeText as LessonType, campus, comment, startsAt, endsAt } });
    }
    const students = await tx.user.findMany({ where: staffStudents(staffId, groupId), select: { id: true } });
    const newTime = dateLabel(startsAt) + ", " + timeLabel(startsAt) + "–" + timeLabel(endsAt);
    if (students.length) await tx.notification.createMany({ data: students.map((student) => ({
      userId: student.id, title: (moved ? "Перенос занятия · " : id ? "Изменение занятия · " : "Новое занятие · ") + title,
      body: (moved ? oldTime + " → " + newTime : newTime) + (comment ? "\n" + comment : ""),
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
    const assessmentText = field(input, "assessment", 15);
    const assessment = Object.values(AssessmentType).includes(assessmentText as AssessmentType) ? assessmentText as AssessmentType : null;
    const finalText = field(input, "finalGrade", 1);
    const finalGrade = /^[2-5]$/.test(finalText) ? Number(finalText) : null;
    const passedText = field(input, "passed", 5);
    const passed = passedText === "true" ? true : passedText === "false" ? false : null;
    requireInput(title && /^\d+$/.test(scoreText) && score <= 100 &&
      Number.isInteger(threshold) && threshold >= 1 && threshold <= 100 &&
      Number.isInteger(term) && term > 0 && term <= 20, "Проверьте дисциплину, семестр и баллы.");
    requireInput(!finalText || finalGrade !== null, "Итоговая оценка — от 2 до 5.");
    requireInput(assessment !== "TEST" || passedText === "" || passed !== null, "Укажите, зачтена ли дисциплина.");
    const key = { userId: student.id, title, term };
    const previous = await tx.grade.findUnique({ where: { userId_title_term: key } });
    if (previous) {
      const changed = await tx.grade.updateMany({
        where: { id: previous.id, score: previous.score, threshold: previous.threshold, user: staffStudents(staffId) },
        data: { score, threshold, assessment, finalGrade, passed },
      });
      requireInput(changed.count, "Оценка уже изменилась. Проверьте актуальные баллы.");
    } else {
      await tx.grade.create({ data: { ...key, score, threshold, assessment, finalGrade, passed } });
    }
    await tx.auditEntry.create({ data: {
      actorId: staffId, groupId: student.studentProfile?.groupId,
      summary: student.name + " · " + title + " · семестр " + term + " · " + (previous ? previous.score + "/" + previous.threshold + " → " : "") + score + "/" + threshold,
    } });
  });
}

export async function saveAttendance(form: FormData) {
  await mutate("attendance", form, async (tx, staffId, input) => {
    const statusText = field(input, "status", 10);
    requireInput(!statusText || Object.values(AttendanceStatus).includes(statusText as AttendanceStatus), "Проверьте статус посещения.");
    const lesson = await tx.lesson.findFirst({
      where: { id: field(input, "lesson", 100), user: staffStudents(staffId) },
      select: { id: true, userId: true, title: true, startsAt: true, user: { select: { name: true, studentProfile: { select: { groupId: true } } } } },
    });
    if (!lesson) forbidden();
    if (!statusText) return;
    const status = statusText as AttendanceStatus;
    await tx.attendance.upsert({
      where: { lessonId_userId: { lessonId: lesson.id, userId: lesson.userId } },
      update: { status },
      create: { lessonId: lesson.id, userId: lesson.userId, status },
    });
    await tx.auditEntry.create({ data: {
      actorId: staffId, groupId: lesson.user.studentProfile?.groupId,
      summary: "Посещение · " + lesson.user.name + " · " + lesson.title + " · " + dateLabel(lesson.startsAt) + " · " + attendanceStatuses[status].label,
    } });
  });
}

export async function createDeadline(form: FormData) {
  await mutate("deadlines", form, async (tx, staffId, input) => {
    const groupId = field(input, "group", 100);
    const title = field(input, "title", 120);
    const course = field(input, "course", 120);
    const date = field(input, "dueAt", 10);
    const dueAt = new Date(date + "T23:59:59+03:00");
    requireInput(title && course && /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(+dueAt) && campusDay(dueAt) === date, "Заполните дисциплину, работу и срок.");
    const group = await tx.studyGroup.findFirst({ where: { id: groupId, ...staffGroups(staffId) }, select: { id: true, name: true } });
    if (!group) forbidden();
    const students = await tx.user.findMany({ where: staffStudents(staffId, group.id), select: { id: true } });
    requireInput(students.length, "В группе нет студентов.");
    await tx.deadline.createMany({ data: students.map(({ id }) => ({ userId: id, title, course, dueAt })) });
    await tx.notification.createMany({ data: students.map(({ id }) => ({ userId: id, title: "Новый дедлайн · " + title, body: course + " · до " + dateLabel(dueAt) })) });
    await tx.auditEntry.create({ data: { actorId: staffId, groupId: group.id, summary: "Дедлайн · " + group.name + " · " + title + " · " + dateLabel(dueAt) } });
  });
}
