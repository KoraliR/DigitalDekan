import type { Funding } from "@prisma/client";
import { db } from "@/lib/db";
import { campusDay } from "@/lib/model";

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
  const user = await db.user.findUnique({ where: { id: userId }, include: { studentProfile: true } });
  if (!user) return null;
  const profile = user.studentProfile;
  return {
    id: user.id,
    name: user.name,
    login: user.login,
    birthDate: profile?.birthDate ? campusDay(profile.birthDate) : null,
    age: profile?.birthDate ? ageFrom(profile.birthDate) : null,
    studentId: profile?.studentId ?? null,
    institute: profile?.institute ?? null,
    faculty: profile?.faculty ?? null,
    department: profile?.department ?? null,
    programCode: profile?.programCode ?? null,
    programName: profile?.programName ?? null,
    course: profile?.course ?? null,
    groupName: profile?.groupName ?? null,
    funding: profile?.funding ?? null,
    phone: profile?.phone ?? null,
    contactEmail: profile?.contactEmail ?? null,
    messengerUrl: profile?.messengerUrl ?? null,
  };
}
