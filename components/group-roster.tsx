"use client";
import { useEffect, useState } from "react";
import { CheckCheck, Save } from "lucide-react";
import { attendanceStatuses } from "@/lib/model";
import { groupAttendance } from "@/app/attendance/actions";
import { Button } from "@/components/ui/button";
import type { AttendanceStatus } from "@prisma/client";

export function AttendanceCheckbox({ name, student, status, changesOnly = false }: {
  name: string;
  student: string;
  status?: AttendanceStatus;
  changesOnly?: boolean;
}) {
  const [edited, setEdited] = useState<AttendanceStatus>();
  const current = edited ?? status;
  return <label className="grade-register-student attendance-checkbox">
    <span><strong>{student}</strong><small aria-live="polite">{current ? attendanceStatuses[current].label : "Не отмечено"}</small></span>
    <input type="checkbox" aria-label={"Присутствует: " + student} checked={current === "PRESENT"}
      onChange={(event) => setEdited(event.target.checked ? "PRESENT" : "ABSENT")} />
    <input type="hidden" name={name} value={(changesOnly ? edited : current) ?? ""} />
  </label>;
}

export function GroupRoster({ id, students, showSummary = false }: {
  id: string;
  students: { id: string; name: string; status?: AttendanceStatus | null }[];
  showSummary?: boolean;
}) {
  const [edits, setEdits] = useState<Record<string, AttendanceStatus>>({});
  useEffect(() => { setEdits({}); }, [students]);
  const rows = students.map((student) => ({ ...student, current: edits[student.id] ?? student.status }));
  const present = rows.filter(({ current }) => current === "PRESENT").length;
  const absent = rows.filter(({ current }) => current === "ABSENT").length;
  const pending = rows.filter(({ current }) => !current).length;
  const excused = students.length - present - absent - pending;
  function markAll() {
    setEdits({ ...edits, ...Object.fromEntries(rows.filter(({ current }) => !current).map(({ id }) => [id, "PRESENT" as const])) });
  }
  const percentage = students.length ? Math.round(100 * present / students.length) : 0;
  return <form action={groupAttendance} className="content-stack">
    <input type="hidden" name="lesson" value={id} />
    {showSummary && students.length > 0 && !Object.keys(edits).length && <div className="attendance-summary" role="status">
      <span className="attendance-ring" style={{ "--attendance-progress": percentage + "%" } as React.CSSProperties} aria-hidden="true">
        <strong>{percentage}%</strong>
      </span>
      <div><strong>Присутствуют {present} из {students.length}</strong><p className="muted">Посещаемость группы · {percentage}%</p></div>
    </div>}
    {!students.length && <p>В группе пока нет студентов.</p>}
    {students.length > 0 && <>
      <div className="staff-button-row attendance-counts" aria-live="polite">
        <span>Присутствуют <strong>{present}</strong></span><span>Отсутствуют <strong>{absent}</strong></span>
        <span>Не отмечены <strong>{pending}</strong></span>{excused > 0 && <span>Уважительная причина <strong>{excused}</strong></span>}
      </div>
      <Button type="button" variant="secondary" className="attendance-bulk" onClick={markAll} disabled={!pending}><CheckCheck size={17} /> Отметить присутствующими всех неотмеченных</Button>
    </>}
    <ul className="grade-register">{rows.map((student) => <li key={student.id} className="grade-register-row">
      <label className="grade-register-student attendance-checkbox">
        <span><strong>{student.name}</strong><small>{student.current ? attendanceStatuses[student.current].label : "Не отмечено"}</small></span>
        <input type="checkbox" aria-label={"Присутствует: " + student.name} checked={student.current === "PRESENT"}
          onChange={(event) => setEdits({ ...edits, [student.id]: event.target.checked ? "PRESENT" : "ABSENT" })} />
        <input type="hidden" name={"mark-" + student.id} value={edits[student.id] ?? ""} />
      </label>
    </li>)}</ul>
    <Button disabled={!students.length}><Save size={16} /> Сохранить отметки</Button>
  </form>;
}