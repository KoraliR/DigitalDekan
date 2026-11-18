import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { account } from "@/lib/access";
import { db } from "@/lib/db";
import { campusDay } from "@/lib/model";

export default async function Staff() {
  const user = await account();
  if (user.role !== "STAFF") redirect("/cabinet/services");
  const requests = await db.serviceRequest.findMany({
    select: { id: true, type: true, status: true, number: true, comment: true, createdAt: true, updatedAt: true, user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return <Dashboard tab="services" day={campusDay(new Date())} name={user.name} role={user.role} data={{
    lessons: [], grades: [], deadlines: [], news: [],
    requests: requests.map(({ user, ...request }) => ({
      ...request,
      student: user.name,
      number: request.number ?? "З-" + request.id.slice(0, 8),
      comment: request.comment ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: (request.updatedAt ?? request.createdAt).toISOString(),
    })),
  }} />;
}