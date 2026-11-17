import { notFound } from "next/navigation";
export const tabs = ["today", "grades", "services", "map", "calendar"] as const;
export type Tab = typeof tabs[number];
export function validTab(value: string): Tab {
  const tab = tabs.find((item) => item === value);
  if (!tab) notFound();
  return tab;
}