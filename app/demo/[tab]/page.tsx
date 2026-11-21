import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { campusDay } from "@/lib/model";
import { demoData } from "@/lib/demo";
import { randomQuote } from "@/lib/quotes";
import { validTab } from "@/lib/tabs";
export const dynamic = "force-dynamic";
export default async function Demo({ params, searchParams }: { params: Promise<{ tab: string }>; searchParams: Promise<{ room?: string | string[] }> }) {
  const tab = validTab((await params).tab);
  // В демоверсии нет роли старосты — журнал доступен только в реальном аккаунте.
  if (tab === "profile" || tab === "journal") redirect("/demo/today");
  const { room } = await searchParams;
  const day = campusDay(new Date());
  // Демо-студентка — Анна Соколова, поэтому эмблема женская.
  return <Dashboard initialRoom={typeof room === "string" ? room : undefined} tab={tab} day={day} data={demoData(day)} role="STUDENT" name="Анна Соколова" demo gender="FEMALE" quote={tab === "today" ? randomQuote() : undefined} />;
}
