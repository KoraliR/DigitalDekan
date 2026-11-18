import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { db } from "@/lib/db";
import { studentSession } from "@/lib/api";
import { passwordError } from "@/lib/password.mjs";

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function POST(request: Request) {
  const session = await studentSession();
  if ("response" in session) return session.response;

  let payload: unknown;
  try { payload = await request.json(); } catch { return bad("Некорректный запрос."); }
  const body = (payload ?? {}) as Record<string, unknown>;
  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body.newPassword === "string" ? body.newPassword : "";
  const confirmation = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!current) return bad("Введите текущий пароль.");
  const invalid = passwordError(next);
  if (invalid) return bad(invalid);
  if (next !== confirmation) return bad("Новый пароль и подтверждение не совпадают.");
  if (next === current) return bad("Новый пароль должен отличаться от текущего.");

  const user = await db.user.findUnique({ where: { id: session.accountId }, select: { passwordHash: true } });
  if (!user) return NextResponse.json({ error: "Профиль не найден." }, { status: 404 });
  if (!(await compare(current, user.passwordHash))) return bad("Текущий пароль неверен.");

  await db.$transaction([
    db.user.update({ where: { id: session.accountId }, data: { passwordHash: await hash(next, 12) } }),
    db.loginChallenge.deleteMany({ where: { userId: session.accountId } }),
  ]);

  return NextResponse.json({ ok: true });
}
