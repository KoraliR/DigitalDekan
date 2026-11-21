"use client";
import { finalGradeLabel, gradeBreakdown, type DashboardData } from "@/lib/model";

type Grade = DashboardData["grades"][number];

// Подробная разбивка баллов по дисциплине: практики, посещения и контрольные работы.
// Панель рендерится по клику на дисциплину в компоненте Grades (components/dashboard.tsx).
export function GradeBreakdown({ grade, id }: { grade: Grade; id: string }) {
  const rows = gradeBreakdown.map((item) => ({ ...item, value: grade[item.key] }));
  const filled = rows.filter((row) => row.value !== null);
  const sum = filled.length ? filled.reduce((total, row) => total + (row.value ?? 0), 0) : null;
  return <div className="grade-breakdown" id={id}>
    <p className="grade-breakdown-title">Из чего складывается балл</p>
    {rows.map((row) => <div className="grade-breakdown-row" key={row.key}>
      <span className="grade-breakdown-name">{row.label}</span>
      <span className="grade-breakdown-value">{row.value === null ? "—" : row.value + " / " + row.max}</span>
      <progress aria-label={row.label + " · " + grade.title} max={row.max} value={Math.max(0, Math.min(row.value ?? 0, row.max))} />
    </div>)}
    <p className="grade-breakdown-total">Сумма частей: <strong>{sum === null ? "—" : sum}</strong> из 100
      {" · "}Порог: <strong>{grade.threshold}</strong>{" · "}Итог: <strong>{finalGradeLabel(grade)}</strong></p>
  </div>;
}
