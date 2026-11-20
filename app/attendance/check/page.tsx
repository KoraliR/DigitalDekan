import { account } from "@/lib/access";
import { scanAttendance } from "../actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function Check({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token, done } = await searchParams;
  await account("STUDENT", "/attendance/check?token=" + encodeURIComponent(token ?? ""));
  return <main className="workspace"><section className="panel content-stack">
    <h1>Отметка посещения</h1>
    {done ? <p>Отметка обработана. Ранее выставленный преподавателем статус сохраняется.</p> :
      <form action={scanAttendance}><input type="hidden" name="token" value={token ?? ""} /><Button>Подтвердить присутствие</Button></form>}
    <Link href="/cabinet/today">К расписанию</Link>
  </section></main>;
}