import { forbidden, redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function account(role?: Role) {
  const session = await auth();
  if (!session?.accountId) redirect("/login");
  const user = await db.user.findUnique({
    where: { id: session.accountId },
    select: { id: true, name: true, role: true, groupId: true },
  });
  if (!user) redirect("/login");
  if (role && role !== user.role) forbidden();
  return user;
}
export function staffGroups(staffId: string) {
  return { staff: { some: { id: staffId, role: "STAFF" as const } } };
}
export function staffStudents(staffId: string) {
  return { role: "STUDENT" as const, group: staffGroups(staffId) };
}