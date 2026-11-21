"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { saveDeadlineStatus } from "@/app/staff/actions";
import { Button } from "@/components/ui/button";

export interface DeadlineStudentRow {
  id: string;
  student: string;
  group: string;
  completed: boolean;
}

function SaveDeadlineButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <Button disabled={disabled || pending}><Save size={16} /> {pending ? "Сохраняем…" : "Сохранить отметки"}</Button>;
}

/**
 * Блок одного дедлайна: работа + дисциплина + срок + студенты группы с чекбоксом «Сдано».
 * Каждый студент сохраняется отдельно (цвет/состояние чекбокса индивидуально),
 * значение уходит в server action saveDeadlineStatus.
 */
export function DeadlineRoster({ title, course, dueLabel, late = false, group = "", pendingOnly = false, rows }: {
  title: string;
  course: string;
  dueLabel: string;
  late?: boolean;
  group?: string;
  pendingOnly?: boolean;
  rows: DeadlineStudentRow[];
}) {
  const block = useRef<HTMLDetailsElement>(null);
  const [done, setDone] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((row) => [row.id, row.completed])));
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash && block.current && rows.some((row) => "deadline-" + row.id === hash)) block.current.open = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const completed = rows.filter((row) => done[row.id]).length;
  return <details className="staff-row deadline-block" ref={block}>
    <summary>
      <span><strong>{title}</strong> · {course}</span>
      <span className="muted">{dueLabel}{late ? " · срок прошёл" : ""} · Сдано {completed} из {rows.length}</span>
    </summary>
    <form action={saveDeadlineStatus} className="deadline-marks">
      <input type="hidden" name="group" value={group} />
      {pendingOnly && <input type="hidden" name="pending" value="1" />}
      {rows.map((row) => <input key={"row-" + row.id} type="hidden" name="row" value={row.id} />)}
      <ul className="grade-register deadline-roster" aria-label={"Студенты · " + title}>
        {rows.map((row) => <li key={row.id} id={"deadline-" + row.id} className="grade-register-row">
          <label className="grade-register-student attendance-checkbox">
            <span><strong>{row.student}</strong><small>{row.group}</small></span>
            <span className={"deadline-state" + (done[row.id] ? " deadline-state-done" : "")} aria-live="polite">{done[row.id] ? "Сдано" : "Не сдано"}</span>
            <input type="checkbox" aria-label={"Сдано: " + row.student} checked={done[row.id] ?? false}
              onChange={(event) => setDone({ ...done, [row.id]: event.target.checked })} />
          </label>
          <input type="hidden" name={"done-" + row.id} value={done[row.id] ? "1" : "0"} />
        </li>)}
      </ul>
      {!rows.length && <p className="empty">В этой группе нет студентов с таким дедлайном.</p>}
      <SaveDeadlineButton disabled={!rows.length} />
    </form>
  </details>;
}
