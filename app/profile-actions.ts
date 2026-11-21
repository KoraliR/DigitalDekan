"use server";
import { revalidatePath } from "next/cache";
import { account } from "@/lib/access";
import { db } from "@/lib/db";
import { displayStudent } from "@/lib/campus-tools";

// Сохранение ударения в фамилии студента. Пустая строка — снять ударение (null).
// Индекс гласной отсчитывается от начала последнего слова ФИО (фамилии).
export async function saveSurname(stress: string): Promise<{ ok: true } | { error: string }> {
  const user = await account("STUDENT");
  const lastName = user.name.split(" ").at(-1) ?? "";
  const raw = typeof stress === "string" ? stress.trim() : "";
  const index = raw === "" ? null : Number(raw);
  if (index !== null && (!Number.isInteger(index) || index < 0 || displayStudent(lastName, index) === lastName)) {
    return { error: "Выберите ударную гласную в фамилии." };
  }
  await db.studentProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, surnameStress: index },
    update: { surnameStress: index },
  });
  revalidatePath("/cabinet/profile");
  revalidatePath("/cabinet", "layout");
  return { ok: true };
}
