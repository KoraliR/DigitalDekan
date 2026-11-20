import Link from "next/link";
import { StaffShell } from "@/components/staff-shell";
import { RequestStatus, RequestType } from "@prisma/client";
import { account, staffGroups, staffStudents } from "@/lib/access";
import { db } from "@/lib/db";
import { assessments, attendanceStatuses, campusDay, dateLabel, finalGradeLabel, lessonTypes, services, statuses, timeLabel } from "@/lib/model";
import { transitions } from "@/lib/workflow";
import { createDeadline, processRequest, publish, saveAttendance, saveGrade, saveLesson } from "./actions";
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
const assessmentOptions = Object.entries(assessments);
const attendanceOptions = Object.entries(attendanceStatuses);
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
  const active = { user: scope, status: { in: [RequestStatus.NEW, RequestStatus.PROCESSING] } };
  const now = new Date();
  const today = campusDay(now);
  const attendanceDate = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const [newCount, overdue, deadlines, requests, lessons, students, audit, attendanceLessons, groupDeadlines] = await Promise.all([
    section === "overview" ? db.serviceRequest.count({ where: { user: scope, status: "NEW" } }) : 0,
    section === "overview" ? db.serviceRequest.count({ where: { ...active, readyBy: { lt: now } } }) : 0,
    section === "overview" ? db.deadline.findMany({ where: { user: scope, dueAt: { gte: now } }, distinct: ["title", "course", "dueAt"], orderBy: { dueAt: "asc" }, take: 5 }) : [],
    section === "requests" ? db.serviceRequest.findMany({
      where: { user: staffStudents(user.id, groupId), status, type },
      include: { user: { select: { name: true, studentProfile: { select: { group: { select: { name: true } } } } } } },
      orderBy: { createdAt: "desc" },
    }) : [],
    section === "schedule" ? db.groupLesson.findMany({ where: { group: staffGroups(user.id) }, include: { group: true }, orderBy: { startsAt: "asc" } }) : [],
    section === "grades" ? db.user.findMany({
      where: staffStudents(user.id, groupId), orderBy: { name: "asc" },
      select: { id: true, name: true, studentProfile: { select: { groupId: true } }, grades: { orderBy: [{ term: "desc" }, { title: "asc" }] } },
    }) : [],
    section === "audit" ? db.auditEntry.findMany({
      where: { groupId: { in: groups.map(({ id }) => id) } }, include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100,
    }) : [],
    section === "attendance" ? db.lesson.findMany({
      where: {
        user: staffStudents(user.id, groupId),
        startsAt: { gte: new Date(attendanceDate + "T00:00:00+03:00"), lt: new Date(attendanceDate + "T23:59:59+03:00") },
      },
      include: { user: { select: { name: true } }, attendances: true },
      orderBy: { startsAt: "asc" },
    }) : [],
    section === "deadlines" ? db.deadline.findMany({
      where: { user: staffStudents(user.id, groupId), dueAt: { gte: now } },
      include: { user: { select: { name: true, studentProfile: { select: { group: { select: { name: true } } } } } } },
      orderBy: { dueAt: "asc" }, take: 100,
    }) : [],
  ]);
  const groupOptions = groups.map(({ id, name }) => <option key={id} value={id}>{name}</option>);

  return <StaffShell name={user.name} section={section}>
    {!groups.length && <p className="empty">За вашим аккаунтом пока не закреплены группы.</p>}
    {params.saved === "1" && <p className="notice" role="status">Изменения сохранены</p>}
    {typeof params.error === "string" && <p className="form-error" role="alert">{params.error}</p>}

    {section === "overview" && <div className="content-stack">
      <div className="staff-metrics">
        <Link className="panel" href="/staff?section=requests&status=NEW"><strong>{newCount}</strong><span>Новые заявки</span></Link>
        <Link className="panel" href="/staff?section=requests"><strong>{overdue}</strong><span>Просроченные заявки</span></Link>
      </div>
      <section className="panel"><h2>Ближайшие учебные дедлайны</h2>
        {!deadlines.length && <p className="empty">Предстоящих дедлайнов нет</p>}
        {deadlines.map((item) => <p className="staff-row" key={item.id}>{dateLabel(item.dueAt)} · {item.title} · {item.course}</p>)}
      </section>
      <div className="top-actions"><Button asChild><Link href="/staff?section=news">Опубликовать объявление</Link></Button>
        <Button asChild variant="secondary"><Link href="/staff?section=schedule">Добавить занятие</Link></Button></div>
    </div>}

    {section === "requests" && <section className="panel">
      <h2>Заявки студентов</h2>
      <form className="staff-fields">
        <input type="hidden" name="section" value="requests" />
        <label>Статус<select name="status" defaultValue={status ?? ""}><option value="">Все статусы</option>{Object.entries(statuses).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <label>Тип<select name="type" defaultValue={type ?? ""}><option value="">Все типы</option>{Object.entries(services).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <label>Группа<select name="group" defaultValue={groupId ?? ""}><option value="">Все группы</option>{groupOptions}</select></label>
        <Button variant="secondary">Применить фильтры</Button>
      </form>
      {!requests.length && <p className="empty">Заявок по этим условиям нет</p>}
      {requests.map((request) => <details className="staff-row" key={request.id}><summary>
        <strong>{request.number ?? "№ " + request.id.slice(0, 8)}</strong> · {services[request.type]} · {statuses[request.status]}<br />
        <span className="muted">{request.user.name} · {request.user.studentProfile?.group?.name} · {dateLabel(request.createdAt)}</span>
      </summary><form className="staff-fields" action={processRequest}>
        <input type="hidden" name="id" value={request.id} /><input type="hidden" name="revision" value={request.revision} />
        <label>Статус<select name="status" defaultValue={request.status}>{[request.status, ...transitions[request.status]].map((value) => <option key={value} value={value}>{statuses[value]}</option>)}</select></label>
        <label>Срок готовности<input name="readyBy" type="date" defaultValue={request.readyBy ? campusDay(request.readyBy) : ""} /></label>
        <label className="staff-wide">Комментарий студенту<textarea name="comment" maxLength={1000} defaultValue={request.comment ?? ""} /></label>
        <Button>Сохранить заявку</Button>
      </form></details>)}
    </section>}

    {section === "news" && <section className="panel"><h2>Новое объявление</h2><form className="staff-fields" action={publish}>
      <label>Формат<select name="kind"><option value="news">Новость</option><option value="reminder">Напоминание</option></select></label>
      <label>Аудитория<select name="audience"><option value="all">Все закреплённые группы</option>
        {[...new Set(groups.map(({ faculty }) => faculty))].map((faculty) => <option key={faculty} value={"faculty:" + faculty}>Факультет · {faculty}</option>)}
        {[...new Set(groups.map(({ course }) => course))].map((course) => <option key={course} value={"course:" + course}>Курс · {course}</option>)}
        {groups.map(({ id, name }) => <option key={id} value={"group:" + id}>Группа · {name}</option>)}
      </select></label>
      <label className="staff-wide">Заголовок<input name="title" maxLength={120} required /></label>
      <label className="staff-wide">Текст<textarea name="body" maxLength={2000} required /></label>
      <Button disabled={!groups.length}>Опубликовать</Button>
    </form></section>}

    {section === "schedule" && <div className="content-stack"><section className="panel"><h2>Добавить занятие</h2><form className="staff-fields" action={saveLesson}>
      <label>Группа<select name="group" required>{groupOptions}</select></label>
      <label>Тип<select name="type">{lessonTypeOptions.map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
      <label>Дисциплина<input name="title" maxLength={120} required /></label>
      <label>Преподаватель<input name="teacher" maxLength={100} required /></label>
      <label>Аудитория<input name="room" maxLength={30} required /></label>
      <label>Корпус<input name="campus" maxLength={120} placeholder="необязательно" /></label>
      <label>Начало (МСК)<input type="datetime-local" name="startsAt" required /></label>
      <label>Окончание (МСК)<input type="datetime-local" name="endsAt" required /></label>
      <Button disabled={!groups.length}>Добавить и уведомить</Button>
    </form></section><section className="panel"><h2>Занятия групп</h2>
      {!lessons.length && <p className="empty">Занятий пока нет</p>}
      {lessons.map((lesson) => <details className="staff-row" key={lesson.id}><summary>{lesson.group.name} · {lesson.title} · {dateLabel(lesson.startsAt)}, {timeLabel(lesson.startsAt)}</summary>
        <form className="staff-fields" action={saveLesson}><input type="hidden" name="id" value={lesson.id} />
          <label>Тип<select name="type" defaultValue={lesson.type}>{lessonTypeOptions.map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
          <label>Дисциплина<input name="title" maxLength={120} defaultValue={lesson.title} /></label>
          <label>Преподаватель<input name="teacher" maxLength={100} defaultValue={lesson.teacher} /></label>
          <label>Аудитория<input name="room" maxLength={30} defaultValue={lesson.room} /></label>
          <label>Корпус<input name="campus" maxLength={120} defaultValue={lesson.campus ?? ""} /></label>
          <label>Новое начало (МСК)<input type="datetime-local" name="startsAt" defaultValue={dateTime(lesson.startsAt)} required /></label>
          <label>Новое окончание (МСК)<input type="datetime-local" name="endsAt" defaultValue={dateTime(lesson.endsAt)} required /></label>
          <Button>Сохранить и уведомить</Button>
        </form></details>)}
    </section></div>}

    {section === "attendance" && <div className="content-stack"><section className="panel"><h2>Посещаемость</h2>
      <form className="staff-fields">
        <input type="hidden" name="section" value="attendance" />
        <label>Группа<select name="group" defaultValue={groupId ?? ""}><option value="">Все группы</option>{groupOptions}</select></label>
        <label>Дата<input type="date" name="date" defaultValue={attendanceDate} /></label>
        <Button variant="secondary">Показать занятия</Button>
      </form>
      {!attendanceLessons.length && <p className="empty">На эту дату занятий нет</p>}
      {attendanceLessons.map((lesson) => {
        const mark = lesson.attendances.find((item) => item.userId === lesson.userId)?.status;
        return <form className="staff-fields" key={lesson.id} action={saveAttendance}>
          <input type="hidden" name="lesson" value={lesson.id} />
          <p className="staff-wide">{lesson.user.name} · {lesson.title} · {timeLabel(lesson.startsAt)}–{timeLabel(lesson.endsAt)}</p>
          <label>Посещение<select name="status" defaultValue={mark ?? ""}>
            <option value="">— не отмечено</option>
            {attendanceOptions.map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
          </select></label>
          <Button variant="secondary">Сохранить</Button>
        </form>;
      })}
    </section></div>}

    {section === "deadlines" && <div className="content-stack"><section className="panel"><h2>Новый дедлайн</h2><form className="staff-fields" action={createDeadline}>
      <label>Группа<select name="group" required>{groupOptions}</select></label>
      <label>Дисциплина<input name="course" maxLength={120} required /></label>
      <label>Работа<input name="title" maxLength={120} required /></label>
      <label>Срок<input type="date" name="dueAt" required /></label>
      <Button disabled={!groups.length}>Добавить и уведомить</Button>
    </form></section><section className="panel"><h2>Предстоящие дедлайны</h2>
      {!groupDeadlines.length && <p className="empty">Дедлайнов пока нет</p>}
      {groupDeadlines.map((deadline) => <p className="staff-row" key={deadline.id}>
        {dateLabel(deadline.dueAt)} · {deadline.title} · {deadline.course} · {deadline.user.name}
      </p>)}
    </section></div>}

    {section === "grades" && <div className="content-stack"><section className="panel"><h2>Успеваемость по группам</h2>
      <form className="staff-fields"><input type="hidden" name="section" value="grades" /><label>Группа<select name="group" defaultValue={groupId ?? ""}><option value="">Все группы</option>{groupOptions}</select></label><Button variant="secondary">Показать</Button></form>
      {groups.filter((group) => !groupId || group.id === groupId).map((group) => {
        const rows = students.filter((student) => student.studentProfile?.groupId === group.id).flatMap((student) => student.grades);
        const bySubject = new Map<string, typeof rows>();
        for (const grade of rows) {
          const key = grade.title + " · семестр " + grade.term;
          const subject = bySubject.get(key);
          if (subject) subject.push(grade);
          else bySubject.set(key, [grade]);
        }
        const subjects = [...bySubject];
        return <div key={group.id} className="staff-row"><h3>{group.name}</h3>
          {subjects.length ? subjects.map(([label, grades]) => grades && <p key={label}>{label} · {finalGradeLabel(grades[0])}</p>) : <p className="muted">Оценок пока нет</p>}
        </div>;
      })}
    </section><section className="panel"><h2>Выставить или изменить оценку</h2>
      <form className="staff-fields" action={saveGrade}>
        <label>Студент<select name="student" required>{students.map((student) => <option key={student.id} value={student.id}>{student.name} · {groups.find((group) => group.id === student.studentProfile?.groupId)?.name}</option>)}</select></label>
        <label>Дисциплина<input name="title" maxLength={120} required /></label>
        <label>Семестр<input name="term" type="number" min={1} max={20} required /></label>
        <label>Аттестация<select name="assessment">{assessmentOptions.map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
        <label>Балл<input name="score" type="number" min={0} max={100} required /></label>
        <label>Порог<input name="threshold" type="number" min={1} max={100} required /></label>
        <label>Итог (2–5)<input name="finalGrade" type="number" min={2} max={5} /></label>
        <label>Зачёт<select name="passed"><option value="">—</option><option value="true">Зачтено</option><option value="false">Не зачтено</option></select></label>
        <Button disabled={!students.length}>Сохранить оценку</Button>
      </form>
      {students.map((student) => student.grades.length > 0 && <details className="staff-row" key={student.id}><summary>{student.name}</summary>
        {student.grades.map((grade) => <form key={grade.id} className="staff-fields" action={saveGrade}>
          <input type="hidden" name="student" value={student.id} /><input type="hidden" name="title" value={grade.title} /><input type="hidden" name="term" value={grade.term} />
          <p className="staff-wide">{grade.title} · семестр {grade.term} · итог: {finalGradeLabel(grade)}</p>
          <label>Аттестация<select name="assessment" defaultValue={grade.assessment ?? ""}><option value="">—</option>{assessmentOptions.map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
          <label>Балл<input name="score" type="number" min={0} max={100} defaultValue={grade.score} required /></label>
          <label>Порог<input name="threshold" type="number" min={1} max={100} defaultValue={grade.threshold} required /></label>
          <label>Итог (2–5)<input name="finalGrade" type="number" min={2} max={5} defaultValue={grade.finalGrade ?? ""} /></label>
          <label>Зачёт<select name="passed" defaultValue={grade.passed === true ? "true" : grade.passed === false ? "false" : ""}><option value="">—</option><option value="true">Зачтено</option><option value="false">Не зачтено</option></select></label>
          <Button variant="secondary">Обновить оценку</Button>
        </form>)}</details>)}
    </section></div>}

    {section === "audit" && <section className="panel"><h2>Журнал изменений</h2>
      {!audit.length && <p className="empty">Изменений пока нет</p>}
      {audit.map((entry) => <article className="staff-row" key={entry.id}>
        <p>{entry.summary}</p><p className="muted">{dateLabel(entry.createdAt)}, {timeLabel(entry.createdAt)} МСК · {entry.actor.name}</p>
      </article>)}
    </section>}
  </StaffShell>;
}
