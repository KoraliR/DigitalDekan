"use client";
import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { campusDay, dateLabel, plusDays, type DashboardData } from "@/lib/model";

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function monthOf(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
}
function rangeLabel(from: Date, to: Date) {
  const day = (date: Date) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric" }).format(date);
  const dayMonth = (date: Date) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "long" }).format(date);
  return campusDay(from).slice(0, 7) === campusDay(to).slice(0, 7) ? day(from) + " — " + dayMonth(to) : dayMonth(from) + " — " + dayMonth(to);
}

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
      {weekdays.map((label) => <span className="muted" key={label}>{label}</span>)}
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

export function WeekPicker({ week, today, onPick }: {
  week: Date;
  today: string;
  onPick: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthOf(week));
  const monday = campusDay(week);
  const sunday = campusDay(plusDays(monday, 6));
  const start = (month.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  function shift(offset: number) {
    setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + offset, 1, 12)));
  }
  function toggle() {
    setOpen(!open);
    setMonth(monthOf(week));
  }
  function pick(date: Date) {
    onPick(date);
    setOpen(false);
  }
  return <div className="week-picker" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
    <button type="button" className="week-trigger" aria-expanded={open} aria-haspopup="dialog" onClick={toggle}>
      {rangeLabel(week, plusDays(sunday, 0))} <ChevronDown size={15} />
    </button>
    {open && <>
      <button type="button" className="week-backdrop" aria-label="Закрыть выбор недели" tabIndex={-1} onClick={() => setOpen(false)} />
      <div className="panel week-popover" role="dialog" aria-label="Выбор недели">
        <div className="section-head">
          <Button variant="icon" aria-label="Предыдущий месяц" onClick={() => shift(-1)}><ChevronLeft size={18} /></Button>
          <strong className="calendar-month">{new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "Europe/Moscow" }).format(month)}</strong>
          <Button variant="icon" aria-label="Следующий месяц" onClick={() => shift(1)}><ChevronRight size={18} /></Button>
        </div>
        <div className="calendar-grid week-grid">
          {weekdays.map((label) => <span className="muted" key={label}>{label}</span>)}
          {Array.from({ length: start }, (_, index) => <span key={"blank" + index} />)}
          {Array.from({ length: days }, (_, index) => {
            const date = plusDays(campusDay(month), index);
            const key = campusDay(date);
            const inWeek = key >= monday && key <= sunday;
            return <button key={key} type="button" className={inWeek ? "in-week" : undefined} aria-current={key === today ? "date" : undefined} aria-label={dateLabel(date, true) + (inWeek ? ", выбранная неделя" : "")} onClick={() => pick(date)} autoFocus={key === monday}>
              {index + 1}
            </button>;
          })}
        </div>
        <div className="week-popover-foot">
          <button type="button" className="link-button" onClick={() => pick(plusDays(today, 0))}>Текущая неделя</button>
          <button type="button" className="link-button" onClick={() => setOpen(false)}>Закрыть</button>
        </div>
      </div>
    </>}
  </div>;
}
