"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { campusDay, dateLabel, plusDays, type DashboardData } from "@/lib/model";

export function DeadlineCalendar({ day, items, selected, onSelect }: {
  day: string;
  items: DashboardData["deadlines"];
  selected: string;
  onSelect: (day: string) => void;
}) {
  const [month, setMonth] = useState(() => new Date(day.slice(0, 7) + "-01T12:00:00Z"));
  const initial = campusDay(month);
  const start = (month.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const due = new Set(items.map((item) => campusDay(new Date(item.dueAt))));
  function shift(offset: number) {
    setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + offset, 1, 12)));
  }
  return <section className="panel">
    <div className="section-head">
      <Button variant="icon" aria-label="Предыдущий месяц" onClick={() => shift(-1)}><ChevronLeft size={18} /></Button>
      <h2 className="calendar-month">{new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "Europe/Moscow" }).format(month)}</h2>
      <Button variant="icon" aria-label="Следующий месяц" onClick={() => shift(1)}><ChevronRight size={18} /></Button>
    </div>
    <div className="calendar-grid">
      {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((label) => <span className="muted" key={label}>{label}</span>)}
      {Array.from({ length: start }, (_, index) => <span key={"blank" + index} />)}
      {Array.from({ length: days }, (_, index) => {
        const date = plusDays(initial, index);
        const key = campusDay(date);
        return <button key={key} aria-label={dateLabel(date) + (due.has(key) ? ", есть дедлайн" : "")} className={due.has(key) ? "has-deadline" : ""} aria-current={key === day ? "date" : undefined} aria-pressed={key === selected} onClick={() => onSelect(key === selected ? "" : key)}>
          {index + 1}
        </button>;
      })}
    </div>
    {selected && <button className="text-link" onClick={() => onSelect("")}>Показать все контрольные точки</button>}
  </section>;
}