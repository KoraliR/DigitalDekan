import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { studentSession } from "@/lib/api";

function stamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET() {
  const session = await studentSession();
  if ("response" in session) return session.response;

  const profile = await db.studentProfile.findUnique({ where: { userId: session.accountId }, select: { groupId: true } });
  const [lessons, groupLessons] = await Promise.all([
    db.lesson.findMany({ where: { userId: session.accountId }, orderBy: { startsAt: "asc" } }),
    profile?.groupId ? db.groupLesson.findMany({ where: { groupId: profile.groupId }, include: { group: true }, orderBy: { startsAt: "asc" } }) : [],
  ]);

  const events = [
    ...lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      teacher: lesson.teacher,
      room: lesson.room,
      at: lesson.startsAt,
      until: lesson.endsAt,
      group: lesson.groups.join(", "),
    })),
    ...groupLessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      teacher: lesson.teacher,
      room: lesson.room,
      at: lesson.startsAt,
      until: lesson.endsAt,
      group: lesson.group.name,
    })),
  ].sort((left, right) => +left.at - +right.at);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Digital Dean//Schedule//RU",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Цифровой деканат",
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + event.id + "@dekanat.local",
      "DTSTAMP:" + stamp(new Date()),
      "DTSTART:" + stamp(event.at),
      "DTEND:" + stamp(event.until),
      "SUMMARY:" + escapeText(event.title),
      "LOCATION:" + escapeText((event.room ? "Ауд. " + event.room + ", " : "") + "Главный корпус"),
      "DESCRIPTION:" + escapeText([event.teacher, event.group].filter(Boolean).join(" · ")),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="schedule.ics"',
      "Cache-Control": "no-store",
    },
  });
}
