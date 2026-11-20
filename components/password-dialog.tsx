"use client";
import { useEffect, useRef, useState } from "react";
import { KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField, PasswordMeter } from "@/components/ui/password-field";
import { Sheet } from "@/components/ui/sheet";
import { passwordError } from "@/lib/password.mjs";

interface Errors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export function PasswordDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) trigger.current?.focus();
  }, [open]);

  function toggle(next: boolean) {
    setOpen(next);
    setErrors({});
    setFormError("");
    setDone(false);
    setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Errors = {};
    if (!form.currentPassword) next.currentPassword = "Введите текущий пароль.";
    const invalid = passwordError(form.newPassword);
    if (invalid) next.newPassword = invalid;
    if (form.newPassword && form.newPassword !== form.confirmPassword) next.confirmPassword = "Пароли не совпадают.";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setFormError(typeof body.error === "string" ? body.error : "Не удалось сменить пароль."); return; }
      setDone(true);
      setOpen(false);
    } catch {
      setFormError("Сеть недоступна. Проверьте подключение и попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <button ref={trigger} type="button" className="button button-secondary" onClick={() => toggle(true)}>
      <KeyRound size={16} /> Сменить пароль
    </button>
    {done && <p className="notice" role="status">Пароль изменён. Следующий вход — с новым паролем.</p>}
    {open && <Sheet id="password-dialog" labelledBy="password-title" onClose={() => toggle(false)}>
      <div className="panel sheet-panel">
        <div className="sheet-head">
          <h2 id="password-title">Смена пароля</h2>
          <Button variant="icon" aria-label="Закрыть" onClick={() => toggle(false)}><X size={18} /></Button>
        </div>
        <p className="muted">Минимум 10 символов: строчные и заглавные буквы, цифры и знаки.</p>
        <form className="login-form" onSubmit={submit} noValidate>
          <Field label="Текущий пароль" htmlFor="current-password" error={errors.currentPassword}>
            <PasswordField id="current-password" name="currentPassword" autoComplete="current-password" value={form.currentPassword}
              onChange={(value) => setForm({ ...form, currentPassword: value })} invalid={Boolean(errors.currentPassword)} />
          </Field>
          <Field label="Новый пароль" htmlFor="new-password" error={errors.newPassword}>
            <PasswordField id="new-password" name="newPassword" autoComplete="new-password" value={form.newPassword}
              onChange={(value) => setForm({ ...form, newPassword: value })} invalid={Boolean(errors.newPassword)} />
          </Field>
          <PasswordMeter value={form.newPassword} />
          <Field label="Повторите новый пароль" htmlFor="confirm-password" error={errors.confirmPassword}>
            <PasswordField id="confirm-password" name="confirmPassword" autoComplete="new-password" value={form.confirmPassword}
              onChange={(value) => setForm({ ...form, confirmPassword: value })} invalid={Boolean(errors.confirmPassword)} />
          </Field>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="dialog-actions">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => toggle(false)}>Отмена</Button>
            <Button type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Сменить пароль"}</Button>
          </div>
        </form>
      </div>
    </Sheet>}
  </>;
}
