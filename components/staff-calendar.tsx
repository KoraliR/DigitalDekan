"use client";
import { useRouter } from "next/navigation";
import { DeadlineCalendar } from "./calendar";
export function StaffCalendar({ today, date, days, group }: { today: string; date: string; days: string[]; group?: string }) {
  const router = useRouter();
  function open(value: string) {
    const query = new URLSearchParams({ section: "schedule", date: value || today });
    if (group) query.set("group", group);
    router.push("/staff?" + query);
  }
  return <DeadlineCalendar schedule key={date.slice(0,7)} day={date} selected={date}
    items={days.map((day) => ({ id: day, title: "Есть пары", course: "", lessonId: null, completedAt: null, dueAt: day + "T12:00:00+03:00" }))}
    onSelect={open} />;
}
