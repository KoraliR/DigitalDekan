"use client";
import { useState } from "react";
import { saveGrade } from "@/app/staff/actions";
import { assessments, finalGradeLabel } from "@/lib/model";
import { Button } from "@/components/ui/button";
import type { Grade } from "@prisma/client";

type Result = Pick<Grade, "score" | "threshold" | "assessment" | "finalGrade" | "passed">;

export function GradeRegister({ title, term, group, initialStudent, rows }: {
  title: string;
  term: number;
  group?: string;
  initialStudent?: string;
  rows: { id: string; name: string; group: string; grade?: Result }[];
}) {
  const [selected, select] = useState(initialStudent);
  return <ul className="grade-register" aria-label="Студенты">
    {rows.map(({ id, name, group: groupName, grade }) => {
      const active = selected === id;
      return <li key={id} className="grade-register-row" data-selected={active}>
        <button type="button" className="grade-register-student" aria-expanded={active} onClick={() => select(active ? undefined : id)}>
          <span><strong>{name}</strong><small>{groupName}</small></span>
          <span>{grade ? grade.score + " / " + grade.threshold + " · " + finalGradeLabel(grade) : "Без оценки"}</span>
        </button>
        {active && <form className="staff-fields" action={saveGrade} aria-label={"Оценка · " + name}>
          <input type="hidden" name="register" value="1" /><input type="hidden" name="group" value={group ?? ""} />
          <input type="hidden" name="student" value={id} /><input type="hidden" name="title" value={title} /><input type="hidden" name="term" value={term} />
          <label>Аттестация<select name="assessment" defaultValue={grade?.assessment ?? ""}><option value="">—</option>{Object.entries(assessments).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
          <label>Балл<input name="score" type="number" min={0} max={100} defaultValue={grade?.score} required /></label>
          <label>Порог<input name="threshold" type="number" min={1} max={100} defaultValue={grade?.threshold ?? 60} required /></label>
          <label>Итог (2–5)<input name="finalGrade" type="number" min={2} max={5} defaultValue={grade?.finalGrade ?? ""} /></label>
          <label>Зачёт<select name="passed" defaultValue={grade?.passed == null ? "" : String(grade.passed)}><option value="">—</option><option value="true">Зачтено</option><option value="false">Не зачтено</option></select></label>
          <Button>Сохранить оценку</Button>
        </form>}
      </li>;
    })}
  </ul>;
}