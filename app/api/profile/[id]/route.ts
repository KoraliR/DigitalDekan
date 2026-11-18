import { NextResponse } from "next/server";
import { studentSession } from "@/lib/api";
import { profileFor } from "@/lib/profile";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await studentSession();
  if ("response" in session) return session.response;

  const { id } = await params;
  if (id !== session.accountId) {
    return NextResponse.json({ error: "Чужой профиль недоступен." }, { status: 403 });
  }

  const profile = await profileFor(session.accountId);
  if (!profile) return NextResponse.json({ error: "Профиль не найден." }, { status: 404 });
  return NextResponse.json(profile, { headers: { "Cache-Control": "no-store" } });
}
