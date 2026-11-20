"use client";
import { useRouter } from "next/navigation";
import { DeadlineCalendar } from "./calendar";
export function StaffCalendar({ today, date, days }: { today: string; date: string; days: string[] }) {
  const router = useRouter();
  return <DeadlineCalendar schedule key={date.slice(0,7)} day={date} selected={date}
    items={days.map((day) => ({ id: day, title: "Есть пары", course: "", lessonId: null, completedAt: null, dueAt: day + "T12:00:00+03:00" }))}
    onSelect={(value) => router.push("/staff?section=schedule&date=" + (value || today))} />;
}