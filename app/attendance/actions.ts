"use server";
import { randomBytes } from "node:crypto";
import { AttendanceStatus } from "@prisma/client";
import { forbidden, redirect } from "next/navigation";
import { account, staffGroups } from "@/lib/access";
import { db } from "@/lib/db";

export async function groupAttendance(form: FormData) {
  const actor = await account();
  const lessonId = String(form.get("lesson") ?? "");
  const staff = actor.role === "STAFF";
  const lesson = await db.groupLesson.findFirst({ where: {
    id: lessonId, group: staff ? staffGroups(actor.id) : { students: { some: { userId: actor.id, isMonitor: true } } },
  }, include: { group: { include: { students: { where: { user: { role: "STUDENT" } } } } } } });
  if (!lesson) forbidden();
  const command = form.get("command");
  const url = new URLSearchParams({ section: "attendance", lesson: lessonId, group: lesson.groupId, date: new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow", dateStyle: "short" }).format(lesson.startsAt) });
  if (command === "monitor" || command === "qr" || command === "close") {
    if (!staff) forbidden();
    if (command === "monitor") {
      const id = String(form.get("student"));
      if (id && !lesson.group.students.some((student) => student.userId === id)) forbidden();
      await db.$transaction([
        db.studentProfile.updateMany({ where: { groupId: lesson.groupId, isMonitor: true }, data: { isMonitor: false } }),
        db.studentProfile.updateMany({ where: { groupId: lesson.groupId, userId: id }, data: { isMonitor: true } }),
      ]);
    } else if (command === "close") await db.attendanceQr.deleteMany({ where: { lessonId } });
    else {
      const data = { token: randomBytes(24).toString("hex"), expiresAt: new Date(Date.now() + 5 * 60_000) };
      await db.attendanceQr.upsert({ where: { lessonId }, create: { lessonId, ...data }, update: data });
    }
  } else {
    const marks = lesson.group.students.flatMap(({ userId }) => {
      const status = form.get("mark-" + userId);
      if (!Object.values(AttendanceStatus).includes(status as AttendanceStatus)) return [];
      return [db.groupAttendance.upsert({ where: { lessonId_userId: { lessonId, userId } },
        create: { lessonId, userId, status: status as AttendanceStatus }, update: { status: status as AttendanceStatus } })];
    });
    await db.$transaction(marks);
  }
  url.set("saved", "1");
  redirect(staff ? "/staff?" + url : "/attendance?lesson=" + encodeURIComponent(lessonId) + "&saved=1");
}

export async function scanAttendance(form: FormData) {
  const actor = await account("STUDENT");
  const token = String(form.get("token") ?? "");
  const qr = await db.attendanceQr.findFirst({ where: {
    token, expiresAt: { gt: new Date() }, lesson: { group: { students: { some: { userId: actor.id } } } },
  } });
  if (!qr) forbidden();
  await db.groupAttendance.upsert({
    where: { lessonId_userId: { lessonId: qr.lessonId, userId: actor.id } },
    create: { lessonId: qr.lessonId, userId: actor.id, status: "PRESENT" }, update: {},
  });
  redirect("/attendance/check?done=1");
}