import type { RequestStatus, RequestType, LessonType, AttendanceStatus, AssessmentType } from "@prisma/client";
export const services: Record<RequestType, string> = {
  STUDY: "Справка об обучении",
  MILITARY: "Справка для военкомата",
  APPOINTMENT: "Вызов в деканат",
};
export const statuses: Record<RequestStatus, string> = { NEW: "Новая", PROCESSING: "В работе", READY: "Готово", REJECTED: "Отклонена", CANCELLED: "Отменена" };
export const requestTypeClass: Record<RequestType, string> = { STUDY: "info", MILITARY: "info", APPOINTMENT: "warn" };
export const requestStatusClass: Record<RequestStatus, string> = { NEW: "info", PROCESSING: "warn", READY: "done", REJECTED: "absent", CANCELLED: "not-marked" };
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
export const assessments: Record<AssessmentType, { label: string; className: string }> = {
  EXAM: { label: "Экзамен", className: "practice" },
  TEST: { label: "Зачёт", className: "test" },
  COURSEWORK: { label: "Курсовая работа", className: "warn" },
};
export const gradeBreakdown = [
  { key: "practiceScore", label: "Практики", max: 40 },
  { key: "attendanceScore", label: "Посещения", max: 20 },
  { key: "controlScore", label: "Контрольные работы", max: 40 },
] as const;
const gradeWords = ["", "", "Неудовлетворительно", "Удовлетворительно", "Хорошо", "Отлично"];
export function finalGradeLabel(grade: { assessment: AssessmentType | null; finalGrade: number | null; passed: boolean | null }) {
  if (grade.assessment === "TEST") {
    if (grade.passed === null) return "—";
    return grade.passed ? "Зачтено" : "Не зачтено";
  }
  if (grade.finalGrade === null || grade.finalGrade < 2 || grade.finalGrade > 5) return "—";
  return grade.finalGrade + " · " + (gradeWords[grade.finalGrade] ?? "");
}
export interface LessonTeacher {
  name: string;
  position?: string;
}
export interface LessonView {
  comment?: string | null;
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
export interface JournalStudent {
  id: string;
  name: string;
  status: AttendanceStatus | null;
}
export interface JournalLesson {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  teacher: string;
  room: string;
  type: LessonType;
  groupName: string;
  students: JournalStudent[];
}
export interface JournalData {
  lessons: JournalLesson[];
  saved: boolean;
  savedLessonId: string | null;
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
export function daysBetween(from: string, to: string) {
  return Math.round((+plusDays(to, 0) - +plusDays(from, 0)) / 86400000);
}
export interface DashboardData {
  lessons: LessonView[];
  grades: { id: string; title: string; score: number; threshold: number; term: number; assessment: AssessmentType | null; finalGrade: number | null; passed: boolean | null; practiceScore: number | null; attendanceScore: number | null; controlScore: number | null }[];
  deadlines: DeadlineView[];
  requests: RequestView[];
  news: { id: string; title: string; body: string; readAt?: string | null; kind?: string | null; createdAt?: string }[];
}
