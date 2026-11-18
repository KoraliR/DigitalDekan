import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { account } from "@/lib/access";
import { db } from "@/lib/db";
import { campusDay } from "@/lib/model";
import { validTab } from "@/lib/tabs";

export default async function Cabinet({ params, searchParams }: { params: Promise<{ tab: string }>; searchParams: Promise<{ room?: string | string[] }> }) {
  const user = await account();
  const tab = validTab((await params).tab);
  const { room } = await searchParams;
  if (user.role === "STAFF" && tab === "services") redirect("/staff");
  const [lessons, grades, deadlines, requests, news, attendance] = await Promise.all([
    db.lesson.findMany({ where: { userId: user.id }, orderBy: { startsAt: "asc" } }),
    tab === "grades" ? db.grade.findMany({ where: { userId: user.id }, orderBy: { term: "desc" } }) : [],
    tab === "today" || tab === "calendar" ? db.deadline.findMany({ where: { userId: user.id }, orderBy: { dueAt: "asc" } }) : [],
    tab === "services" ? db.serviceRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }) : [],
    tab === "today" ? db.news.findMany({ orderBy: { createdAt: "desc" } }) : [],
    tab === "today" ? db.attendance.findMany({ where: { userId: user.id } }) : [],
  ]);
  const attendanceByLesson = new Map(attendance.map((item) => [item.lessonId, item.status]));
  return <Dashboard initialRoom={typeof room === "string" ? room : undefined} tab={tab} day={campusDay(new Date())} role={user.role} name={user.name} data={{
    lessons: lessons.map(({ userId, ...lesson }) => ({
      ...lesson,
      startsAt: lesson.startsAt.toISOString(),
      endsAt: lesson.endsAt.toISOString(),
      originalStartsAt: lesson.originalStartsAt?.toISOString() ?? null,
      originalEndsAt: lesson.originalEndsAt?.toISOString() ?? null,
      groups: lesson.groups,
      campus: lesson.campus,
      teachers: (lesson.teachers as { name: string; position?: string }[] | null) ?? [],
      attendance: attendanceByLesson.get(lesson.id) ?? null,
    })),
    grades: grades.map(({ userId, ...grade }) => grade),
    deadlines: deadlines.map(({ userId, ...deadline }) => ({ ...deadline, dueAt: deadline.dueAt.toISOString(), lessonId: deadline.lessonId, completedAt: deadline.completedAt?.toISOString() ?? null })),
    requests: requests.map(({ userId, ...request }) => ({
      ...request,
      number: request.number ?? "З-" + request.id.slice(0, 8),
      comment: request.comment ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: (request.updatedAt ?? request.createdAt).toISOString(),
    })),
    news: news.map(({ id, title, body }) => ({ id, title, body })),
  }} />;
}