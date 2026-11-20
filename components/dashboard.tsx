"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, CalendarPlus, CheckCheck, ChevronLeft, ChevronRight,
  CircleHelp, Clock3, Coffee, FileText, GraduationCap, Info, LogOut, Map, MapPin, Megaphone, Menu,
  Route, Shield, UserRound, X, type LucideIcon,
} from "lucide-react";
import { apply, logout, markNotificationsRead } from "@/app/actions";
import { campusDay, dateLabel, daysBetween, finalGradeLabel, assessments, plusDays, requestStatusClass, services, statuses, timeLabel, weekStart, weeksBetween, type DashboardData } from "@/lib/model";
import type { Tab } from "@/lib/tabs";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme";
import { Campus } from "./campus";
import { DeadlineCalendar, SchedulePicker } from "./calendar";
import { ProfileView } from "./profile";
import { LessonTypeBadge } from "./lesson-meta";
import { LessonDialog } from "./lesson-dialog";
import { RequestDialog } from "./request-dialog";
import type { RequestType } from "@prisma/client";

const navigation: { id: Tab; title: string; icon: LucideIcon }[] = [
  { id: "today", title: "Сегодня", icon: CalendarDays },
  { id: "grades", title: "Оценки", icon: GraduationCap },
  { id: "services", title: "Сервисы", icon: FileText },
  { id: "map", title: "Кампус", icon: Map },
  { id: "calendar", title: "Календарь", icon: Bell },
  { id: "profile", title: "Профиль", icon: UserRound },
];

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>;
}

const lessonForms: Record<string, string> = { one: "занятие", few: "занятия", many: "занятий" };
function countLabel(count: number, forms: [string, string, string]) {
  const rule = new Intl.PluralRules("ru").select(count);
  return count + " " + forms[rule === "one" ? 0 : rule === "few" ? 1 : 2];
}

function Schedule({ day, lessons, deadlines, mapUrl, icsUrl }: { day: string; lessons: DashboardData["lessons"]; deadlines: DashboardData["deadlines"]; mapUrl: string; icsUrl?: string }) {
  const [weekly, setWeekly] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const lastCard = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (!openedId) lastCard.current?.focus(); }, [openedId]);
  const monday = campusDay(weekStart(day));
  const active = weekly ? plusDays(monday, weekOffset * 7) : plusDays(day, dayOffset);
  const activeKey = campusDay(active);
  const days = weekly ? Array.from({ length: 7 }, (_, index) => plusDays(monday, weekOffset * 7 + index)) : [active];
  const activeDayLessons = lessons.filter((lesson) => campusDay(new Date(lesson.startsAt)) === activeKey);
  const opened = openedId ? lessons.find((lesson) => lesson.id === openedId) : undefined;
  const shift = (delta: number) => { if (weekly) setWeekOffset(weekOffset + delta); else setDayOffset(dayOffset + delta); };
  const subtitle = weekly ? "Занятия по дням недели"
    : activeDayLessons.length + " " + lessonForms[new Intl.PluralRules("ru").select(activeDayLessons.length)] + (activeKey === day ? " сегодня" : " · " + dateLabel(active, true));
  return <>
    <section className="panel schedule">
      <div className="section-head"><div className="heading-with-icon"><span className="soft-icon"><CalendarDays size={21} /></span><div><h2>Расписание</h2><p className="muted">{subtitle}</p></div></div>
        <div className="segmented" aria-label="Период расписания">
          <button aria-pressed={!weekly} onClick={() => setWeekly(false)}>День</button>
          <button aria-pressed={weekly} onClick={() => { setWeekOffset(weeksBetween(day, activeKey)); setWeekly(true); }}>Неделя</button>
        </div>
      </div>
      {icsUrl && <div className="top-actions"><a className="button button-secondary" href={icsUrl} download><CalendarPlus size={16} /> В календарь</a></div>}
      <div className="week-controls"><Button variant="icon" aria-label={weekly ? "Предыдущая неделя" : "Предыдущий день"} onClick={() => shift(-1)}><ChevronLeft size={18} /></Button>
        <SchedulePicker mode={weekly ? "week" : "day"} value={active} today={day}
          onPick={(date) => { if (weekly) setWeekOffset(weeksBetween(day, campusDay(date))); else setDayOffset(daysBetween(day, campusDay(date))); }} />
        <Button variant="icon" aria-label={weekly ? "Следующая неделя" : "Следующий день"} onClick={() => shift(1)}><ChevronRight size={18} /></Button></div>
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
              <button type="button" className="lesson lesson-card" aria-haspopup="dialog" onClick={(event) => { lastCard.current = event.currentTarget; setOpenedId(lesson.id); }}>
                <span className="lesson-top"><span><Clock3 size={14} /> {timeLabel(start)} — {timeLabel(end)}</span><LessonTypeBadge type={lesson.type} /></span>
                <span className="lesson-title" role="heading" aria-level={3}>{lesson.title}</span>
                <span className="lesson-meta"><span><MapPin size={15} /> Ауд. {lesson.room || "—"}</span><span><UserRound size={15} /> {lesson.teacher}</span></span>
              </button>
            </div>;
          })}
        </div>;
      })}
    </section>
    {opened && <LessonDialog lesson={opened} deadlines={deadlines} mapUrl={mapUrl} onClose={() => setOpenedId(null)} />}
  </>;
}

function Deadlines({ items, day, href }: { items: DashboardData["deadlines"]; day: string; href?: string }) {
  const future = items.filter((item) => campusDay(new Date(item.dueAt)) >= day && !item.completedAt);
  const rows = href ? future.slice(0, 3) : items;
  const tomorrow = campusDay(plusDays(day, 1));
  return <section className="panel deadlines">
    <div className="section-head"><div className="heading-with-icon"><span className="soft-icon"><Bell size={20} /></span><div><h2>{href ? "Ближайшие дедлайны" : "Контрольные точки"}</h2><p className="muted">{href ? "До трёх ближайших работ" : "Сроки сдачи работ"}</p></div></div></div>
    {rows.length ? <ul className="deadline-list">{rows.map((item) => {
      const date = new Date(item.dueAt);
      const key = campusDay(date);
      const done = Boolean(item.completedAt);
      return <li className={done ? "done" : undefined} key={item.id}><span className={"dot" + (done ? " done" : key <= tomorrow ? " urgent" : "")} /><div><h3>{item.title}</h3><p className="muted">{item.course}</p></div>
        <span className={"deadline-date" + (done ? "" : key <= tomorrow ? " urgent-text" : "")}>{done ? "Выполнено" : key === day ? "Сегодня" : key === tomorrow ? "Завтра" : dateLabel(date)}{!done && !href && <small>{timeLabel(date)}</small>}</span></li>;
    })}</ul> : <Empty>Дедлайнов пока нет</Empty>}
    {href && <Link className="text-link" href={href}>Открыть календарь <ArrowRight size={16} /></Link>}
  </section>;
}

function News({ items }: { items: DashboardData["news"] }) {
  const unread = items.filter((item) => item.readAt === null).length;
  return <section className="panel news">
    <div className="section-head"><div className="heading-with-icon"><span className="soft-icon"><Megaphone size={20} /></span><div><h2>Уведомления и новости</h2><p className="muted">{unread ? unread + " новых" : "Объявления учебного офиса"}</p></div></div>
      {unread > 0 && <form action={markNotificationsRead}><Button variant="secondary" aria-label="Отметить прочитанными"><CheckCheck size={16} /> Отметить прочитанными</Button></form>}</div>
    {items.length ? <div className="news-list">{items.map((item) => <article key={item.id} className={item.readAt === null ? "unread" : undefined}><h3>{item.title}{item.readAt === null && <span className="unread-dot" aria-label="Новое" />}</h3><p className="muted message-body">{item.body}</p></article>)}</div> : <Empty>Новостей пока нет</Empty>}
  </section>;
}

function Grades({ grades }: { grades: DashboardData["grades"] }) {
  const terms = [...new Set(grades.map((grade) => grade.term))].sort((left, right) => right - left);
  const [view, setView] = useState(() => (terms.length ? String(terms[0]) : "all"));
  const all = view === "all";
  const rows = all ? grades : grades.filter((grade) => String(grade.term) === view);
  const currentTerm = terms[0] ?? 0;
  const pastTerms = terms.filter((term) => term < currentTerm);
  const meta = (grade: DashboardData["grades"][number]) => (grade.assessment ? assessments[grade.assessment] : null);
  const graded = grades.filter((grade) => pastTerms.includes(grade.term) && grade.assessment !== "TEST" && grade.finalGrade !== null && grade.finalGrade >= 2 && grade.finalGrade <= 5);
  const average = graded.length ? (graded.reduce((sum, grade) => sum + (grade.finalGrade ?? 0), 0) / graded.length).toFixed(1) : null;
  return <div className="content-stack">
    <section className="panel">
      <div className="section-head"><div><h2>Дисциплины</h2><p className="muted">{grades.length ? (all ? "Все семестры" : "Семестр " + view) + " · " + countLabel(rows.length, ["дисциплина", "дисциплины", "дисциплин"]) : "Баллы по дисциплинам"}</p></div>
        <select className="select-control" aria-label="Семестр" value={view} onChange={(event) => setView(event.target.value)} disabled={!grades.length}>
          {terms.map((value) => <option key={value} value={String(value)}>Семестр {value}</option>)}
          <option value="all">Вся учёба</option>
        </select></div>
      {rows.length === 0 && <Empty>Оценок пока нет</Empty>}
      {rows.map((grade) => {
        const left = Math.max(0, grade.threshold - grade.score);
        const type = meta(grade);
        return <article className="grade" key={grade.id}>
          <div><h3>{grade.title} {type && <span className={"pill " + type.className}>{type.label}</span>}</h3><strong>{grade.score} / {grade.threshold}</strong></div>
          <progress aria-label={grade.title} max={Math.max(1, grade.threshold)} value={Math.max(0, Math.min(grade.score, grade.threshold))} />
          <p className="muted">{left ? "До порога " + left + " балл." : "Порог достигнут"}{all && " · Семестр " + grade.term}</p>
          <p className="grade-final-label">Итог: <strong>{finalGradeLabel(grade)}</strong></p>
        </article>;
      })}
    </section>
    {pastTerms.length > 0 && <section className="panel" aria-labelledby="grade-history-title">
      <div className="section-head"><div><h2 id="grade-history-title">Итоги прошлых семестров</h2><p className="muted">Вид аттестации и итоговая оценка{average ? " · средний балл " + average : ""}</p></div></div>
      {pastTerms.map((term) => <div key={term} className="grade-history">
        <h3 className="day-heading">Семестр {term}</h3>
        {grades.filter((grade) => grade.term === term).map((grade) => {
          const type = meta(grade);
          return <div className="grade-history-row" key={grade.id}>
            <span className="grade-history-title">{grade.title}</span>
            {type && <span className={"pill " + type.className}>{type.label}</span>}
            <strong>{finalGradeLabel(grade)}</strong>
          </div>;
        })}
      </div>)}
    </section>}
  </div>;
}

function Services({ demo, requests }: { demo: boolean; requests: DashboardData["requests"] }) {
  const [choice, setChoice] = useState<RequestType>();
  const [local, setLocal] = useState<DashboardData["requests"]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, run] = useTransition();
  const [openedId, setOpenedId] = useState<string | null>(null);
  const lastRequest = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (!openedId) lastRequest.current?.focus(); }, [openedId]);
  useEffect(() => {
    if (!demo) return;
    try {
      const raw = JSON.parse(localStorage.getItem("dekanat-demo-requests") ?? "[]") as DashboardData["requests"];
      setLocal(raw.map((item, index) => ({
        ...item,
        number: item.number ?? "З-2026-" + String(1000 + index + 1),
        updatedAt: item.updatedAt ?? item.createdAt,
        comment: item.comment ?? null,
      })));
    } catch {}
  }, [demo]);
  const rows = demo ? local : requests;
  const opened = openedId ? rows.find((request) => request.id === openedId) : undefined;

  function submit(type: RequestType) {
    setError("");
    setMessage("");
    run(async () => {
      try {
        if (demo) {
          const now = new Date().toISOString();
          const next: DashboardData["requests"] = [{ id: crypto.randomUUID(), number: "З-2026-" + String(1000 + local.length + 1), type, status: "NEW", createdAt: now, updatedAt: now, comment: null, readyBy: null }, ...local];
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
    <section className="panel"><h2>Справки и обращения</h2><div className="service-list">
      {(Object.keys(services) as RequestType[]).map((type) => <button className="service-item" key={type} onClick={() => { setChoice(type); setError(""); setMessage(""); }}><span className="soft-icon"><FileText size={19} /></span><strong>{services[type]}</strong><ChevronRight size={18} /></button>)}
    </div></section>
    <section className="panel"><h2>Мои заявки</h2>
      {message && <p className="muted" role="status">{message}</p>}
      {!choice && error && <p className="form-error" role="alert">{error}</p>}
      {rows.length === 0 && <Empty>Заявок пока нет</Empty>}
      {rows.map((request) => <button type="button" className="request-row request-card" key={request.id} aria-haspopup="dialog" onClick={(event) => { lastRequest.current = event.currentTarget; setOpenedId(request.id); }}>
        <span className="request-main"><span className="request-title" role="heading" aria-level={3}>{services[request.type]}</span><span className="muted">{request.number} · {dateLabel(new Date(request.createdAt))}</span></span>
        <span className={"pill " + requestStatusClass[request.status]}>{statuses[request.status]}</span>
        {(request.comment || request.readyBy) && <span className="request-note message-body">{request.comment}{request.readyBy && <><br />Срок готовности: {dateLabel(new Date(request.readyBy))}</>}</span>}
        <ChevronRight size={18} />
      </button>)}
    </section>
    {choice && <Sheet id="request-confirm" labelledBy="confirm-title" onClose={() => { if (!pending) setChoice(undefined); }}>
      <div className="panel sheet-panel">
        <div className="sheet-head"><h2 id="confirm-title">{services[choice]}</h2></div>
        <p className="muted">Заявка появится в списке со статусом «Новая».</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions"><Button variant="secondary" disabled={pending} onClick={() => setChoice(undefined)}>Отмена</Button><Button autoFocus disabled={pending} onClick={() => submit(choice)}>{pending ? "Отправляем…" : "Подать заявку"}</Button></div>
      </div>
    </Sheet>}
    {opened && <RequestDialog request={opened} onClose={() => setOpenedId(null)} />}
  </div>;
}

export function Dashboard({ tab, day, data, role, name, monitor = false, streak, demo = false, initialRoom }: {
  tab: Tab; day: string; data: DashboardData; role: "STUDENT" | "STAFF"; name: string; monitor?: boolean; streak?: { count: number; waiting: boolean }; demo?: boolean; initialRoom?: string;
}) {
  const [menu, setMenu] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  const base = demo ? "/demo/" : "/cabinet/";
  const nav = (className: string) => <nav className={className} aria-label="Основные разделы">{navigation.filter((item) => !(demo && item.id === "profile")).map(({ id, title, icon: Icon }) =>
    <Link key={id} href={base + id} aria-current={tab === id ? "page" : undefined}><Icon size={21} /><span>{title}</span></Link>)}</nav>;
  const title = { today: "Сегодня", grades: "Успеваемость", services: "Сервисы деканата", map: "Карта кампуса", calendar: "Календарь дедлайнов", profile: "Профиль" }[tab];

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
        {monitor && <Link className="text-link" href="/attendance">Журнал старосты</Link>}<div className="theme-setting">Тема интерфейса <ThemeToggle /></div>
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
      {!demo && (tab === "services" || tab === "profile" || tab === "today") && <div className="campus-shortcuts">
        {tab === "today" && streak && <section className="panel">
          <h2>Серия посещений</h2><strong>Дней подряд: {streak.count}</strong>
          {streak.waiting && <p className="muted">Серия ждёт отметок за ближайший незакрытый день.</p>}
        </section>}
        {tab === "today" && <Link className="panel route-link" href="/campus-tools?tab=booking&window=1"><div><h2>Свободные окна</h2><p className="muted">Консультации, спортзал и другие занятия между парами</p></div><ArrowRight size={18} /></Link>}
        {tab === "services" && <Link className="panel route-link" href="/campus-tools"><div><h2>Кампус и сервисы</h2><p className="muted">Пересдачи, консультации, бронирование, библиотека и объявления</p></div><ArrowRight size={18} /></Link>}
        {tab === "profile" && <div className="campus-nav">
          <Link className="button button-secondary" href="/campus-tools?tab=profile">Пропуск и ударение</Link>
          <Link className="button button-secondary" href="/campus-tools?tab=portfolio">Портфолио</Link>
        </div>}
      </div>}
      {tab === "today" && <div className="content-stack">
        <div className="dashboard-grid">
          <Schedule lessons={data.lessons} deadlines={data.deadlines} day={day} mapUrl={base + "map"} icsUrl={demo ? undefined : "/api/schedule"} />
          <div className="content-stack"><Deadlines items={data.deadlines} day={day} href={base + "calendar"} />
            <Link className="panel route-link" href={base + "map"}><span className="soft-icon"><Route size={22} /></span><div><h2>Найти аудиторию</h2><p className="muted">Маршрут по кампусу</p></div><ArrowDownRight size={19} /></Link>
          </div>
        </div>
        <News items={data.news} />
      </div>}
      {tab === "grades" && <Grades grades={data.grades} />}
      {tab === "profile" && <ProfileView />}
      {tab === "services" && <Services requests={data.requests} demo={demo} />}
      {tab === "map" && <Campus key={initialRoom ?? "campus"} lessons={data.lessons} initialRoom={initialRoom} />}
      {tab === "calendar" && <div className="content-stack">
        <div className="dashboard-grid campus-grid"><DeadlineCalendar day={day} items={data.deadlines} selected={selectedDay} onSelect={setSelectedDay} /><Deadlines items={selectedDay ? data.deadlines.filter((item) => campusDay(new Date(item.dueAt)) === selectedDay) : data.deadlines} day={day} /></div>
        <News items={data.news} />
      </div>}
    </main></div>
    {nav("bottom-nav")}
  </div>;
}