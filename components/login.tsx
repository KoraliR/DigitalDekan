"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, GraduationCap, ShieldCheck } from "lucide-react";
import { finishLogin, startLogin } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme";

export function Login({ enabled, staff = false }: { enabled: boolean; staff?: boolean }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, run] = useTransition();

  function submit(form: FormData) {
    setError("");
    run(async () => {
      try {
        if (code) { const result = await finishLogin(form); if (result?.url) window.location.assign(result.url); else setError(result?.error ?? ""); }
        else {
          const result = await startLogin(form);
          if (result.code) setCode(result.code);
          else setError(result.error ?? "");
        }
      } catch {
        setError("Не удалось завершить вход. Повторите попытку.");
      }
    });
  }
  return <main className="login-page">
    <div className="login-theme"><ThemeToggle /></div>
    <section className="panel login-card">
      {code && <Button variant="icon" className="login-back" type="button" aria-label="Назад" onClick={() => { setCode(""); setError(""); }}><ArrowLeft size={20} /></Button>}
      <span className="brand-mark login-mark">{code ? <ShieldCheck /> : <GraduationCap />}</span>
      <h1>{code ? "Подтверждение входа" : staff ? "Вход сотрудника" : "Цифровой деканат"}</h1>
      <p className="muted">{code ? "Введите шестизначный код. Он действует 5 минут." : "Вход в личный кабинет"}</p>
      {enabled && <form action={submit} className="login-form" key={code ? "code" : "password"}>
        {code ? <>
          <div className="notice">Код для демонстрации <strong>{code}</strong></div>
          <label>Код подтверждения<input className="otp" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
        </> : <>
          <input type="hidden" name="entry" value={staff ? "staff" : "student"} />
          <label>Логин<input name="login" autoComplete="username" maxLength={80} required /></label>
          <label>Пароль<span className="password-field"><input name="password" type={visible ? "text" : "password"} autoComplete="current-password" required />
            <Button variant="icon" type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Скрыть пароль" : "Показать пароль"}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</Button>
          </span></label>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button disabled={pending}>{pending ? "Проверяем…" : code ? "Подтвердить" : "Войти"}<ArrowRight size={17} /></Button>
      </form>}
      {!enabled && <p className="notice">Вход с учётной записью отключён в настройках сервера.</p>}
      <Link className="text-link" href={staff ? "/login" : "/staff-login"}>{staff ? "Вход студента" : "Вход сотрудника"}</Link>
      <Button asChild variant="secondary" className="demo-link"><Link href="/demo/today">Открыть демоверсию</Link></Button>
    </section>
  </main>;
}