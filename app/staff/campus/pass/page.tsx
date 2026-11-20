import { createHash } from "node:crypto";
import Link from "next/link";
import { account } from "@/lib/access";
import { db } from "@/lib/db";
import { displayStudent } from "@/lib/campus-tools";
import { timeLabel } from "@/lib/model";

export default async function ValidatePass({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const staff = await account("STAFF");
  const { token } = await searchParams;
  const pass = typeof token === "string" && /^[a-f0-9]{48}$/.test(token) ? await db.campusPass.findFirst({
    where: { digest: createHash("sha256").update(token).digest("hex"), expiresAt: { gt: new Date() },
      user: { role: "STUDENT", studentProfile: { group: { staff: { some: { userId: staff.id } } } } } },
    select: { expiresAt: true, user: { select: { name: true, studentProfile: { select: { surnameStress: true, group: { select: { name: true } } } } } } },
  }) : null;
  return <main className="workspace"><section className="panel content-stack">
    <p className="notice">Концепт для конкурса · Демонстрационная проверка пропуска</p>
    <h1>{pass ? "Пропуск действителен" : "Пропуск не подтверждён"}</h1>
    {pass ? <><h2>{displayStudent(pass.user.name, pass.user.studentProfile?.surnameStress)}</h2>
      <p>{pass.user.studentProfile?.group?.name} · до {timeLabel(pass.expiresAt)} МСК</p></> : <p>Запросите свежий QR-код у студента вашей группы.</p>}
    <Link href="/staff/campus" className="text-link">К сервисам кампуса</Link>
  </section></main>;
}