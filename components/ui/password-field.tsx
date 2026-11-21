"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { passwordScore, passwordLabel } from "@/lib/password.mjs";

export function PasswordField({ id, name, autoComplete, value, onChange, required, invalid, describedBy }: {
  id: string;
  name: string;
  autoComplete: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);
  return <span className="password-field">
    <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} required={required}
      value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      aria-invalid={invalid || undefined} aria-describedby={describedBy} suppressHydrationWarning />
    <Button variant="icon" type="button" aria-label={visible ? "Скрыть пароль" : "Показать пароль"} onClick={() => setVisible(!visible)}>
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </Button>
  </span>;
}

export function PasswordMeter({ value }: { value: string }) {
  if (!value) return null;
  const score = passwordScore(value);
  return <div className="meter">
    <span className={"meter-track score-" + score} aria-hidden="true"><span className="meter-fill" /></span>
    <span className="meter-label" role="status" aria-live="polite">Надёжность: {passwordLabel(score)}</span>
  </div>;
}
