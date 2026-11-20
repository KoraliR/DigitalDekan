import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { campusDay, plusDays } from "@/lib/model";

export const slotLabels = {
  CONSULTATION: "Консультация", RETAKE: "Пересдача", ROOM: "Аудитория",
  COWORKING: "Коворкинг", EQUIPMENT: "Оборудование", SPORT: "Спортзал",
} as const;
export const categories = ["Общежитие", "Репетиторы", "Команды"] as const;
export const portfolioKinds = ["Проект", "Достижение", "Сертификат"] as const;

export function displayStudent(name: string, stress?: number | null) {
  if (stress == null) return name;
  const lastWord = name.lastIndexOf(" ") + 1;
  const index = lastWord + stress;
  if (!/[аеёиоуыэюяaeiouy]/i.test(name[index] ?? "")) return name;
  return name.slice(0, index + 1) + "\u0301" + name.slice(index + 1);
}

type Student = { id: string; groupId?: string | null };
export async function availableSlots(tx: Prisma.TransactionClient, student: Student, id?: string) {
  const grades = await tx.grade.findMany({ where: { userId: student.id }, select: { title: true, term: true, score: true, threshold: true, passed: true, finalGrade: true } });
  const retakes = grades.filter((grade) => grade.passed === false || grade.finalGrade === 2 ||
    (grade.passed == null && grade.finalGrade == null && grade.score < grade.threshold));
  return tx.campusSlot.findMany({
    where: { id, startsAt: { gt: new Date() }, AND: [
      { OR: [{ groupId: null }, ...(student.groupId ? [{ groupId: student.groupId }] : [])] },
      { OR: [{ kind: { not: "RETAKE" } }, ...retakes.map(({ title, term }) => ({ kind: "RETAKE" as const, title, retakeTerm: term }))] },
    ] },
    include: { staff: { select: { name: true } }, _count: { select: { bookings: true } },
      bookings: { where: { userId: student.id }, select: { userId: true } } },
    orderBy: { startsAt: "asc" },
    take: 80,
  });
}

export async function attendanceStreak(id: string, groupId?: string | null) {
  const today = campusDay(new Date());
  const from = plusDays(today, -90);
  from.setTime(+from - 12 * 60 * 60 * 1000);
  const [personal, group] = await Promise.all([
    db.lesson.findMany({ where: { userId: id, startsAt: { gte: from }, endsAt: { lte: new Date() } },
      select: { startsAt: true, attendances: { where: { userId: id }, select: { status: true } } } }),
    groupId ? db.groupLesson.findMany({ where: { groupId, startsAt: { gte: from }, endsAt: { lte: new Date() } },
      select: { startsAt: true, marks: { where: { userId: id }, select: { status: true } } } }) : [],
  ]);
  const days = new Map<string, (string | undefined)[]>();
  for (const row of [...personal.map((lesson) => ({ date: lesson.startsAt, status: lesson.attendances[0]?.status })),
                     ...group.map((lesson) => ({ date: lesson.startsAt, status: lesson.marks[0]?.status }))]) {
    const day = campusDay(row.date);
    days.set(day, [...(days.get(day) ?? []), row.status]);
  }
  let count = 0;
  let waiting = false;
  for (const [, marks] of [...days.entries()].sort(([a], [b]) => b.localeCompare(a))) {
    if (marks.includes("ABSENT")) break;
    if (marks.includes(undefined)) { waiting = true; continue; }
    if (marks.includes("PRESENT")) count += 1;
  }
  return { count, waiting };
}

export function publicUrl(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function serializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
