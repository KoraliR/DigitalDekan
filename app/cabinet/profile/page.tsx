import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { account } from "@/lib/access";
import { campusDay } from "@/lib/model";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await account();
  if (user.role !== "STUDENT") redirect("/staff");
  return <Dashboard tab="profile" day={campusDay(new Date())} role={user.role} name={user.name} monitor={user.isMonitor} data={{
    lessons: [], grades: [], deadlines: [], requests: [], news: [],
  }} />;
}
