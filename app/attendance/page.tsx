import { displayStudent } from "@/lib/campus-tools";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { account } from "@/lib/access";
import { db } from "@/lib/db";
import { dateLabel, timeLabel } from "@/lib/model";
import { Button } from "@/components/ui/button";
import { GroupRoster } from "@/components/group-roster";

export default async function Monitor({ searchParams }: { searchParams: Promise<{ lesson?: string; saved?: string }> }) {
  const actor = await account("STUDENT");
  const { lesson: id, saved } = await searchParams;
  const profile = await db.studentProfile.findUnique({ where: { userId: actor.id }, include: { group: { select: { name: true } } } });
  if (!profile?.isMonitor || !profile.groupId) forbidden();
  const lessons = await db.groupLesson.findMany({ where: { groupId: profile.groupId }, orderBy: { startsAt: "desc" } });
  const lesson = lessons.find((item) => item.id === id);
  if (id && !lesson) forbidden();
  const students = lesson ? await db.user.findMany({ where: { role: "STUDENT", studentProfile: { groupId: profile.groupId } },
    orderBy: { name: "asc" }, select: { id: true, name: true, studentProfile: { select: { surnameStress: true } }, groupMarks: { where: { lessonId: lesson.id } } },
  }) : [];
  return <main className="workspace"><section className="panel content-stack">
    <div className="section-head journal-head">
      <div><h1>Журнал старосты</h1><p className="muted">Группа {profile.group?.name ?? "—"} · отметка посещаемости групповых пар</p></div>
      <div className="top-actions">
        {lesson && <Button asChild variant="secondary"><Link href="/attendance">К списку пар</Link></Button>}
        <Button asChild><Link href="/cabinet/today">← Выйти из журнала</Link></Button>
      </div>
    </div>
    {saved && <p className="notice" role="status">Отметки сохранены</p>}
    {lesson ? <><h2>{lesson.title}</h2>
      <GroupRoster showSummary={saved === "1"} id={lesson.id} students={students.map((student) => ({ ...student, name: displayStudent(student.name, student.studentProfile?.surnameStress), status: student.groupMarks[0]?.status }))} /></> :
      <ul className="service-list">{lessons.map((item) => <li key={item.id}><Link className="service-item" href={"/attendance?lesson=" + item.id}>{dateLabel(item.startsAt)}, {timeLabel(item.startsAt)} · {item.title}</Link></li>)}</ul>}
  </section></main>;
}
