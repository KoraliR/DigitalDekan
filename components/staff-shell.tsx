import Link from "next/link";
import { CalendarDays, ClipboardList, GraduationCap, History, LayoutDashboard, Megaphone } from "lucide-react";
import { logout } from "@/app/actions";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";

const tabs = [
  { id: "overview", label: "Обзор", icon: LayoutDashboard },
  { id: "requests", label: "Заявки", icon: ClipboardList },
  { id: "news", label: "Новости", icon: Megaphone },
  { id: "schedule", label: "Пары", icon: CalendarDays },
  { id: "grades", label: "Оценки", icon: GraduationCap },
  { id: "audit", label: "Аудит", icon: History },
];

export function StaffShell({ name, section, children }: { name: string; section: string; children: React.ReactNode }) {
  return <main className="workspace staff-workspace">
    <header className="section-head">
      <div><p className="muted">{name} · Сотрудник деканата</p><h1>Кабинет сотрудника</h1></div>
      <div className="top-actions"><ThemeToggle /><form action={logout}><Button variant="secondary">Выйти</Button></form></div>
    </header>
    <p className="notice">Концепт для конкурса. Не является официальным сервисом вуза</p>
    <nav className="staff-nav" aria-label="Служебные разделы">
      {tabs.map(({ id, label, icon: Icon }) =>
        <Link key={id} href={"/staff?section=" + id} aria-current={section === id ? "page" : undefined}>
          <Icon size={19} aria-hidden="true" /><span>{label}</span>
        </Link>)}
    </nav>
    {children}
  </main>;
}
