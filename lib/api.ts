import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function anySession() {
  const session = await auth();
  if (!session?.accountId) {
    return { response: NextResponse.json({ error: "Требуется вход в личный кабинет." }, { status: 401 }) } as const;
  }
  return { accountId: session.accountId } as const;
}

export async function studentSession() {
  const session = await auth();
  if (!session?.accountId) {
    return { response: NextResponse.json({ error: "Требуется вход в личный кабинет." }, { status: 401 }) } as const;
  }
  if (session.role !== "STUDENT") {
    return { response: NextResponse.json({ error: "Раздел доступен только студентам." }, { status: 403 }) } as const;
  }
  return { accountId: session.accountId } as const;
}
