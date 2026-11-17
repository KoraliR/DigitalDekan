import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
export async function account() {
  const session = await auth();
  if (!session?.accountId) redirect("/login");
  const user = await db.user.findUnique({
    where: { id: session.accountId },
    select: { id: true, name: true, role: true },
  });
  if (!user) redirect("/login");
  return user;
}