"use server";
import { randomBytes } from "node:crypto";
import { AttendanceStatus } from "@prisma/client";
import { forbidden, redirect } from "next/navigation";
import { account, staffGroups } from "@/lib/access";
import { markAttendanceByToken } from "@/lib/attendance-qr";
import { db } from "@/lib/db";
import { campusDay } from "@/lib/model";

export async function groupAttendance(form: FormData) {
  const actor = await account();
  const lessonId = String(form.get("lesson") ?? "");
  const staff = actor.role === "STAFF";
  const lesson = await db.groupLesson.findFirst({ where: {
    id: lessonId, group: staff ? staffGroups(actor.id) : { students: { some: { userId: actor.id, isMonitor: true } } },
  }, include: { group: { include: { students: { where: { user: { role: "STUDENT" } }, include: { user: { select: { name: true } } } } } } } });
  if (!lesson) forbidden();
  // Староста может отмечать только пары сегодняшнего дня.
  if (!staff && campusDay(lesson.startsAt) !== campusDay(new Date())) forbidden();
  const command = form.get("command");
  const url = new URLSearchParams({ section: "attendance", lesson: lessonId, group: lesson.groupId, date: new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow", dateStyle: "short" }).format(lesson.startsAt) });
  /** Запись в аудит: сотрудник и староста должны видеть итоги действий в журнале. */
  const audit = (summary: string, groupId: string | null = lesson.groupId) =>
    db.auditEntry.create({ data: { actorId: actor.id, groupId, summary } });
  if (command === "monitor" || command === "qr" || command === "close") {
    if (!staff) forbidden();
    if (command === "monitor") {
      const id = String(form.get("student"));
      if (id && !lesson.group.students.some((student) => student.userId === id)) forbidden();
      await db.$transaction([
        db.studentProfile.updateMany({ where: { groupId: lesson.groupId, isMonitor: true }, data: { isMonitor: false } }),
        db.studentProfile.updateMany({ where: { groupId: lesson.groupId, userId: id }, data: { isMonitor: true } }),
      ]);
      const studentName = lesson.group.students.find((student) => student.userId === id)?.user.name;
      await audit("Назначен отмечающий посещаемость · " + lesson.group.name + (studentName ? " · " + studentName : " · доступ снят"));
    } else if (command === "close") {
      await db.attendanceQr.deleteMany({ where: { lessonId } });
      await audit("Закрыт QR-код отметки · " + lesson.title + " · " + lesson.group.name);
    } else {
      const data = { token: randomBytes(24).toString("hex"), expiresAt: new Date(Date.now() + 5 * 60_000) };
      await db.attendanceQr.upsert({ where: { lessonId }, create: { lessonId, ...data }, update: data });
      await audit("QR-код для отметки · " + lesson.title + " · " + lesson.group.name);
    }
  } else {
    const marks = lesson.group.students.flatMap(({ userId }) => {
      const status = form.get("mark-" + userId);
      if (!Object.values(AttendanceStatus).includes(status as AttendanceStatus)) return [];
      return [db.groupAttendance.upsert({ where: { lessonId_userId: { lessonId, userId } },
        create: { lessonId, userId, status: status as AttendanceStatus }, update: { status: status as AttendanceStatus } })];
    });
    await db.$transaction(marks);
    if (marks.length) await audit((staff ? "Посещаемость" : "Отметка старосты") + " · " + lesson.title + " · " + lesson.group.name + " · студентов: " + marks.length);
  }
  url.set("saved", "1");
  redirect(staff ? "/staff?" + url : "/cabinet/journal?saved=1&lesson=" + encodeURIComponent(lessonId));
}

export async function scanAttendance(form: FormData) {
  const actor = await account("STUDENT");
  const result = await markAttendanceByToken(actor.id, form.get("token"));
  if (!result.ok) forbidden();
  redirect("/attendance/check?done=1");
}