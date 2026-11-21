/**
 * Новости: подписи, разбор аудитории и фильтр видимости для студента.
 * Аудитория хранится строкой: "all" | "group:<id>" | "faculty:<название>" |
 * "course:<номер>" | "staff:<id сотрудника>" (все группы, закреплённые за сотрудником).
 */
export type NewsGroupRef = { id: string; name: string };

export function newsKindLabel(kind: string | null | undefined) {
  return kind === "reminder" ? "Напоминание" : "Новость";
}

export function newsKindClass(kind: string | null | undefined) {
  return kind === "reminder" ? "warn" : "info";
}

export function newsAudienceLabel(audience: string, groups: NewsGroupRef[] = []) {
  if (audience === "all") return "Все группы";
  const index = audience.indexOf(":");
  if (index < 0) return audience;
  const kind = audience.slice(0, index);
  const value = audience.slice(index + 1);
  if (kind === "group") return "Группа · " + (groups.find((group) => group.id === value)?.name ?? "—");
  if (kind === "faculty") return "Факультет · " + value;
  if (kind === "course") return "Курс · " + value;
  if (kind === "staff") return "Все группы сотрудника";
  return audience;
}

/** Какие значения audience видит студент с указанной группой и её сотрудниками. */
export function studentNewsAudiences(
  group: { id: string; faculty: string; course: number } | null,
  staffIds: string[],
) {
  return [
    "all",
    ...(group ? ["group:" + group.id, "faculty:" + group.faculty, "course:" + group.course] : []),
    ...staffIds.map((id) => "staff:" + id),
  ];
}
