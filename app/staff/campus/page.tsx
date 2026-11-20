import Link from "next/link";
import { StaffShell } from "@/components/staff-shell";
import { Button } from "@/components/ui/button";
import { account, staffGroups, staffStudents } from "@/lib/access";
import { db } from "@/lib/db";
import { displayStudent, slotLabels } from "@/lib/campus-tools";
import { dateLabel, timeLabel } from "@/lib/model";
import { confirmSport, createSlot, moderatePost } from "@/app/campus-tools/actions";

export default async function CampusAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await account("STAFF");
  const params = await searchParams;
  const tab = params.tab ?? "slots";
  const scope = staffStudents(user.id);
  const [groups, slots, reports, portfolio] = await Promise.all([
    db.studyGroup.findMany({ where: staffGroups(user.id), orderBy: { name: "asc" } }),
    tab === "slots" ? db.campusSlot.findMany({ where: { staffId: user.id }, include: {
      bookings: { where: { user: scope }, include: { user: { select: { name: true, studentProfile: { select: { surnameStress: true } } } } } },
    }, orderBy: { startsAt: "desc" }, take: 50 }) : [],
    tab === "board" ? db.campusPost.findMany({ where: { flagged: true, user: scope }, orderBy: { createdAt: "desc" }, take: 50 }) : [],
    tab === "portfolio" ? db.campusPortfolio.findMany({ where: { shared: true, user: scope }, include: {
      user: { select: { name: true, studentProfile: { select: { surnameStress: true } } } },
    }, orderBy: { occurredAt: "desc" }, take: 50 }) : [],
  ]);
  return <StaffShell name={user.name} section="campus">
    <h2>Сервисы кампуса</h2>
    <nav className="campus-nav" aria-label="Управление сервисами">
      <Link className="button button-secondary" href="/staff/campus" aria-current={tab === "slots" ? "page" : undefined}>Слоты и записи</Link>
      <Link className="button button-secondary" href="/staff/campus?tab=board" aria-current={tab === "board" ? "page" : undefined}>Жалобы на объявления</Link>
      <Link className="button button-secondary" href="/staff/campus?tab=portfolio" aria-current={tab === "portfolio" ? "page" : undefined}>Портфолио групп</Link>
    </nav>
    {params.saved && <p className="notice" role="status">Изменения сохранены</p>}
    {params.error && <p className="form-error" role="alert">{params.error}</p>}
    {tab === "slots" && <>
      <section className="panel"><h3>Новый слот</h3>
        <form action={createSlot} className="staff-fields">
          <label>Тип<select name="kind">{Object.entries(slotLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
          <label>Группа<select name="group" required><option value="">Выберите группу</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
          <label>Название или предмет<input name="title" required maxLength={120} /></label>
          <label>Семестр для пересдачи<input name="term" type="number" min={1} max={20} defaultValue={1} /></label>
          <label>Место или ресурс<input name="place" required maxLength={120} /></label>
          <label>Свободных мест<input name="capacity" required type="number" defaultValue={1} min={1} max={100} /></label>
          <label>Начало (МСК)<input name="start" type="datetime-local" required /></label>
          <label>Окончание (МСК)<input name="end" type="datetime-local" required /></label>
          <Button disabled={!groups.length}>Опубликовать слот</Button>
        </form>
      </section>
      <section className="panel content-stack"><h3>Опубликованные слоты</h3>
        {!slots.length && <p className="empty">Вы ещё не опубликовали слоты</p>}
        {slots.map((slot) => <details className="staff-row" key={slot.id}>
          <summary><strong>{slot.title}</strong> · {slotLabels[slot.kind]} · {dateLabel(slot.startsAt)}, {timeLabel(slot.startsAt)} · {slot.bookings.length}/{slot.capacity}</summary>
          {!slot.bookings.length && <p className="empty">Записей пока нет</p>}
          {slot.bookings.map(({ userId, user: student, attended }) => <div className="campus-item staff-row" key={userId}>
            <strong>{displayStudent(student.name, student.studentProfile?.surnameStress)}</strong>
            {slot.kind === "SPORT" && (attended ? <span>Посещение подтверждено</span> : +slot.startsAt <= Date.now() &&
              <form action={confirmSport}><input type="hidden" name="id" value={slot.id} /><input type="hidden" name="student" value={userId} /><Button>Подтвердить физкультуру</Button></form>)}
          </div>)}
        </details>)}
      </section>
    </>}
    {tab === "board" && <section className="panel content-stack"><h3>Объявления с жалобами</h3>
      {!reports.length && <p className="empty">Жалоб от сообщества на объявления ваших групп нет</p>}
      {reports.map((post) => <article className="staff-row" key={post.id}><h3>{post.title}</h3><p className="message-body">{post.body}</p>
        <form action={moderatePost} className="staff-button-row"><input type="hidden" name="id" value={post.id} />
          <Button name="command" value="close" variant="danger">Закрыть объявление</Button><Button name="command" value="dismiss" variant="secondary">Снять жалобу</Button>
        </form></article>)}
    </section>}
    {tab === "portfolio" && <section className="panel content-stack"><h3>Открытые работы студентов</h3>
      {!portfolio.length && <p className="empty">В ваших группах пока нет открытых работ</p>}
      {portfolio.map((entry) => <article className="staff-row" key={entry.id}><h3>{entry.title}</h3>
        <p className="muted">{displayStudent(entry.user.name, entry.user.studentProfile?.surnameStress)} · {entry.kind} · {dateLabel(entry.occurredAt)}</p>
        <p className="message-body">{entry.description}</p>{entry.link && <a className="text-link" href={entry.link} rel="noreferrer">Открыть результат</a>}
      </article>)}
    </section>}
  </StaffShell>;
}