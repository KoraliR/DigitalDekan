import { displayStudent } from "@/lib/campus-tools";
import { StaffRequestForm } from "@/components/staff-request-form";
import { ArrowUpRight, BellRing, CalendarPlus, ChevronRight, Filter, Inbox, Megaphone, Plus, Send, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import { StaffCalendar } from "@/components/staff-calendar";
import { GroupRoster } from "@/components/group-roster";
import { groupAttendance } from "@/app/attendance/actions";
import { DeadlineRoster } from "@/components/deadline-roster";
import { AudiencePicker, GroupSearch } from "@/components/group-search";
import { GradeFields, GradeRegister } from "@/components/grade-register";
import Link from "next/link";
import { StaffShell } from "@/components/staff-shell";
import { Prisma, RequestStatus, RequestType } from "@prisma/client";
import { account, staffGroups, staffStudents } from "@/lib/access";
import { db } from "@/lib/db";
import { campusDay, dateLabel, plusDays, lessonTypes, services, statuses, timeLabel } from "@/lib/model";
import { newsAudienceLabel, newsKindClass, newsKindLabel } from "@/lib/news";
import { createDeadline, deleteNews, publish, saveGrade, saveLesson } from "./actions";
import { Button } from "@/components/ui/button";

const sections = {
  overview: "Обзор",
  requests: "Заявки",
  news: "Объявления",
  schedule: "Расписание",
  attendance: "Посещение",
  deadlines: "Дедлайны",
  grades: "Оценки",
  audit: "Аудит",
};
const lessonTypeOptions = Object.entries(lessonTypes);
const dateTime = (date: Date) => campusDay(date) + "T" + timeLabel(date);

export default async function Staff({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await account("STAFF");
  const params = await searchParams;
  const section = Object.keys(sections).find((key) => key === params.section) ?? "overview";
  const scope = staffStudents(user.id);
  const groups = await db.studyGroup.findMany({ where: staffGroups(user.id), orderBy: { name: "asc" } });
  const groupId = groups.find(({ id }) => id === params.group)?.id;
  const status = Object.values(RequestStatus).find((value) => value === params.status);
  const type = Object.values(RequestType).find((value) => value === params.type);
  const requestQuery = typeof params.q === "string" ? params.q.trim().slice(0, 40) : "";
  const showOverdue = params.overdue === "1" || params.category === "overdue";
  const pendingOnly = params.pending === "1";
  const active = { user: scope, status: { in: [RequestStatus.NEW, RequestStatus.PROCESSING] } };
  const now = new Date();
  const today = campusDay(now);
  const deadlineSince = new Date(+now - 60 * 86400000);
  const attendanceDate = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && Number.isFinite(Date.parse(params.date)) ? params.date : today;
  const requestWhere: Prisma.ServiceRequestWhereInput = {
    user: staffStudents(user.id, groupId),
    ...(type ? { type } : {}),
    ...(showOverdue
      ? { status: status ?? { in: [RequestStatus.NEW, RequestStatus.PROCESSING] }, readyBy: { lt: now } }
      : status ? { status } : {}),
    ...(requestQuery ? { OR: [{ number: { contains: requestQuery, mode: "insensitive" } }, { id: { startsWith: requestQuery } }] } : {}),
  };
  const [newCount, overdueCount, deadlines, requests, lessons, students, audit, groupDeadlines, inboxRequests, inboxLessons, newsList] = await Promise.all([
    section === "overview" ? db.serviceRequest.count({ where: { user: scope, status: "NEW" } }) : 0,
    section === "overview" ? db.serviceRequest.count({ where: { ...active, readyBy: { lt: now } } }) : 0,
    section === "overview" ? db.deadline.findMany({ where: { user: scope, dueAt: { gte: now } }, distinct: ["title", "course", "dueAt"], orderBy: { dueAt: "asc" }, take: 5 }) : [],
    section === "requests" ? db.serviceRequest.findMany({
      where: requestWhere,
      include: { user: { select: { name: true, studentProfile: { select: { surnameStress: true, group: { select: { name: true } } } } } } },
      orderBy: { createdAt: "desc" },
    }) : [],
    ["schedule", "attendance"].includes(section) ? db.groupLesson.findMany({ where: { group: staffGroups(user.id) }, include: { group: true }, orderBy: { startsAt: "asc" } }) : [],
    section === "grades" ? db.user.findMany({
      where: staffStudents(user.id, groupId), orderBy: { name: "asc" },
      select: { id: true, name: true, studentProfile: { select: { groupId: true, surnameStress: true } }, grades: { orderBy: [{ term: "desc" }, { title: "asc" }] } },
    }) : [],
    section === "audit" ? db.auditEntry.findMany({
      // Показываем и групповые записи, и общие действия (например, объявление для всех групп).
      where: { OR: [{ groupId: { in: groups.map(({ id }) => id) } }, { groupId: null }] },
      include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100,
    }) : [],
    section === "deadlines" ? db.deadline.findMany({
      where: { user: staffStudents(user.id, groupId), dueAt: { gte: deadlineSince } },
      include: { user: { select: { name: true, studentProfile: { select: { surnameStress: true, group: { select: { name: true } } } } } } },
      orderBy: [{ dueAt: "asc" }, { title: "asc" }], take: 300,
    }) : [],
    section === "overview" ? db.serviceRequest.findMany({
      where: { ...active, OR: [{ status: "NEW" }, { readyBy: { lt: now } }] },
      orderBy: [{ readyBy: "asc" }, { createdAt: "desc" }], take: 6,
      select: { id: true, number: true, type: true, readyBy: true, user: { select: { name: true, studentProfile: { select: { surnameStress: true } } } } },
    }) : [],
    section === "overview" ? db.groupLesson.findMany({
      where: { group: { ...staffGroups(user.id), students: { some: { user: { role: "STUDENT" } } } },
        startsAt: { gte: new Date(today + "T00:00:00+03:00"), lt: new Date(+plusDays(today, 1) - 12 * 60 * 60 * 1000) },
        marks: { none: {} },
      },
      select: { id: true, title: true, startsAt: true, groupId: true, group: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
    }) : [],
    section === "news" ? db.news.findMany({
      orderBy: { createdAt: "desc" }, take: 100,
      include: { author: { select: { name: true } } },
    }) : [],
  ]);
  const groupOptions = groups.map(({ id, name }) => <option key={id} value={id}>{name}</option>);
  const newsAudience = (audience: string) => newsAudienceLabel(audience, groups.map(({ id, name }) => ({ id, name })));
  const scheduleDays = [...new Set(lessons.filter((lesson) => !groupId || lesson.groupId === groupId).map((lesson) => campusDay(lesson.startsAt)))];
  type DeadlineBlock = { key: string; title: string; course: string; dueAt: Date; rows: { id: string; student: string; group: string; completed: boolean }[] };
  const deadlineBlocks = [...groupDeadlines.reduce((blocks, deadline) => {
    const key = JSON.stringify([deadline.title, deadline.course, deadline.dueAt.toISOString()]);
    const row = {
      id: deadline.id,
      student: displayStudent(deadline.user.name, deadline.user.studentProfile?.surnameStress),
      group: deadline.user.studentProfile?.group?.name ?? "",
      completed: Boolean(deadline.completedAt),
    };
    const block = blocks.get(key);
    if (block) block.rows.push(row);
    else blocks.set(key, { key, title: deadline.title, course: deadline.course, dueAt: deadline.dueAt, rows: [row] });
    return blocks;
  }, new Map<string, DeadlineBlock>()).values()].filter((block) => !pendingOnly || block.rows.some((row) => !row.completed));

  const subjects = [...new Map(students.flatMap((student) => student.grades.map(({ title, term }) => [
    JSON.stringify([title, term]), { title, term },
  ] as const))).values()].sort((a, b) => a.title.localeCompare(b.title, "ru") || b.term - a.term);
  const subject = subjects.find(({ title, term }) => title === params.subject && String(term) === params.term);
  const gradeNumber = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
  function gradeUrl(item?: { title: string; term: number }) {
    const query = new URLSearchParams({ section: "grades" });
    if (groupId) query.set("group", groupId);
    if (item) { query.set("subject", item.title); query.set("term", String(item.term)); }
    return "/staff?" + query;
  }

  const dayLessons = lessons.filter((lesson) => campusDay(lesson.startsAt) === attendanceDate && (!groupId || groupId === lesson.groupId));
  const selectedLesson = dayLessons.find((lesson) => lesson.id === params.lesson);
  const roster = selectedLesson ? await db.user.findMany({
    where: staffStudents(user.id, selectedLesson.groupId), orderBy: { name: "asc" },
    select: { id: true, name: true, studentProfile: { select: { isMonitor: true, surnameStress: true } }, groupMarks: { where: { lessonId: selectedLesson.id } } },
  }) : [];
  const qr = selectedLesson ? await db.attendanceQr.findFirst({ where: { lessonId: selectedLesson.id, expiresAt: { gt: now } } }) : null;
  const qrLink = qr ? new URL("/attendance/check?token=" + qr.token, process.env.PUBLIC_ATTENDANCE_URL || process.env.AUTH_URL || "http://localhost:3000").href : "";
  const qrImage = qrLink ? await QRCode.toDataURL(qrLink, { width: 240 }) : "";

  return <StaffShell name={user.name} section={section}>
    {!groups.length && <p className="empty">За вашим аккаунтом пока не закреплены группы.</p>}
    {params.saved === "1" && <p className="notice" role="status">Изменения сохранены</p>}
    {typeof params.error === "string" && <p className="form-error" role="alert">{params.error}</p>}

    {section === "overview" && <div className="content-stack">
      <div className="staff-metrics">
        <Link className="panel" href="/staff?section=requests&status=NEW"><strong>{newCount}</strong><span>Новые заявки</span></Link>
        <Link className="panel" href="/staff?section=requests&overdue=1"><strong>{overdueCount}</strong><span>Просроченные заявки</span></Link>
      </div>
      <section className="panel staff-inbox">
        <h2><Inbox size={20} aria-hidden="true" /> Входящие</h2>
        {!inboxRequests.length && !inboxLessons.length && !deadlines.length && <p className="empty">На сейчас задач нет</p>}
        {inboxRequests.map((item) => <Link key={item.id} className="staff-inbox-item" href={"/staff?" + new URLSearchParams({ section: "requests", request: item.id })}>
          <BellRing size={18} aria-hidden="true" /><span><strong>{services[item.type]} · {item.user.name}</strong><small>{item.readyBy && item.readyBy < now ? "Просрочена · " + dateLabel(item.readyBy) : "Новая заявка"}{item.number && " · " + item.number}</small></span><ChevronRight size={17} aria-hidden="true" />
        </Link>)}
        {inboxLessons.map((lesson) => <Link key={lesson.id} className="staff-inbox-item" href={"/staff?" + new URLSearchParams({ section: "attendance", date: today, lesson: lesson.id, group: lesson.groupId })}>
          <CalendarPlus size={18} aria-hidden="true" /><span><strong>{lesson.title} · {lesson.group.name}</strong><small>Сегодня, {timeLabel(lesson.startsAt)} · без отметок</small></span><ChevronRight size={17} aria-hidden="true" />
        </Link>)}
        {deadlines.map((item) => <Link key={item.id} className="staff-inbox-item" href={"/staff?section=deadlines#deadline-" + item.id}>
          <BellRing size={18} aria-hidden="true" /><span><strong>{item.title} · {item.course}</strong><small>Дедлайн · {dateLabel(item.dueAt)}</small></span><ChevronRight size={17} aria-hidden="true" />
        </Link>)}
      </section>
      <div className="top-actions"><Button asChild><Link href="/staff?section=news"><Megaphone size={17} /> Опубликовать объявление</Link></Button>
        <Button asChild variant="secondary"><Link href="/staff?section=schedule"><Plus size={17} /> Добавить занятие</Link></Button></div>
    </div>}

    {section === "requests" && <section className="panel">
      <div className="staff-panel-head">
        <h2>{showOverdue ? "Просроченные заявки" : "Заявки студентов"}</h2>
        {showOverdue && <Link className="text-link" href="/staff?section=requests">Все заявки</Link>}
      </div>
      <form className="staff-fields staff-filters" aria-label="Фильтр заявок">
        <input type="hidden" name="section" value="requests" />
        <label>Номер заявки<input type="search" name="q" defaultValue={requestQuery} placeholder="З-2026-1000" maxLength={40} /></label>
        <label>Статус<select name="status" defaultValue={status ?? ""}><option value="">Все статусы</option>{Object.entries(statuses).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <label>Тип<select name="type" defaultValue={type ?? ""}><option value="">Все типы</option>{Object.entries(services).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <GroupSearch name="group" groups={groups} defaultValue={groupId} />
        <label>Категория<select name="category" defaultValue={showOverdue ? "overdue" : ""}><option value="">Все заявки</option><option value="overdue">Просроченные заявки</option></select></label>
        <div className="staff-filter-actions">
          <Button variant="secondary"><Filter size={16} /> Найти</Button>
          <Button asChild variant="secondary"><Link href="/staff?section=requests">Сбросить</Link></Button>
        </div>
      </form>
      {!requests.length && <p className="empty">Заявок по этим условиям нет</p>}
      {requests.length > 0 && <p className="staff-result-count" role="status">Найдено: <strong>{requests.length}</strong></p>}
      {requests.map((request) => <details className="staff-row" key={request.id} open={params.request === request.id || undefined}><summary>
        <strong>{request.number ?? "№ " + request.id.slice(0, 8)}</strong> · {services[request.type]} · {statuses[request.status]}<br />
        <span className="muted">{displayStudent(request.user.name, request.user.studentProfile?.surnameStress)} · {request.user.studentProfile?.group?.name} · {dateLabel(request.createdAt)}</span>
      </summary><StaffRequestForm key={request.revision} id={request.id} revision={request.revision} status={request.status}
        comment={request.comment ?? ""} readyBy={request.readyBy ? campusDay(request.readyBy) : ""} /></details>)}
    </section>}

    {section === "news" && <div className="content-stack">
      <section className="panel"><h2>Новое объявление</h2><form className="staff-fields" action={publish}>
        <label>Формат<select name="kind"><option value="news">Новость</option><option value="reminder">Напоминание</option></select></label>
        <AudiencePicker groups={groups.map(({ id, name }) => ({ id, name }))}
          faculties={[...new Set(groups.map(({ faculty }) => faculty))]}
          courses={[...new Set(groups.map(({ course }) => course))]}
          defaultValue={groupId ? "group:" + groupId : "all"} />
        <label className="staff-wide">Заголовок<input name="title" maxLength={120} required /></label>
        <label className="staff-wide">Текст<textarea name="body" maxLength={2000} required /></label>
        <Button disabled={!groups.length}><Send size={16} /> Опубликовать</Button>
      </form></section>
      <section className="panel">
        <h2>Опубликованные новости</h2>
        <p className="muted">Новость видят только студенты выбранной аудитории, в кабинете она открывается отдельной страницей.</p>
        {!newsList.length && <p className="empty">Новостей пока нет</p>}
        {newsList.map((news) => <details className="staff-row news-admin" key={news.id}>
          <summary>
            <span className={"pill " + newsKindClass(news.kind)}>{newsKindLabel(news.kind)}</span>
            {" "}<strong>{news.title}</strong>
            <span className="muted"> · {newsAudience(news.audience)} · {dateLabel(news.createdAt)}{news.author ? " · " + news.author.name : ""}</span>
          </summary>
          <div className="news-admin-body">
            <p className="message-body">{news.body}</p>
            <form action={deleteNews} className="staff-button-row">
              <input type="hidden" name="id" value={news.id} />
              <Button variant="danger"><Trash2 size={16} /> Удалить новость</Button>
            </form>
          </div>
        </details>)}
      </section>
    </div>}

    {section === "schedule" && <div className="content-stack">
      <section className="panel">
        <h2>Расписание групп</h2>
        <form className="staff-fields staff-filters" aria-label="Фильтр расписания">
          <input type="hidden" name="section" value="schedule" />
          <GroupSearch name="group" groups={groups} defaultValue={groupId} />
          <label>Дата<input type="date" name="date" defaultValue={attendanceDate} /></label>
          <div className="staff-filter-actions">
            <Button variant="secondary">Показать занятия</Button>
            <Button asChild variant="secondary"><Link href="/staff?section=schedule">Сбросить</Link></Button>
          </div>
        </form>
      </section>
      <StaffCalendar today={today} date={attendanceDate} days={scheduleDays} group={groupId} />
      <section className="panel"><h2>Добавить занятие · {dateLabel(new Date(attendanceDate + "T12:00:00+03:00"), true)}</h2><form className="staff-fields" action={saveLesson}>
      <label>Группа занятия<select name="group" required defaultValue={groupId ?? undefined}>{groupOptions}</select></label>
      <label>Тип<select name="type">{lessonTypeOptions.map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
      <label>Дисциплина<input name="title" maxLength={120} required /></label>
      <label>Преподаватель<input name="teacher" maxLength={100} required /></label>
      <label>Аудитория<input name="room" maxLength={30} required /></label>
      <label>Корпус<input name="campus" maxLength={120} placeholder="необязательно" /></label>
      <label className="staff-wide">Комментарий для студентов<textarea name="comment" maxLength={1000} rows={3} placeholder="Например, что подготовить к паре" /></label>
      <label>Начало (МСК)<input type="datetime-local" name="startsAt" key={"start-" + attendanceDate} defaultValue={attendanceDate + "T09:00"} required /></label>
      <label>Окончание (МСК)<input type="datetime-local" name="endsAt" key={"end-" + attendanceDate} defaultValue={attendanceDate + "T10:30"} required /></label>
      <Button disabled={!groups.length}>Добавить и уведомить</Button>
    </form></section><section className="panel"><h2>Занятия групп</h2>
      {!dayLessons.length && <p className="empty">Занятий пока нет</p>}
      {dayLessons.map((lesson) => <details className="staff-row" key={lesson.id}><summary>{lesson.group.name} · {lesson.title} · {dateLabel(lesson.startsAt)}, {timeLabel(lesson.startsAt)}</summary>
        <form className="staff-fields" action={saveLesson}><input type="hidden" name="id" value={lesson.id} />
          <label>Тип<select name="type" defaultValue={lesson.type}>{lessonTypeOptions.map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
          <label>Дисциплина<input name="title" maxLength={120} defaultValue={lesson.title} /></label>
          <label>Преподаватель<input name="teacher" maxLength={100} defaultValue={lesson.teacher} /></label>
          <label>Аудитория<input name="room" maxLength={30} defaultValue={lesson.room} /></label>
          <label>Корпус<input name="campus" maxLength={120} defaultValue={lesson.campus ?? ""} /></label>
          <label className="staff-wide">Комментарий для студентов<textarea name="comment" maxLength={1000} rows={3} defaultValue={lesson.comment ?? ""} /></label>
          <label>Новое начало (МСК)<input type="datetime-local" name="startsAt" defaultValue={dateTime(lesson.startsAt)} required /></label>
          <label>Новое окончание (МСК)<input type="datetime-local" name="endsAt" defaultValue={dateTime(lesson.endsAt)} required /></label>
          <Button>Сохранить занятие</Button>
        </form></details>)}
    </section></div>}

    {section === "attendance" && <div className="content-stack"><section className="panel"><h2>Посещаемость</h2>
      <form className="staff-fields staff-filters" aria-label="Фильтр посещаемости">
        <input type="hidden" name="section" value="attendance" />
        <GroupSearch name="group" groups={groups} defaultValue={groupId} />
        <label>Дата<input type="date" name="date" defaultValue={attendanceDate} /></label>
        <div className="staff-filter-actions">
          <Button variant="secondary">Показать занятия</Button>
          <Button asChild variant="secondary"><Link href="/staff?section=attendance">Сбросить</Link></Button>
        </div>
      </form>
      {groupId && <p className="staff-back-links"><Link className="text-link" href="/staff?section=attendance">← Ко всем группам</Link><span className="muted">Назад в посещение без фильтра группы</span></p>}
      {selectedLesson && <p className="staff-back-links"><Link className="text-link" href={"/staff?" + new URLSearchParams({ section: "attendance", group: selectedLesson.groupId, date: attendanceDate })}>← К списку пар группы</Link></p>}
      <div className="service-list">{dayLessons.map((lesson) => <Link className="service-item" aria-current={lesson.id === selectedLesson?.id ? "page" : undefined} key={lesson.id}
        href={"/staff?" + new URLSearchParams({ section: "attendance", date: attendanceDate, group: lesson.groupId, lesson: lesson.id })}>
        {timeLabel(lesson.startsAt)} · {lesson.title} · {lesson.group.name}
      </Link>)}</div>
      {selectedLesson && <section className="content-stack">
        <h3>{selectedLesson.title} · {selectedLesson.group.name}</h3>
        <GroupRoster showSummary={params.saved === "1"} key={selectedLesson.id} id={selectedLesson.id} students={roster.map((student) => ({ ...student, name: displayStudent(student.name, student.studentProfile?.surnameStress), status: student.groupMarks[0]?.status }))} />
        <form className="staff-fields" action={groupAttendance}>
          <input type="hidden" name="lesson" value={selectedLesson.id} /><input type="hidden" name="command" value="monitor" />
          <label>Студент, отмечающий посещаемость<select name="student" defaultValue={roster.find((student) => student.studentProfile?.isMonitor)?.id ?? ""}>
            <option value="">Без доступа к отметкам</option>
            {roster.map((student) => <option value={student.id} key={student.id}>{displayStudent(student.name, student.studentProfile?.surnameStress)}</option>)}
          </select><small className="muted">Этот студент сможет отмечать посещаемость группы за всех студентов.</small></label>
          <Button variant="secondary">Сохранить отмечающего</Button>
        </form>
        <form action={groupAttendance} className="top-actions">
          <input type="hidden" name="lesson" value={selectedLesson.id} />
          <Button name="command" value="qr">{qr ? "Обновить QR-код" : "Показать QR-код"}</Button>
          {qr && <Button variant="secondary" name="command" value="close">Закрыть отметку</Button>}
        </form>
        {qr && <div><img src={qrImage} width={240} height={240} alt="QR-код для отметки присутствия" />
          <p>До {timeLabel(qr.expiresAt)} МСК · <Link href={qrLink}>Открыть ссылку отметки</Link></p></div>}
      </section>}
      {!dayLessons.length && <p className="empty">На эту дату занятий нет</p>}
    </section></div>}

    {section === "deadlines" && <div className="content-stack">
      <section className="panel"><h2>Новый дедлайн</h2><form className="staff-fields" action={createDeadline}>
        <label>Группа студентов<select name="group" required>{groupOptions}</select></label>
        <label>Дисциплина<input name="course" maxLength={120} required /></label>
        <label>Работа<input name="title" maxLength={120} required /></label>
        <label>Срок<input type="date" name="dueAt" required /></label>
        <Button disabled={!groups.length}>Добавить и уведомить</Button>
      </form></section>
      <section className="panel"><h2>Дедлайны групп</h2>
        <p className="muted">Работы за последние 60 дней и предстоящие. Отметьте сдавших вручную — отметка сохраняется по каждому студенту отдельно.</p>
        <form className="staff-fields staff-filters" aria-label="Фильтр дедлайнов">
          <input type="hidden" name="section" value="deadlines" />
          <GroupSearch name="group" groups={groups} defaultValue={groupId} />
          <label className="staff-check"><input type="checkbox" name="pending" value="1" defaultChecked={pendingOnly} /> Только не сданные</label>
          <div className="staff-filter-actions">
            <Button variant="secondary"><Filter size={16} /> Применить фильтр</Button>
            <Button asChild variant="secondary"><Link href="/staff?section=deadlines">Сбросить</Link></Button>
          </div>
        </form>
        {!deadlineBlocks.length && <p className="empty">Дедлайнов по этим условиям нет</p>}
        {deadlineBlocks.map((block) => <DeadlineRoster key={block.key} title={block.title} course={block.course}
          dueLabel={dateLabel(block.dueAt)} late={block.dueAt < now && block.rows.some((row) => !row.completed)}
          group={groupId ?? ""} pendingOnly={pendingOnly} rows={block.rows} />)}
      </section>
    </div>}

    {section === "grades" && <section className="panel">
      <h2>Журнал оценок</h2>
      <form className="staff-fields staff-filters" aria-label="Фильтр оценок">
        <input type="hidden" name="section" value="grades" />
        {subject && <><input type="hidden" name="subject" value={subject.title} /><input type="hidden" name="term" value={subject.term} /></>}
        <GroupSearch name="group" groups={groups} defaultValue={groupId} />
        <div className="staff-filter-actions">
          <Button variant="secondary">Показать</Button>
          <Button asChild variant="secondary"><Link href="/staff?section=grades">Сбросить</Link></Button>
        </div>
      </form>
      <section aria-label="Средний балл групп" className="content-stack">
        <h3>{subject ? "Средний балл по предмету" : "Средний балл по группам"}</h3>
        {groups.filter((group) => !groupId || group.id === groupId).map((group) => {
          const groupStudents = students.filter((student) => student.studentProfile?.groupId === group.id);

          const matches = (grade: (typeof students)[number]["grades"][number]) => !subject || (grade.title === subject.title && grade.term === subject.term);
          const grades = groupStudents.flatMap((student) => student.grades.filter(matches));
          const gradedCount = groupStudents.filter((student) => student.grades.some(matches)).length;
          const belowCount = groupStudents.filter((student) => student.grades.some((grade) => matches(grade) && grade.score < grade.threshold)).length;
          const score = grades.reduce((sum, grade) => sum + grade.score, 0);
          const threshold = grades.reduce((sum, grade) => sum + grade.threshold, 0);
          const low = grades.length > 0 && score < threshold;
          const average = grades.length ? score / grades.length : 0;
          const passMark = grades.length ? threshold / grades.length : 0;
          return <div key={group.id} className={low ? "group-grade group-grade-low" : "group-grade"}>
            <div className="group-grade-heading">
              <strong>{group.name}</strong>
              {grades.length > 0 && <strong>{gradeNumber.format(average)} <span className="muted">из 100</span></strong>}
            </div>
            {grades.length ? <>
              <div className="group-grade-scale" style={{ "--pass-mark": passMark + "%" } as React.CSSProperties}>
                <meter min={0} max={100} value={average} aria-label={"Средний балл · " + group.name} aria-valuetext={gradeNumber.format(average) + " из 100"} />
                <span className="group-grade-marker" aria-hidden="true" />
              </div>
              <div className="group-grade-caption muted">
                <span>Средний порог: {gradeNumber.format(passMark)}</span>
                {low && <strong>Ниже порога</strong>}
              </div>
            </> : <p className="muted">Оценок пока нет</p>}
            <div className="group-grade-caption">
              <p className="muted">Оценены {gradedCount} из {groupStudents.length} · Ниже порога: {belowCount}</p>
              <Button asChild variant="secondary"><Link href={"/staff?" + new URLSearchParams({ section: "news", group: group.id })}>
                <Megaphone size={16} /> Объявление группе <ArrowUpRight size={14} />
              </Link></Button>
            </div>
          </div>;
        })}
      </section>
      {subject ? <>
        <Link className="text-link" href={gradeUrl()}>← К списку предметов</Link>
        <h3>{subject.title} · семестр {subject.term}</h3>
        <GradeRegister key={gradeUrl(subject) + ":" + (typeof params.student === "string" ? params.student : "")} title={subject.title} term={subject.term} group={groupId} initialSearch={typeof params.q === "string" ? params.q : ""} initialUngraded={params.ungraded === "1"} initialStudent={typeof params.student === "string" ? params.student : undefined} rows={students.map((student) => ({
          id: student.id, name: displayStudent(student.name, student.studentProfile?.surnameStress), group: groups.find((group) => group.id === student.studentProfile?.groupId)?.name ?? "",
          grade: student.grades.find((grade) => grade.title === subject.title && grade.term === subject.term),
        }))} />
      </> : <>
        <h3>Выберите предмет</h3>
        {subjects.length ? <div className="service-list">{subjects.map((item) => <Link key={gradeUrl(item)} className="service-item" href={gradeUrl(item)}>{item.title} · семестр {item.term}</Link>)}</div> : <p className="empty">Предметов пока нет</p>}
        <details className="staff-row"><summary>Добавить предмет и первую оценку</summary>
      <form className="staff-fields" action={saveGrade}>
        <label>Студент<select name="student" required>{students.map((student) => <option key={student.id} value={student.id}>{displayStudent(student.name, student.studentProfile?.surnameStress)} · {groups.find((group) => group.id === student.studentProfile?.groupId)?.name}</option>)}</select></label>
        <label>Дисциплина<input name="title" maxLength={120} required /></label>
        <label>Семестр<input name="term" type="number" min={1} max={20} required /></label>
        <GradeFields disabled={!students.length} />
      </form>
        </details>
      </>}
    </section>}

    {section === "audit" && <section className="panel"><h2>Журнал изменений</h2>
      {!audit.length && <p className="empty">Изменений пока нет</p>}
      {audit.map((entry) => <article className="staff-row" key={entry.id}>
        <p>{entry.summary}</p><p className="muted">{dateLabel(entry.createdAt)}, {timeLabel(entry.createdAt)} МСК · {entry.actor.name}</p>
      </article>)}
    </section>}
  </StaffShell>;
}
