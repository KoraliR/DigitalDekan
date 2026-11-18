import type { RequestStatus, RequestType, LessonType, AttendanceStatus } from "@prisma/client";
export const services: Record<RequestType, string> = {
  STUDY: "Справка об обучении",
  MILITARY: "Справка для военкомата",
  APPOINTMENT: "Вызов в деканат",
};
export const statuses: Record<RequestStatus, string> = { NEW: "Новая", PROCESSING: "В работе", READY: "Готово", REJECTED: "Отклонена" };
export const requestTypeClass: Record<RequestType, string> = { STUDY: "info", MILITARY: "info", APPOINTMENT: "warn" };
export const requestStatusClass: Record<RequestStatus, string> = { NEW: "info", PROCESSING: "warn", READY: "done", REJECTED: "absent" };
export interface RequestView {
  id: string;
  number: string;
  type: RequestType;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  comment: string | null;
  readyBy: string | null;
  student?: string;
}
export const lessonTypes: Record<LessonType, { label: string; className: string }> = {
  LECTURE: { label: "Лекция", className: "lecture" },
  PRACTICE: { label: "Практика", className: "practice" },
  SEMINAR: { label: "Семинар", className: "seminar" },
  LAB: { label: "Лабораторная", className: "lab" },
  TEST: { label: "Зачёт", className: "test" },
  EXAM: { label: "Экзамен", className: "exam" },
};
export const attendanceStatuses: Record<AttendanceStatus, { label: string; className: string }> = {
  PRESENT: { label: "Присутствовал", className: "present" },
  ABSENT: { label: "Отсутствовал", className: "absent" },
  EXCUSED: { label: "Уважительная причина", className: "excused" },
};
export interface LessonTeacher {
  name: string;
  position?: string;
}
export interface LessonView {
  id: string;
  title: string;
  teacher: string;
  room: string;
  type: LessonType;
  groups: string[];
  campus: string | null;
  teachers: LessonTeacher[];
  originalStartsAt: string | null;
  originalEndsAt: string | null;
  attendance: AttendanceStatus | null;
  startsAt: string;
  endsAt: string;
}
export interface DeadlineView {
  id: string;
  title: string;
  course: string;
  dueAt: string;
  lessonId: string | null;
  completedAt: string | null;
}

export function campusDay(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow", dateStyle: "short" }).format(date);
}
export function timeLabel(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", timeStyle: "short" }).format(date);
}
export function dateLabel(date: Date, weekday = false) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "long", ...(weekday ? { weekday: "long" } : {}) }).format(date);
}
export function plusDays(day: string, count: number) {
  return new Date(Date.parse(day + "T12:00:00+03:00") + count * 86400000);
}
export function weekStart(day: string) {
  const weekday = (plusDays(day, 0).getUTCDay() + 6) % 7;
  return plusDays(day, -weekday);
}
export function weeksBetween(from: string, to: string) {
  return Math.round((+weekStart(to) - +weekStart(from)) / 604800000);
}
export interface DashboardData {
  lessons: LessonView[];
  grades: { id: string; title: string; score: number; threshold: number; term: number }[];
  deadlines: DeadlineView[];
  requests: RequestView[];
  news: { id: string; title: string; body: string }[];
}
