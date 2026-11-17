"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, ChevronLeft, ChevronRight,
  CircleHelp, Clock3, Coffee, FileText, GraduationCap, Info, LogOut, Map, MapPin, Menu,
  Route, Shield, UserRound, X, type LucideIcon,
} from "lucide-react";
import { apply, changeStatus, logout } from "@/app/actions";
import { campusDay, dateLabel, plusDays, services, statuses, timeLabel, type DashboardData } from "@/lib/model";
import type { Tab } from "@/lib/tabs";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme";
import { Campus } from "./campus";
import { DeadlineCalendar } from "./calendar";
import type { RequestType } from "@prisma/client";

const navigation: { id: Tab; title: string; icon: LucideIcon }[] = [
  { id: "today", title: "Сегодня", icon: CalendarDays },
  { id: "grades", title: "Оценки", icon: GraduationCap },
  { id: "services", title: "Сервисы", icon: FileText },
  { id: "map", title: "Кампус", icon: Map },
  { id: "calendar", title: "Календарь", icon: Bell },
];

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>;
}

const lessonForms: Record<string, string> = { one: "занятие", few: "занятия", many: "занятий" };

function Schedule({ day, lessons, mapUrl }: { day: string; lessons: DashboardData["lessons"]; mapUrl: string }) {
  const [weekly, setWeekly] = useState(false);
  const [offset, setOffset] = useState(0);
  const weekday = (plusDays(day, 0).getUTCDay() + 6) % 7;
  const days = weekly ? Array.from({ length: 7 }, (_, index) => plusDays(day, offset * 7 + index - weekday)) : [plusDays(day, 0)];
  const selected = lessons.filter((lesson) => campusDay(new Date(lesson.startsAt)) === day);
  return <section className="panel schedule">
    <div className="section-head"><div className="heading-with-icon"><span className="soft-icon"><CalendarDays size={21} /></span><div><h2>Расписание</h2><p className="muted">{weekly ? "Занятия по дням недели" : selected.length + " " + lessonForms[new Intl.PluralRules("ru").select(selected.length)] + " сегодня"}</p></div></div>
      <div className="segmented" aria-label="Период расписания">
        <button aria-pressed={!weekly} onClick={() => setWeekly(false)}>День</button>
        <button aria-pressed={weekly} onClick={() => setWeekly(true)}>Неделя</button>
      </div>
    </div>
    {weekly && <div className="week-controls"><Button variant="icon" aria-label="Предыдущая неделя" onClick={() => setOffset(offset - 1)}><ChevronLeft size={18} /></Button>
      <span>{dateLabel(days[0])} — {dateLabel(days[6])}</span>
      <Button variant="icon" aria-label="Следующая неделя" onClick={() => setOffset(offset + 1)}><ChevronRight size={18} /></Button></div>}
    {days.map((date) => {
      const rows = lessons.filter((item) => campusDay(new Date(item.startsAt)) === campusDay(date));
      return <div key={campusDay(date)} className="day-group">
        {weekly && <h3 className="day-heading">{dateLabel(date, true)}</h3>}
        {rows.length === 0 && <Empty>Занятий нет</Empty>}
        {rows.map((lesson, index) => {
          const start = new Date(lesson.startsAt);
          const end = new Date(lesson.endsAt);
          const previous = rows[index - 1];
          const gap = previous ? Math.round((+start - Date.parse(previous.endsAt)) / 60000) : 0;
          return <div key={lesson.id}>
            {gap > 0 && <div className="break"><Coffee size={14} /> Перерыв <span>{timeLabel(new Date(previous.endsAt))}–{timeLabel(start)} · {gap} мин</span></div>}
            <article className="lesson">
              <div className="lesson-top"><span><Clock3 size={14} /> {timeLabel(start)} — {timeLabel(end)}</span><span className={"pill " + (lesson.type === "LECTURE" ? "lecture" : "practice")}>{lesson.type === "LECTURE" ? "Лекция" : "Практика"}</span></div>
              <h3>{lesson.title}</h3>
              <div className="lesson-meta"><Link href={mapUrl + "?room=" + encodeURIComponent(lesson.room)}><MapPin size={15} /> Ауд. {lesson.room}</Link><span><UserRound size={15} /> {lesson.teacher}</span></div>
            </article>
          </div>;
        })}
      </div>;
    })}
  </section>;
}

function Deadlines({ items, day, href }: { items: DashboardData["deadlines"]; day: string; href?: string }) {
  const future = items.filter((item) => campusDay(new Date(item.dueAt)) >= day);
  const rows = href ? future.slice(0, 3) : items;
  const tomorrow = campusDay(plusDays(day, 1));
  return <section className="panel deadlines">
    <div className="section-head"><div className="heading-with-icon"><span className="soft-icon"><Bell size={20} /></span><div><h2>{href ? "Ближайшие дедлайны" : "Контрольные точки"}</h2><p className="muted">{href ? "До трёх ближайших работ" : "Сроки сдачи работ"}</p></div></div></div>
    {rows.length ? <ul className="deadline-list">{rows.map((item) => {
      const date = new Date(item.dueAt);
      const key = campusDay(date);
      return <li key={item.id}><span className={"dot" + (key <= tomorrow ? " urgent" : "")} /><div><h3>{item.title}</h3><p className="muted">{item.course}</p></div>
        <span className={"deadline-date" + (key <= tomorrow ? " urgent-text" : "")}>{key === day ? "Сегодня" : key === tomorrow ? "Завтра" : dateLabel(date)}{!href && <small>{timeLabel(date)}</small>}</span></li>;
    })}</ul> : <Empty>Дедлайнов пока нет</Empty>}
    {href && <Link className="text-link" href={href}>Открыть календарь <ArrowRight size={16} /></Link>}
  </section>;
}

function Grades({ grades }: { grades: DashboardData["grades"] }) {
  const [all, setAll] = useState(false);
  const term = Math.max(...grades.map((grade) => grade.term));
  const rows = all ? grades : grades.filter((grade) => grade.term === term);
  return <section className="panel">
    <div className="section-head"><div><h2>Дисциплины</h2><p className="muted">{grades.length ? "Семестр " + term : "Баллы по дисциплинам"}</p></div>
      <div className="segmented"><button aria-pressed={!all} onClick={() => setAll(false)}>Семестр</button><button aria-pressed={all} onClick={() => setAll(true)}>Вся учёба</button></div></div>
    {rows.length === 0 && <Empty>Оценок пока нет</Empty>}
    {rows.map((grade) => {
      const left = Math.max(0, grade.threshold - grade.score);
      return <article className="grade" key={grade.id}><div><h3>{grade.title}</h3><strong>{grade.score} / {grade.threshold}</strong></div>
        <progress aria-label={grade.title} max={Math.max(1, grade.threshold)} value={Math.max(0, Math.min(grade.score, grade.threshold))} />
        <p className="muted">{left ? "До зачёта " + left + " балл." : "Порог зачёта достигнут"}{all && " · Семестр " + grade.term}</p></article>;
    })}
  </section>;
}

function Services({ role, demo, requests }: { role: "STUDENT" | "STAFF"; demo: boolean; requests: DashboardData["requests"] }) {
  const [choice, setChoice] = useState<RequestType>();
  const [local, setLocal] = useState<DashboardData["requests"]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, run] = useTransition();
  useEffect(() => {
    if (!demo) return;
    try { setLocal(JSON.parse(localStorage.getItem("dekanat-demo-requests") ?? "[]")); } catch {}
  }, [demo]);
  const rows = demo ? local : requests;

  function submit(type: RequestType) {
    setError("");
    setMessage("");
    run(async () => {
      try {
        if (demo) {
          const next: DashboardData["requests"] = [{ id: crypto.randomUUID(), type, status: "PROCESSING", createdAt: new Date().toISOString() }, ...local];
          localStorage.setItem("dekanat-demo-requests", JSON.stringify(next));
          setLocal(next);
        } else {
          const result = await apply(type);
          if (result.error) { setError(result.error); return; }
        }
        setChoice(undefined);
        setMessage("Заявка отправлена");
      } catch { setError("Не удалось отправить заявку. Попробуйте ещё раз."); }
    });
  }

  return <div className="content-stack">
    {role === "STUDENT" && <section className="panel"><h2>Справки и обращения</h2><div className="service-list">
      {(Object.keys(services) as RequestType[]).map((type) => <button className="service-item" key={type} onClick={() => { setChoice(type); setError(""); setMessage(""); }}><span className="soft-icon"><FileText size={19} /></span><strong>{services[type]}</strong><ChevronRight size={18} /></button>)}
    </div></section>}
    <section className="panel"><h2>{role === "STAFF" ? "Все заявки" : "Мои заявки"}</h2>
      {message && <p className="muted" role="status">{message}</p>}
      {!choice && error && <p className="form-error" role="alert">{error}</p>}
      {rows.length === 0 && <Empty>Заявок пока нет</Empty>}
      {rows.map((request) => <article className="request-row" key={request.id}><div><h3>{services[request.type]}</h3><p className="muted">{request.student && request.student + " · "}{dateLabel(new Date(request.createdAt))}</p></div>
        <span className={"pill " + (request.status === "READY" ? "ready" : "lecture")}>{statuses[request.status]}</span>
        {role === "STAFF" && <Button variant="secondary" disabled={pending} onClick={() => run(async () => {
          setError("");
          try {
            const result = await changeStatus(request.id, request.status === "READY" ? "PROCESSING" : "READY");
            setError(result.error ?? "");
          } catch { setError("Не удалось обновить статус."); }
        })}>{request.status === "READY" ? "Вернуть в обработку" : "Отметить готовой"}</Button>}
      </article>)}
    </section>
    {choice && <dialog ref={(node) => { if (node && !node.open) node.showModal(); }} className="confirm-dialog" aria-labelledby="confirm-title" onCancel={(event) => { event.preventDefault(); if (!pending) setChoice(undefined); }}><div className="panel">
      <h2 id="confirm-title">{services[choice]}</h2><p className="muted">Заявка появится в списке со статусом «В обработке».</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions"><Button variant="secondary" disabled={pending} onClick={() => setChoice(undefined)}>Отмена</Button><Button autoFocus disabled={pending} onClick={() => submit(choice)}>{pending ? "Отправляем…" : "Подать заявку"}</Button></div>
    </div></dialog>}
  </div>;
}

export function Dashboard({ tab, day, data, role, name, demo = false, initialRoom }: {
  tab: Tab; day: string; data: DashboardData; role: "STUDENT" | "STAFF"; name: string; demo?: boolean; initialRoom?: string;
}) {
  const [menu, setMenu] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  const base = demo ? "/demo/" : "/cabinet/";
  const nav = (className: string) => <nav className={className} aria-label="Основные разделы">{navigation.map(({ id, title, icon: Icon }) =>
    <Link key={id} href={id === "services" && role === "STAFF" ? "/staff" : base + id} aria-current={tab === id ? "page" : undefined}><Icon size={21} /><span>{title}</span></Link>)}</nav>;
  const title = { today: "Сегодня", grades: "Успеваемость", services: "Сервисы деканата", map: "Карта кампуса", calendar: "Календарь дедлайнов" }[tab];

  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href={base + "today"}><span className="brand-mark"><GraduationCap size={24} /></span><span>Цифровой<br /> деканат</span></Link>
      <div className="side-label">Личный кабинет</div>
      {nav("side-nav")}
      <div className="side-footer"><span className="soft-icon"><CircleHelp size={18} /></span><div>{demo ? "Демоверсия" : "Кабинет вуза"}<small>{demo ? "Учебные данные" : "Конкурсный прототип"}</small></div></div>
    </aside>
    <div className="app-main"><header className="topbar">
      <Link className="brand mobile-brand" href={base + "today"}><span className="brand-mark"><GraduationCap size={22} /></span>Деканат</Link>
      <span className="breadcrumb">Личный кабинет <ChevronRight size={14} /> <strong>{navigation.find((item) => item.id === tab)?.title}</strong></span>
      <div className="top-actions"><ThemeToggle /><div className="menu-anchor"><Button type="button" variant="icon" aria-label={menu ? "Закрыть меню" : "Открыть меню"} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X size={21} /> : <Menu size={21} />}</Button>
      {menu && <div className="panel account-menu" onKeyDown={(event) => { if (event.key === "Escape") setMenu(false); }}>
        <strong>{name}</strong><p className="muted">{role === "STAFF" ? "Сотрудник деканата" : "Студент"}</p>
        <div className="theme-setting">Тема интерфейса <ThemeToggle /></div>
        {demo ? <Link className="text-link" href="/login"><Shield size={16} /> Вход с учётной записью</Link> :
          <form action={logout}><Button variant="secondary"><LogOut size={16} /> Выйти</Button></form>}
      </div>}</div></div>
    </header>
    <main className="workspace">
      <div className="notice"><Info size={16} /><span>Концепт для конкурса. Не является официальным сервисом вуза</span></div>
      {tab === "today" ? <section className="today-banner">
        <div className="banner-content"><p><CalendarDays size={16} /> <span className="banner-date">{dateLabel(plusDays(day, 0), true)}</span></p><h1>Сегодня</h1><div>Расписание занятий и ближайшие дедлайны</div></div>
        <div className="banner-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="banner-icon"><CalendarDays size={68} strokeWidth={1.3} /></div><span className="art-arrow"><ArrowUpRight size={22} /></span></div>
      </section> : <div className="page-heading"><h1>{title}</h1></div>}
      {tab === "today" && <div className="dashboard-grid">
        <Schedule lessons={data.lessons} day={day} mapUrl={base + "map"} />
        <div className="content-stack"><Deadlines items={data.deadlines} day={day} href={base + "calendar"} />
          <Link className="panel route-link" href={base + "map"}><span className="soft-icon"><Route size={22} /></span><div><h2>Найти аудиторию</h2><p className="muted">Маршрут по кампусу</p></div><ArrowDownRight size={19} /></Link>
        </div>
      </div>}
      {tab === "grades" && <Grades grades={data.grades} />}
      {tab === "services" && <Services role={role} requests={data.requests} demo={demo} />}
      {tab === "map" && <Campus key={initialRoom ?? "campus"} lessons={data.lessons} initialRoom={initialRoom} />}
      {tab === "calendar" && <div className="content-stack">
        <div className="dashboard-grid campus-grid"><DeadlineCalendar day={day} items={data.deadlines} selected={selectedDay} onSelect={setSelectedDay} /><Deadlines items={selectedDay ? data.deadlines.filter((item) => campusDay(new Date(item.dueAt)) === selectedDay) : data.deadlines} day={day} /></div>
        <details className="panel news"><summary>Новости деканата</summary>
          {data.news.length ? data.news.map((item) => <article key={item.id}><h3>{item.title}</h3><p className="muted">{item.body}</p></article>) : <Empty>Новостей пока нет</Empty>}
        </details>
      </div>}
    </main></div>
    {nav("bottom-nav")}
  </div>;
}