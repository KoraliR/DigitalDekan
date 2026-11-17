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
  const [lessons, grades, deadlines, requests, news] = await Promise.all([
    db.lesson.findMany({ where: { userId: user.id }, orderBy: { startsAt: "asc" } }),
    tab === "grades" ? db.grade.findMany({ where: { userId: user.id }, orderBy: { term: "desc" } }) : [],
    tab === "today" || tab === "calendar" ? db.deadline.findMany({ where: { userId: user.id }, orderBy: { dueAt: "asc" } }) : [],
    tab === "services" ? db.serviceRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }) : [],
    tab === "calendar" ? db.news.findMany({ orderBy: { createdAt: "desc" } }) : [],
  ]);
  return <Dashboard initialRoom={typeof room === "string" ? room : undefined} tab={tab} day={campusDay(new Date())} role={user.role} name={user.name} data={{
    lessons: lessons.map(({ userId, ...lesson }) => ({ ...lesson, startsAt: lesson.startsAt.toISOString(), endsAt: lesson.endsAt.toISOString() })),
    grades: grades.map(({ userId, ...grade }) => grade),
    deadlines: deadlines.map(({ userId, ...deadline }) => ({ ...deadline, dueAt: deadline.dueAt.toISOString() })),
    requests: requests.map(({ userId, ...request }) => ({ ...request, createdAt: request.createdAt.toISOString() })),
    news: news.map(({ id, title, body }) => ({ id, title, body })),
  }} />;
}