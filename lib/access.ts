import { forbidden, redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function account(role?: Role, returnTo?: string) {
  const session = await auth();
  if (!session?.accountId) redirect(returnTo ? "/login?next=" + encodeURIComponent(returnTo) : "/login");
  const user = await db.user.findUnique({
    where: { id: session.accountId },
    select: { id: true, name: true, role: true, studentProfile: { select: { groupId: true, isMonitor: true } } },
  });
  if (!user) redirect("/login");
  if (role && role !== user.role) forbidden();
  return { id: user.id, name: user.name, role: user.role, groupId: user.studentProfile?.groupId, isMonitor: user.studentProfile?.isMonitor };
}
export function staffGroups(staffId: string) {
  return { staff: { some: { userId: staffId, user: { role: "STAFF" as const } } } };
}
export function staffStudents(staffId: string, groupId?: string | { in: string[] }) {
  return { role: "STUDENT" as const, studentProfile: { groupId, group: staffGroups(staffId) } };
}