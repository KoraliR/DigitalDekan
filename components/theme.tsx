"use client";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("dekanat-theme", next); } catch {}
  }
  return <Button variant="icon" onClick={toggle} type="button" aria-label="Переключить светлую и тёмную тему">
    <Moon className="moon" size={19} /><Sun className="sun" size={19} />
  </Button>;
}