"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="workspace content-stack">
    <section className="panel content-stack">
      <h1>Что-то пошло не так</h1>
      <p className="muted">Не удалось загрузить раздел. Попробуйте обновить страницу.</p>
      {error.digest && <p className="muted">Код ошибки: {error.digest}</p>}
      <div className="profile-actions"><button className="button button-primary" onClick={() => reset()}>Повторить</button></div>
    </section>
  </main>;
}
