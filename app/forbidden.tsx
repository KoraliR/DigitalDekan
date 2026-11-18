import Link from "next/link";
export default function Forbidden() {
  return <main className="workspace"><section className="panel">
    <h1>403 · Доступ запрещён</h1>
    <Link className="text-link" href="/account">Вернуться в свой кабинет</Link>
  </section></main>;
}