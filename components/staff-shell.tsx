import Link from "next/link";
import { Building2, CalendarDays, CalendarClock, ClipboardList, GraduationCap, History, LayoutDashboard, Megaphone, UserCheck, type LucideIcon } from "lucide-react";
import { logout } from "@/app/actions";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { PasswordDialog } from "@/components/password-dialog";
import { Owl } from "@/components/owl";
import { StaffBackdrop } from "@/components/staff-backdrop";

type StaffTab = { id: string; label: string; icon: LucideIcon; href?: string };

const tabs: StaffTab[] = [
  { id: "overview", label: "Обзор", icon: LayoutDashboard },
  { id: "requests", label: "Заявки", icon: ClipboardList },
  { id: "news", label: "Новости", icon: Megaphone },
  { id: "schedule", label: "Пары", icon: CalendarDays },
  { id: "attendance", label: "Посещение", icon: UserCheck },
  { id: "deadlines", label: "Дедлайны", icon: CalendarClock },
  { id: "grades", label: "Оценки", icon: GraduationCap },
  { id: "campus", label: "Сервисы кампуса", icon: Building2, href: "/staff/campus" },
  { id: "audit", label: "Аудит", icon: History },
];

export function StaffShell({ name, section, children }: { name: string; section: string; children: React.ReactNode }) {
  const current = tabs.find((tab) => tab.id === section)?.label ?? "Обзор";
  return <main className="workspace staff-workspace">
    {/* Мягкий фон кабинета: тёплые пятна и едва заметная сетка. */}
    <StaffBackdrop />

    <div className="staff-toolbar">
      <p className="staff-who"><span className="staff-who-dot" aria-hidden="true" />{name} · Сотрудник деканата</p>
      <div className="top-actions"><ThemeToggle /><PasswordDialog /><form action={logout}><Button variant="secondary">Выйти</Button></form></div>
    </div>

    <header className="staff-hero">
      <div className="staff-hero-copy">
        <p className="staff-hero-eyebrow">Деканат · {current}</p>
        <h1>Кабинет сотрудника</h1>
        <p className="staff-hero-sub">Заявки, пары, оценки и сервисы кампуса</p>
      </div>
      <div className="staff-hero-art" aria-hidden="true">
        <span className="staff-hero-ring staff-hero-ring-one" />
        <span className="staff-hero-ring staff-hero-ring-two" />
        <Owl className="staff-owl" idPrefix="staff-owl" />
      </div>
    </header>

    <p className="notice">Концепт для конкурса. Не является официальным сервисом вуза</p>
    <nav className="staff-nav" aria-label="Служебные разделы">
      {tabs.map(({ id, label, icon: Icon, href }) =>
        <Link key={id} href={href ?? "/staff?section=" + id} aria-current={section === id ? "page" : undefined}>
          <Icon size={19} aria-hidden="true" /><span>{label}</span>
        </Link>)}
    </nav>
    {children}
  </main>;
}
