import Link from "next/link";

export default function NotFound() {
  return <main className="workspace content-stack">
    <section className="panel content-stack">
      <h1>404 · Страница не найдена</h1>
      <p className="muted">Такого раздела нет. Вернитесь в кабинет или откройте демоверсию.</p>
      <div className="profile-actions">
        <Link className="button button-primary" href="/account">В кабинет</Link>
        <Link className="button button-secondary" href="/demo/today">Демоверсия</Link>
      </div>
    </section>
  </main>;
}
