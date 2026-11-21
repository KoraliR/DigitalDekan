import type { Funding } from "@prisma/client";
import { displayStudent } from "@/lib/campus-tools";
import { db } from "@/lib/db";
import { campusDay } from "@/lib/model";

// Вариант отображения ФИО с ударением на конкретной гласной фамилии.
// Строки готовятся на сервере: displayStudent живёт в lib/campus-tools.ts вместе с Prisma-клиентом,
// поэтому в клиентский бандл (плитка профиля) он не попадает.
export interface SurnameStressOption {
  index: number;
  label: string;
  full: string;
}

export interface ProfileDTO {
  id: string;
  name: string;
  login: string;
  birthDate: string | null;
  age: number | null;
  studentId: string | null;
  institute: string | null;
  faculty: string | null;
  department: string | null;
  programCode: string | null;
  programName: string | null;
  course: number | null;
  groupName: string | null;
  funding: Funding | null;
  phone: string | null;
  contactEmail: string | null;
  messengerUrl: string | null;
  surnameStress: number | null;
  surnameStressOptions: SurnameStressOption[];
}

const vowels = /[аеёиоуыэюяaeiouy]/i;

function stressOptions(name: string): SurnameStressOption[] {
  const lastName = name.split(" ").at(-1) ?? "";
  return [...lastName].flatMap((letter, index) => vowels.test(letter)
    ? [{ index, label: displayStudent(lastName, index), full: displayStudent(name, index) }]
    : []);
}

function parts(date: Date) {
  return campusDay(date).split("-").map(Number) as [number, number, number];
}

export function ageFrom(birthDate: Date, today = new Date()) {
  const [birthYear, birthMonth, birthDay] = parts(birthDate);
  const [year, month, day] = parts(today);
  const age = year - birthYear;
  return month < birthMonth || (month === birthMonth && day < birthDay) ? age - 1 : age;
}

export function fundingLabel(funding: Funding | null) {
  if (funding === "BUDGET") return "Бюджет";
  if (funding === "CONTRACT") return "Контракт";
  return null;
}

export async function profileFor(userId: string): Promise<ProfileDTO | null> {
  const user = await db.user.findUnique({ where: { id: userId }, include: { studentProfile: { include: { group: true } } } });
  if (!user) return null;
  const profile = user.studentProfile;
  const group = profile?.group;
  return {
    id: user.id,
    name: user.name,
    login: user.login,
    birthDate: profile?.birthDate ? campusDay(profile.birthDate) : null,
    age: profile?.birthDate ? ageFrom(profile.birthDate) : null,
    studentId: profile?.studentId ?? null,
    institute: profile?.institute ?? null,
    faculty: group?.faculty ?? profile?.faculty ?? null,
    department: profile?.department ?? null,
    programCode: profile?.programCode ?? null,
    programName: profile?.programName ?? null,
    course: group?.course ?? profile?.course ?? null,
    groupName: group?.name ?? profile?.groupName ?? null,
    funding: profile?.funding ?? null,
    phone: profile?.phone ?? null,
    contactEmail: profile?.contactEmail ?? null,
    messengerUrl: profile?.messengerUrl ?? null,
    surnameStress: profile?.surnameStress ?? null,
    surnameStressOptions: stressOptions(user.name),
  };
}
