import { Dashboard } from "@/components/dashboard";
import { account } from "@/lib/access";
import { db } from "@/lib/db";
import { campusDay } from "@/lib/model";
import { validTab } from "@/lib/tabs";

export default async function Cabinet({ params, searchParams }: { params: Promise<{ tab: string }>; searchParams: Promise<{ room?: string | string[] }> }) {
  const user = await account("STUDENT");
  const tab = validTab((await params).tab);
  const { room } = await searchParams;
  const [lessons, grades, deadlines, requests, news, groupLessons, notifications] = await Promise.all([
    db.lesson.findMany({ where: { userId: user.id }, orderBy: { startsAt: "asc" } }),
    tab === "grades" ? db.grade.findMany({ where: { userId: user.id }, orderBy: { term: "desc" } }) : [],
    tab === "today" || tab === "calendar" ? db.deadline.findMany({ where: { userId: user.id }, orderBy: { dueAt: "asc" } }) : [],
    tab === "services" ? db.serviceRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }) : [],
        tab === "today" || tab === "calendar" ? db.news.findMany({ orderBy: { createdAt: "desc" } }) : [],
    user.groupId && (tab === "today" || tab === "map") ? db.groupLesson.findMany({ where: { groupId: user.groupId } }) : [],
    tab === "today" || tab === "calendar" ? db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }) : [],
  ]);
  return <Dashboard initialRoom={typeof room === "string" ? room : undefined} tab={tab} day={campusDay(new Date())} role={user.role} name={user.name} data={{
    lessons: [...lessons, ...groupLessons].sort((a, b) => +a.startsAt - +b.startsAt).map((lesson) => ({ id: lesson.id, title: lesson.title, teacher: lesson.teacher, room: lesson.room, type: lesson.type, startsAt: lesson.startsAt.toISOString(), endsAt: lesson.endsAt.toISOString() })),
    grades: grades.map(({ userId, ...grade }) => grade),
    deadlines: deadlines.map(({ userId, ...deadline }) => ({ ...deadline, dueAt: deadline.dueAt.toISOString() })),
    requests: requests.map(({ userId, ...request }) => ({ ...request, createdAt: request.createdAt.toISOString(), readyBy: request.readyBy?.toISOString() })),
    news: [...notifications, ...news].sort((a, b) => +b.createdAt - +a.createdAt).map(({ id, title, body }) => ({ id, title, body })),
  }} />;
}