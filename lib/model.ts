import type { RequestStatus, RequestType } from "@prisma/client";
export const services: Record<RequestType, string> = {
  STUDY: "Справка об обучении",
  MILITARY: "Справка для военкомата",
  APPOINTMENT: "Вызов в деканат",
};
export const statuses: Record<RequestStatus, string> = { PROCESSING: "В обработке", READY: "Готово" };

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
export interface DashboardData {
  lessons: { id: string; title: string; teacher: string; room: string; type: "LECTURE" | "PRACTICE"; startsAt: string; endsAt: string }[];
  grades: { id: string; title: string; score: number; threshold: number; term: number }[];
  deadlines: { id: string; title: string; course: string; dueAt: string }[];
  requests: { id: string; type: RequestType; status: RequestStatus; createdAt: string; student?: string }[];
  news: { id: string; title: string; body: string }[];
}