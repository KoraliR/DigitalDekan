import Link from "next/link";
import { Filter } from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { Button } from "@/components/ui/button";
import { account, staffGroups, staffStudents } from "@/lib/access";
import { db } from "@/lib/db";
import { displayStudent, slotLabels } from "@/lib/campus-tools";
import { dateLabel, timeLabel } from "@/lib/model";
import { confirmSport, createSlot, moderatePost } from "@/app/campus-tools/actions";

// Поиск по ФИО: в базе имена без знаков ударения, но пользователь может набрать «ё» вместо «е»
// или вставить фамилию прямо из карточки (там ударение — комбинирующий символ U+0301).
// NFC собирает «ё»/«й» обратно, затем убираем знаки ударения и служебные символы LIKE.
function normalizeSearch(value: string) {
  return value.normalize("NFC").replace(/[\u0300-\u036f]/g, "").replace(/[%_\\]/g, "").trim();
}
// Ищем оба варианта написания: «Пётр» должен найти «Петров», а «Федорова» — «Фёдорова».
function searchVariants(value: string) {
  const query = normalizeSearch(value).toLowerCase();
  if (!query) return [];
  return [...new Set([query, query.replace(/ё/g, "е"), query.replace(/е/g, "ё")])];
}

export default async function CampusAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await account("STAFF");
  const params = await searchParams;
  const tab = params.tab ?? "slots";
  const scope = staffStudents(user.id);
  const groups = await db.studyGroup.findMany({ where: staffGroups(user.id), orderBy: { name: "asc" } });
  const search = typeof params.q === "string" ? params.q : "";
  const variants = searchVariants(search);
  const groupId = groups.find(({ id }) => id === params.group)?.id;
  const portfolioFiltered = variants.length > 0 || Boolean(groupId);
  const portfolioNameFilter = variants.length
    ? { OR: variants.map((name) => ({ name: { contains: name, mode: "insensitive" as const } })) }
    : {};
  const [slots, reports, portfolio] = await Promise.all([
    tab === "slots" ? db.campusSlot.findMany({ where: { staffId: user.id }, include: {
      bookings: { where: { user: scope }, include: { user: { select: { name: true, studentProfile: { select: { surnameStress: true } } } } } },
    }, orderBy: { startsAt: "desc" }, take: 50 }) : [],
    tab === "board" ? db.campusPost.findMany({ where: { flagged: true, user: scope }, orderBy: { createdAt: "desc" }, take: 50 }) : [],
    tab === "portfolio" ? db.campusPortfolio.findMany({ where: { shared: true, user: { ...staffStudents(user.id, groupId), ...portfolioNameFilter } }, include: {
      user: { select: { name: true, studentProfile: { select: { surnameStress: true, group: { select: { name: true } } } } } },
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
      <form className="staff-fields" action="/staff/campus" method="get">
        <input type="hidden" name="tab" value="portfolio" />
        <label>Поиск по студенту<input type="search" name="q" aria-label="Поиск по студенту" placeholder="Фамилия или имя" defaultValue={search} /></label>
        <label>Группа<select name="group" defaultValue={groupId ?? ""}>
          <option value="">Все группы</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select></label>
        <div className="staff-button-row">
          <Button variant="secondary"><Filter size={16} aria-hidden="true" /> Применить фильтры</Button>
          <Link className="text-link" href="/staff/campus?tab=portfolio">Сбросить</Link>
        </div>
      </form>
      {!portfolio.length && (portfolioFiltered
        ? <p className="empty">Ничего не найдено. Попробуйте изменить запрос или <Link className="text-link" href="/staff/campus?tab=portfolio">сбросить фильтры</Link>.</p>
        : <p className="empty">В ваших группах пока нет открытых работ</p>)}
      {portfolio.map((entry) => <article className="staff-row" key={entry.id}><h3>{entry.title}</h3>
        <p className="muted">{displayStudent(entry.user.name, entry.user.studentProfile?.surnameStress)} · {entry.user.studentProfile?.group?.name ?? "Группа не указана"} · {entry.kind} · {dateLabel(entry.occurredAt)}</p>
        <p className="message-body">{entry.description}</p>{entry.link && <a className="text-link" href={entry.link} rel="noreferrer">Открыть результат</a>}
      </article>)}
    </section>}
  </StaffShell>;
}
