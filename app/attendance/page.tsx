import { forbidden, redirect } from "next/navigation";
import { account } from "@/lib/access";
import { db } from "@/lib/db";

/** Старый маршрут журнала: журнал теперь полноценная вкладка кабинета. */
export default async function MonitorRedirect() {
  const actor = await account("STUDENT");
  const profile = await db.studentProfile.findUnique({ where: { userId: actor.id }, select: { isMonitor: true } });
  if (!profile?.isMonitor) forbidden();
  redirect("/cabinet/journal");
}
