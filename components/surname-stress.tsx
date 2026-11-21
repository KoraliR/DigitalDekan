"use client";
import { useState, useTransition } from "react";
import { Type } from "lucide-react";
import { saveSurname } from "@/app/profile-actions";
import { Button } from "@/components/ui/button";
import type { SurnameStressOption } from "@/lib/profile";

// Плитка «Ударение в фамилии». Варианты отображения ФИО с ударением готовятся на сервере
// (lib/profile.ts), здесь только выбор, предпросмотр и сохранение через server action.
export function SurnameStress({ name, initialStress, options, onSaved }: {
  name: string;
  initialStress: number | null;
  options: SurnameStressOption[];
  onSaved?: (stress: number | null) => void;
}) {
  const [stress, setStress] = useState<number | null>(initialStress);
  const [status, setStatus] = useState<"saved" | "">("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const display = stress === null ? name : options.find((option) => option.index === stress)?.full ?? name;

  function save() {
    setStatus("");
    setError("");
    startTransition(async () => {
      try {
        const result = await saveSurname(stress === null ? "" : String(stress));
        if ("error" in result) { setError(result.error); return; }
        setStatus("saved");
        onSaved?.(stress);
      } catch {
        setError("Не удалось сохранить ударение. Попробуйте ещё раз.");
      }
    });
  }

  return <section className="panel surname-stress" aria-labelledby="surname-stress-title">
    <div className="section-head"><div className="heading-with-icon"><span className="soft-icon"><Type size={20} /></span>
      <div><h2 id="surname-stress-title">Ударение в фамилии</h2><p className="muted">Как читать вашу фамилию в документах</p></div></div></div>
    <p className="surname-current" lang="ru">{display}</p>
    <form className="surname-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <label className="surname-field">Ударная гласная
        <select value={stress === null ? "" : String(stress)} onChange={(event) => {
          const value = event.target.value;
          setStress(value === "" ? null : Number(value));
          setStatus("");
          setError("");
        }}>
          <option value="">Без ударения</option>
          {options.map((option) => <option key={option.index} value={option.index}>{option.label}</option>)}
        </select>
      </label>
      <Button type="submit" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить ударение"}</Button>
    </form>
    {status === "saved" && <p className="surname-status" role="status">Сохранено</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="muted surname-hint">Ударение видно в журналах посещаемости, заявках и электронном пропуске.</p>
  </section>;
}
