"use client";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, ChevronDown, Save, Search } from "lucide-react";
import { saveGrade } from "@/app/staff/actions";
import { assessments, finalGradeLabel } from "@/lib/model";
import { Button } from "@/components/ui/button";
import type { Grade } from "@prisma/client";

type Result = Pick<Grade, "score" | "threshold" | "assessment" | "finalGrade" | "passed">;

export function GradeFields({ grade, disabled = false, canAdvance = false }: { grade?: Result; disabled?: boolean; canAdvance?: boolean }) {
  const [assessment, setAssessment] = useState(grade?.assessment ?? "");
  const { pending } = useFormStatus();

  return <>
    <fieldset className="grade-fields staff-wide" disabled={pending || disabled}>
      <label>Балл из 100<input name="score" type="number" min={0} max={100} defaultValue={grade?.score} required /></label>
      <label>Порог зачёта<input name="threshold" type="number" min={1} max={100} defaultValue={grade?.threshold ?? 60} required /></label>
      <label>Аттестация<select name="assessment" value={assessment} onChange={(event) => setAssessment(event.target.value as typeof assessment)}>
        <option value="">Только баллы</option>
        {Object.entries(assessments).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
      </select></label>
      {assessment === "TEST" && <label>Результат зачёта<select name="passed" defaultValue={grade?.passed == null ? "" : String(grade.passed)}>
        <option value="">Не выставлен</option><option value="true">Зачтено</option><option value="false">Не зачтено</option>
      </select></label>}
      {(assessment === "EXAM" || assessment === "COURSEWORK" || (!assessment && grade?.finalGrade != null)) &&
        <label>Итоговая оценка<select name="finalGrade" defaultValue={grade?.finalGrade ?? ""}>
          <option value="">Не выставлена</option>
          {[2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
        </select></label>}
    </fieldset>
        <div className="staff-wide staff-button-row grade-save">
      <Button variant={canAdvance ? "secondary" : "primary"} disabled={pending || disabled}><Save size={16} /> {pending ? "Сохраняем…" : "Сохранить оценку"}</Button>
      {canAdvance && <Button name="advance" value="1" disabled={pending || disabled}>Сохранить и открыть следующего <ArrowRight size={16} /></Button>}
    </div>
  </>;
}

export function GradeRegister({ title, term, group, initialStudent, initialSearch = "", initialUngraded = false, rows }: {
  title: string;
  term: number;
  group?: string;
  initialStudent?: string;
  initialSearch?: string;
  initialUngraded?: boolean;
  rows: { id: string; name: string; group: string; grade?: Result }[];
}) {
  const [selected, select] = useState(initialStudent);
  const [search, setSearch] = useState(initialSearch);
  const [ungraded, setUngraded] = useState(initialUngraded);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    function guard(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function canLeave() {
    if (dirty && !window.confirm("Оценка ещё не сохранена. Отменить изменения?")) return false;
    setDirty(false);
    return true;
  }
  function filtered(query: string, missingOnly: boolean) {
    const normalized = query.trim().replace(/\u0301/g, "").toLocaleLowerCase("ru");
    return rows.filter(({ name, group: groupName, grade }) =>
      (!missingOnly || !grade) && (name + " " + groupName).replace(/\u0301/g, "").toLocaleLowerCase("ru").includes(normalized));
  }
  function updateFilters(query: string, missingOnly: boolean) {
    if (selected && !filtered(query, missingOnly).some(({ id }) => id === selected)) {
      if (!canLeave()) return;
      select(undefined);
    }
    setSearch(query);
    setUngraded(missingOnly);
  }
  const visibleRows = filtered(search, ungraded);
  const graded = rows.filter(({ grade }) => grade).length;

  return <section className="grade-journal" aria-label="Журнал по предмету">
    <div className="grade-journal-toolbar">
      <label className="grade-search"><Search size={17} aria-hidden="true" />
        <input type="search" aria-label="Найти студента или группу" placeholder="Найти студента или группу" value={search} onChange={(event) => updateFilters(event.target.value, ungraded)} />
      </label>
      <label className="grade-ungraded"><input type="checkbox" checked={ungraded} onChange={(event) => updateFilters(search, event.target.checked)} /> Только без оценки</label>
    </div>
    <p className="muted">Оценки выставлены: {graded} из {rows.length}</p>
    {!visibleRows.length && <p className="empty">{rows.length ? "По этим условиям студентов нет" : "В группе пока нет студентов"}</p>}
    <ul className="grade-register" aria-label="Студенты">
      {visibleRows.map(({ id, name, group: groupName, grade }, index) => {
        const active = selected === id;
        const result = grade ? finalGradeLabel(grade) : "—";
        const next = visibleRows[index + 1]?.id;
        const panelId = "grade-editor-" + id;
        return <li key={id} className="grade-register-row" data-selected={active}>
          <button type="button" className="grade-register-student" aria-expanded={active} aria-controls={active ? panelId : undefined} onClick={() => { if (canLeave()) select(active ? undefined : id); }}>
            <span><strong>{name}</strong><small>{groupName}</small></span>
            <span className="grade-row-result">
              <span className="grade-score-chip">{grade ? grade.score + " / 100" : "Без оценки"}</span>
              {result !== "—" && <small>{result}</small>}
            </span>
            <ChevronDown className="grade-row-chevron" size={17} aria-hidden="true" />
          </button>
          {active && <form id={panelId} className="staff-fields grade-editor" action={saveGrade} onChange={() => setDirty(true)} onSubmit={() => setDirty(false)} aria-label={"Оценка · " + name}>
            <input type="hidden" name="register" value="1" /><input type="hidden" name="group" value={group ?? ""} />
            <input type="hidden" name="student" value={id} /><input type="hidden" name="title" value={title} /><input type="hidden" name="term" value={term} />
            <input type="hidden" name="nextStudent" value={next ?? ""} /><input type="hidden" name="q" value={search} /><input type="hidden" name="ungraded" value={ungraded ? "1" : ""} />
            <GradeFields canAdvance={Boolean(next)} key={JSON.stringify(grade && [grade.score, grade.threshold, grade.assessment, grade.finalGrade, grade.passed])} grade={grade} />
          </form>}
        </li>;
      })}
    </ul>
  </section>;
}