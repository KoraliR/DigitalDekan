import { NextResponse } from "next/server";
import { studentSession } from "@/lib/api";
import { profileFor } from "@/lib/profile";

export async function GET() {
  const session = await studentSession();
  if ("response" in session) return session.response;
  const profile = await profileFor(session.accountId);
  if (!profile) return NextResponse.json({ error: "Профиль не найден." }, { status: 404 });
  return NextResponse.json(profile, { headers: { "Cache-Control": "no-store" } });
}
