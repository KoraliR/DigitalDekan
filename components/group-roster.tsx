"use client";
import { useState } from "react";
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
  students: { id: string; name: string; status?: AttendanceStatus }[];
  showSummary?: boolean;
}) {
  const present = students.filter(({ status }) => status === "PRESENT").length;
  const percentage = students.length ? Math.round(100 * present / students.length) : 0;
  return <form action={groupAttendance} className="content-stack">
    <input type="hidden" name="lesson" value={id} />
    {showSummary && students.length > 0 && <div className="attendance-summary" role="status">
      <span className="attendance-ring" style={{ "--attendance-progress": percentage + "%" } as React.CSSProperties} aria-hidden="true">
        <strong>{percentage}%</strong>
      </span>
      <div><strong>Присутствуют {present} из {students.length}</strong><p className="muted">Посещаемость группы · {percentage}%</p></div>
    </div>}
    {!students.length && <p>В группе пока нет студентов.</p>}
    <ul className="grade-register">{students.map((student) => <li key={student.id} className="grade-register-row">
      <AttendanceCheckbox key={student.status ?? ""} name={"mark-" + student.id} student={student.name} status={student.status} changesOnly />
    </li>)}</ul>
    <Button disabled={!students.length}>Сохранить отметки</Button>
  </form>;
}