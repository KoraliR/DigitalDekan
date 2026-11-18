import type { AttendanceStatus, LessonType } from "@prisma/client";
import { attendanceStatuses, lessonTypes } from "@/lib/model";

export function LessonTypeBadge({ type }: { type: LessonType }) {
  const meta = lessonTypes[type];
  return <span className={"pill " + meta.className}>{meta.label}</span>;
}

export function AttendanceBadge({ status, ended }: { status: AttendanceStatus | null; ended: boolean }) {
  if (!status) {
    return <span className={"pill " + (ended ? "not-marked" : "future")}>{ended ? "Не отмечено" : "Занятие ещё не прошло"}</span>;
  }
  const meta = attendanceStatuses[status];
  return <span className={"pill " + meta.className}>{meta.label}</span>;
}
