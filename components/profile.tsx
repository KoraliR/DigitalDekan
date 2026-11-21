"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, LogOut, Mail, MessageCircle, Phone, ShieldCheck, UserRound } from "lucide-react";
import { logout } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { PasswordDialog } from "@/components/password-dialog";
import { SurnameStress } from "@/components/surname-stress";
import type { ProfileDTO } from "@/lib/profile";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string; unauthorized?: boolean }
  | { status: "ready"; profile: ProfileDTO };

const value = (input: string | number | null) => (input === null || input === "" ? "—" : String(input));

function formatBirthDate(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "long", year: "numeric" })
    .format(new Date(iso + "T00:00:00+03:00"));
}
function ageLabel(age: number) {
  const rule = new Intl.PluralRules("ru").select(age);
  return age + " " + (rule === "one" ? "год" : rule === "few" ? "года" : "лет");
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="profile-row"><dt>{label}</dt><dd>{children}</dd></div>;
}

function ProfileSkeleton() {
  return <div className="profile-stack" aria-busy="true" aria-label="Загрузка профиля">
    <div className="profile-grid">
      {[0, 1].map((panel) => <section className="panel" key={panel}>
        <div className="skeleton skeleton-title" />
        <div className="skeleton-list">{[0, 1, 2, 3].map((row) => <div className="skeleton skeleton-line" key={row} />)}</div>
      </section>)}
    </div>
    <section className="panel"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-line" /></section>
  </div>;
}

export function ProfileView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 401) throw Object.assign(new Error("Сессия истекла. Войдите заново."), { unauthorized: true });
          if (response.status === 403) throw new Error("Раздел доступен только студентам.");
          throw new Error(typeof body.error === "string" ? body.error : "Не удалось загрузить профиль.");
        }
        return body as ProfileDTO;
      })
      .then((profile) => { if (!cancelled) setState({ status: "ready", profile }); })
      .catch((error: Error & { unauthorized?: boolean }) => {
        if (!cancelled) setState({ status: "error", message: error.message, unauthorized: error.unauthorized });
      });
    return () => { cancelled = true; };
  }, [attempt]);

  if (state.status === "loading") return <ProfileSkeleton />;
  if (state.status === "error") return <section className="panel profile-error" role="alert">
    <h2>Профиль недоступен</h2>
    <p className="muted">{state.message}</p>
    <div className="profile-actions">
      {state.unauthorized
        ? <Button asChild><Link href="/login">Войти заново</Link></Button>
        : <Button onClick={() => setAttempt(attempt + 1)}>Повторить</Button>}
    </div>
  </section>;

  const profile = state.profile;
  const program = [profile.programCode, profile.programName].filter(Boolean).join(" · ");
  const updateSurnameStress = (stress: number | null) => setState((current) => current.status === "ready"
    ? { status: "ready", profile: { ...current.profile, surnameStress: stress } }
    : current);

  return <div className="profile-stack">
    <div className="profile-grid">
      <div className="profile-column">
        <section className="panel" aria-labelledby="personal-title">
          <div className="section-head"><div className="heading-with-icon"><span className="soft-icon"><UserRound size={20} /></span><div><h2 id="personal-title">Личные данные</h2><p className="muted">Из учебной базы</p></div></div></div>
          <dl className="profile-list">
            <Row label="ФИО">{value(profile.name)}</Row>
            <Row label="Дата рождения">{profile.birthDate ? formatBirthDate(profile.birthDate) + (profile.age !== null ? " · " + ageLabel(profile.age) : "") : "—"}</Row>
            <Row label="Номер зачётки">{value(profile.studentId)}</Row>
            <Row label="Логин">{value(profile.login)}</Row>
          </dl>
        </section>

        <SurnameStress name={profile.name} initialStress={profile.surnameStress} options={profile.surnameStressOptions} onSaved={updateSurnameStress} />
      </div>

      <section className="panel" aria-labelledby="study-title">
        <div className="section-head"><div className="heading-with-icon"><span className="soft-icon"><GraduationCap size={20} /></span><div><h2 id="study-title">Учёба</h2><p className="muted">Институт и группа</p></div></div></div>
        <dl className="profile-list">
          <Row label="Институт">{value(profile.institute)}</Row>
          <Row label="Факультет">{value(profile.faculty)}</Row>
          <Row label="Кафедра">{value(profile.department)}</Row>
          <Row label="Направление">{program || "—"}</Row>
          <Row label="Курс">{profile.course ? profile.course + "-й курс" : "—"}</Row>
          <Row label="Группа">{value(profile.groupName)}</Row>
          <Row label="Форма обучения">{profile.funding === "BUDGET" ? "Бюджет" : profile.funding === "CONTRACT" ? "Контракт" : "—"}</Row>
        </dl>
      </section>

      <section className="panel profile-span" aria-labelledby="contacts-title">
        <div className="section-head"><div className="heading-with-icon"><span className="soft-icon"><Phone size={20} /></span><div><h2 id="contacts-title">Контакты</h2><p className="muted">Как с вами связаться</p></div></div></div>
        <dl className="profile-list profile-contacts">
          <Row label="Телефон">{profile.phone ? <a className="profile-link" href={"tel:" + profile.phone.replace(/[^\d+]/g, "")}><Phone size={14} /> {profile.phone}</a> : "—"}</Row>
          <Row label="Email">{profile.contactEmail ? <a className="profile-link" href={"mailto:" + profile.contactEmail}><Mail size={14} /> {profile.contactEmail}</a> : "—"}</Row>
          <Row label="Мессенджер">{profile.messengerUrl ? <a className="profile-link" href={profile.messengerUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> {profile.messengerUrl.replace(/^https?:\/\//, "")}</a> : "—"}</Row>
        </dl>
      </section>
    </div>

    <section className="panel" aria-labelledby="security-title">
      <div className="section-head"><div className="heading-with-icon"><span className="soft-icon"><ShieldCheck size={20} /></span><div><h2 id="security-title">Безопасность</h2><p className="muted">Пароль и вход</p></div></div></div>
      <div className="profile-actions">
        <PasswordDialog />
        <form action={logout}><Button variant="secondary"><LogOut size={16} /> Выйти</Button></form>
      </div>
      <div className="twofa">
        <div>
          <p className="twofa-state"><ShieldCheck size={15} /> Двухфакторная аутентификация <strong>отключена</strong></p>
          <p className="muted">Вход выполняется только по паролю. Код из приложения-аутентификатора появится позже.</p>
        </div>
        {/* TODO: подключить реальную 2FA — хранение TOTP-секрета, показ QR при включении и проверка кода в auth.ts. */}
        <button type="button" className="switch" role="switch" aria-checked={false} aria-label="Двухфакторная аутентификация" disabled />
      </div>
    </section>
  </div>;
}
