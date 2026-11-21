import Link from "next/link";
import QRCode from "qrcode";
import { createHash } from "node:crypto";
import { account } from "@/lib/access";
import { db } from "@/lib/db";
import { availableSlots, categories, portfolioKinds, slotLabels } from "@/lib/campus-tools";
import { campusDay, dateLabel, plusDays, timeLabel } from "@/lib/model";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme";
import { board, booking, issuePass, library, portfolio } from "./actions";

const tabs = { booking: "Запись и бронирование", library: "Библиотека", board: "Доска объявлений", portfolio: "Портфолио", profile: "Пропуск" };
type CampusSearch = { tab?: string; q?: string; date?: string; window?: string; kind?: string; category?: string; pass?: string; saved?: string; error?: string };

export default async function CampusTools({ searchParams }: { searchParams: Promise<CampusSearch> }) {
  const user = await account("STUDENT");
  const params = await searchParams;
  const tab = Object.keys(tabs).find((key) => key === params.tab) ?? "booking";
  const now = new Date();
  const today = campusDay(now);
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const windowDate = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && Number.isFinite(Date.parse(params.date)) ? params.date : today;
  const dayStart = new Date(windowDate + "T00:00:00+03:00");
  const lessonWindow = { gte: dayStart, lt: new Date(+dayStart + 86400000) };
  const [slots, bookings, books, loans, holds, posts, entries, pass, personal, group] = await Promise.all([
    tab === "booking" ? availableSlots(db, user) : [],
    tab === "booking" ? db.campusBooking.findMany({ where: { userId: user.id }, include: { slot: true }, orderBy: { slot: { startsAt: "desc" } }, take: 30 }) : [],
    tab === "library" ? db.campusBook.findMany({
      where: q ? { OR: [
        { title: { contains: q, mode: "insensitive" } },
        { author: { contains: q, mode: "insensitive" } },
        { isbn: { contains: q } },
      ] } : undefined,
      orderBy: { title: "asc" }, include: { _count: { select: { loans: true, holds: true } } } }) : [],
    tab === "library" ? db.campusLoan.findMany({ where: { userId: user.id }, include: { book: true } }) : [],
    tab === "library" ? db.campusHold.findMany({ where: { userId: user.id } }) : [],
    tab === "board" ? db.campusPost.findMany({ where: { OR: [{ userId: user.id }, { closed: false, expiresAt: { gt: now } }], category: categories.find((value) => value === params.category) },
      include: { user: { select: { name: true } }, replies: { where: { OR: [{ userId: user.id }, { post: { userId: user.id } }] }, include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" }, take: 50 }) : [],
    tab === "portfolio" ? db.campusPortfolio.findMany({ where: { userId: user.id }, orderBy: { occurredAt: "desc" } }) : [],
    tab === "profile" && typeof params.pass === "string" && /^[a-f0-9]{48}$/.test(params.pass) ? db.campusPass.findFirst({ where: {
      userId: user.id, digest: createHash("sha256").update(params.pass).digest("hex"), expiresAt: { gt: now },
    } }) : null,
    tab === "booking" && params.window === "1" ? db.lesson.findMany({ where: { userId: user.id, startsAt: lessonWindow }, select: { startsAt: true, endsAt: true } }) : [],
    tab === "booking" && params.window === "1" && user.groupId ? db.groupLesson.findMany({ where: { groupId: user.groupId, startsAt: lessonWindow }, select: { startsAt: true, endsAt: true } }) : [],
  ]);
  const schedule = [...personal, ...group].sort((a, b) => +a.startsAt - +b.startsAt);
  let previousEnd = 0;
  const gaps = schedule.flatMap((item) => {
    const start = previousEnd + 600000;
    const end = +item.startsAt - 600000;
    const gap = previousEnd && start < end ? [{ start, end }] : [];
    previousEnd = Math.max(previousEnd, +item.endsAt);
    return gap;
  });
  const slotKind = Object.keys(slotLabels).find((value) => value === params.kind);
  const visibleSlots = slots.filter((slot) => (!slotKind || slot.kind === slotKind) &&
    (params.window !== "1" || (slot._count.bookings < slot.capacity && gaps.some((gap) => +slot.startsAt >= gap.start && +slot.endsAt <= gap.end))));
  const passLink = pass ? new URL("/staff/campus/pass?token=" + params.pass, process.env.PUBLIC_ATTENDANCE_URL || process.env.AUTH_URL || "http://localhost:3000").href : "";
  const image = passLink ? await QRCode.toDataURL(passLink, { width: 240 }) : "";
  const shelf = new Set(loans.map((item) => item.bookId));

  return <main className="workspace staff-workspace campus-workspace">
    <header className="section-head"><div><Link className="text-link" href="/cabinet/today">← В личный кабинет</Link><h1>Сервисы</h1></div><ThemeToggle /></header>
    <p className="notice">Концепт для конкурса. Используются демонстрационные данные.</p>
    <nav className="campus-nav" aria-label="Сервисы кампуса">{Object.entries(tabs).map(([key, title]) =>
      <Link className="button button-secondary" key={key} href={"/campus-tools?tab=" + key} aria-current={tab === key ? "page" : undefined}>{title}</Link>)}</nav>
    {params.saved && <p className="notice" role="status">Изменения сохранены</p>}
    {params.error && <p className="form-error" role="alert">{params.error}</p>}
    {tab === "booking" && <>
      <section className="panel content-stack"><h2>Мои записи</h2>
        {!bookings.length && <p className="empty">Записей пока нет</p>}
        {bookings.map(({ slot, attended }) => <article className="staff-row campus-item" key={slot.id}>
          <div><h3>{slot.title}</h3><p className="muted">{slotLabels[slot.kind]} · {dateLabel(slot.startsAt)}, {timeLabel(slot.startsAt)} МСК · {slot.place}</p>
            {attended && <p>Посещение физкультуры подтверждено</p>}</div>
          {slot.startsAt > now && <form action={booking}><input type="hidden" name="id" value={slot.id} /><Button name="command" value="cancel" variant="secondary">Отменить запись</Button></form>}
        </article>)}
      </section>
      <section className="panel content-stack"><h2>{params.window === "1" ? "Подходит для окна между парами" : "Доступные записи"}</h2>
        <form className="staff-fields"><input type="hidden" name="tab" value="booking" />
          {params.window === "1" && <><input name="window" type="hidden" value="1" /><label>Дата<input name="date" type="date" defaultValue={windowDate} min={today} /></label></>}
          <label>Тип<select name="kind" defaultValue={slotKind ?? ""}><option value="">Все варианты</option>{Object.entries(slotLabels).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label><Button variant="secondary">Показать</Button>
        </form>
        {params.window === "1" && <div className="campus-nav">
          <Link className="text-link" href="/campus-tools?tab=library">Посмотреть книги в библиотеке</Link>
          <Link className="text-link" href={"/campus-tools?tab=booking&window=1&date=" + campusDay(plusDays(today, 1))}>Окна на завтра</Link>
        </div>}
        {!visibleSlots.length && <p className="empty">Свободных вариантов по этим условиям пока нет</p>}
        {visibleSlots.map((slot) => {
          const seats = slot.capacity - slot._count.bookings;
          return <article key={slot.id} className="staff-row campus-item">
            <div><h3>{slot.title}</h3><p className="muted">{slotLabels[slot.kind]} · {dateLabel(slot.startsAt)}, {timeLabel(slot.startsAt)}–{timeLabel(slot.endsAt)} МСК</p>
              <p>{slot.place}{slot.staff ? " · " + slot.staff.name : ""} · Мест: {seats}</p></div>
            <form action={booking}><input name="id" type="hidden" value={slot.id} /><Button disabled={!seats || !!slot.bookings.length}>{slot.bookings.length ? "Вы записаны" : seats ? "Записаться" : "Мест нет"}</Button></form>
          </article>;
        })}
      </section>
    </>}
    {tab === "library" && <>
      <section className="panel content-stack"><h2>Мои книги</h2>{!loans.length && <p className="empty">Выданных книг пока нет</p>}
        {loans.map(({ book, dueAt, renewed }) => <article className="staff-row campus-item" key={book.id}>
          <div><h3>{book.title}</h3><p className="muted">{book.author}{book.isbn ? " · ISBN " + book.isbn : ""}</p>
            <p className={dueAt <= now || +dueAt - +now < 3 * 86400000 ? "notice" : "muted"}>{dueAt <= now ? "Просрочено" : "Вернуть до"} · {dateLabel(dueAt)}</p></div>
          <form action={library}><input name="id" type="hidden" value={book.id} /><Button name="command" value="renew" variant="secondary" disabled={renewed || dueAt <= now}>{renewed ? "Продлено" : "Продлить на 7 дней"}</Button></form>
        </article>)}
      </section>
      <section className="panel content-stack"><h2>Каталог учебников</h2>
        <form className="staff-fields library-search" method="get" role="search">
          <input type="hidden" name="tab" value="library" />
          <label className="staff-wide">Поиск по названию, автору или ISBN
            <input name="q" type="search" defaultValue={q} maxLength={120} placeholder="Например, «Базы данных» или 978-5-97060-103" />
          </label>
          <div className="staff-button-row">
            <Button type="submit" variant="secondary">Найти</Button>
            {q && <Link className="button button-secondary" href="/campus-tools?tab=library">Сбросить</Link>}
          </div>
        </form>
        {q && books.length > 0 && <p className="muted" role="status">Найдено: {books.length} · запрос «{q}»</p>}
        {!books.length && <p className="empty">{q ? "По запросу ничего не найдено" : "Каталог пока пуст"}</p>}
        {books.map((book) => {
          const held = holds.some((item) => item.bookId === book.id);
          return <article className="staff-row campus-item" key={book.id}><div><h3>{book.title}</h3>
            <p className="muted">{book.author}{book.isbn ? " · ISBN " + book.isbn : ""} · В очереди: {book._count.holds}</p></div>
            {!shelf.has(book.id) && <form action={library}><input type="hidden" name="id" value={book.id} /><Button name="command" value={held ? "unhold" : "hold"} variant={held ? "secondary" : "primary"}>{held ? "Снять бронь" : "Забронировать"}</Button></form>}
          </article>;
        })}
      </section>
    </>}
    {tab === "board" && <section className="panel content-stack">
      <h2>Доска объявлений</h2>
      <form className="staff-fields" action={board}><input type="hidden" name="command" value="create" />
        <label>Категория<select name="category">{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Заголовок<input required name="title" maxLength={120} /></label>
        <label>Телефон для связи<input name="contactPhone" type="tel" maxLength={40} placeholder="необязательно" /></label>
        <label>Email для связи<input name="contactEmail" type="email" maxLength={120} placeholder="необязательно" /></label>
        <label className="staff-wide">Текст<textarea required name="body" maxLength={1000} /></label><Button>Опубликовать на 14 дней</Button>
      </form>
      <nav className="campus-nav" aria-label="Категории"><Link className="button button-secondary" href="/campus-tools?tab=board">Все</Link>
        {categories.map((item) => <Link className="button button-secondary" key={item} href={"/campus-tools?" + new URLSearchParams({ tab: "board", category: item })}>{item}</Link>)}</nav>
      {!posts.length && <p className="empty">Объявлений пока нет</p>}
      {posts.map((post) => <article className="staff-row" key={post.id}>
        <h3>{post.title}</h3><p className="muted">{post.category} · {post.user.name} · до {dateLabel(post.expiresAt)}{post.closed ? " · Закрыто" : ""}</p><p className="message-body">{post.body}</p>
        {(post.contactPhone || post.contactEmail) && <p className="campus-contact">
          Связь: {[post.contactPhone, post.contactEmail].filter(Boolean).join(" · ")}
        </p>}
        {post.replies.map((reply) => <p className="staff-row message-body" key={reply.userId}>{reply.user.name} · {reply.body}</p>)}
        {!post.closed && post.expiresAt > now && <form className="staff-fields" action={board}>
          <input type="hidden" name="id" value={post.id} />
          {post.userId === user.id ? <Button name="command" value="close" variant="secondary">Закрыть объявление</Button> : <>
            <label className="staff-wide">Отклик<textarea name="body" maxLength={500} defaultValue={post.replies[0]?.body} /></label>
            <Button name="command" value="reply">Отправить автору</Button><Button name="command" value="report" variant="secondary">Пожаловаться</Button>
          </>}
        </form>}
      </article>)}
    </section>}
    {tab === "portfolio" && <section className="panel content-stack">
      <h2>Портфолио</h2><form className="staff-fields" action={portfolio}>
        <label>Тип<select name="kind">{portfolioKinds.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Название<input name="title" required maxLength={120} /></label>
        <label>Дата<input name="date" type="date" required /></label>
        <label>Ссылка на результат<input name="link" type="url" maxLength={500} /></label>
        <label className="staff-wide">Описание и ваша роль<textarea required name="body" maxLength={1000} /></label><Button>Добавить в портфолио</Button>
      </form>
      {!entries.length && <p className="empty">Добавьте первый проект или достижение</p>}
      {entries.map((entry) => <article className="staff-row" key={entry.id}><h3>{entry.title}</h3>
        <p className="muted">{entry.kind} · {dateLabel(entry.occurredAt)} · {entry.shared ? "Видно сотрудникам вашей группы" : "Видно только вам"}</p>
        <p className="message-body">{entry.description}</p>{entry.link && <a className="text-link" href={entry.link} rel="noreferrer">Открыть результат</a>}
        <form className="staff-button-row" action={portfolio}><input type="hidden" name="id" value={entry.id} />
          <Button name="command" value={entry.shared ? "hide" : "share"} variant="secondary">{entry.shared ? "Скрыть" : "Показать сотрудникам"}</Button>
          <Button name="command" value="remove" variant="secondary">Удалить</Button>
        </form>
      </article>)}
    </section>}
    {tab === "profile" && <section className="panel content-stack"><h2>Электронный пропуск</h2><p>Демонстрационный пропуск для проверки сотрудником. Код действует 2 минуты.</p>
      {pass && <div><img src={image} alt="QR электронного пропуска" width={240} height={240} /><Link className="text-link" href={passLink}>Ссылка для сканирования</Link><p className="muted">Действует до {timeLabel(pass.expiresAt)} МСК</p></div>}
      <form action={issuePass}><Button>{pass ? "Обновить код" : "Показать QR-пропуск"}</Button></form>
    </section>}
  </main>;
}
