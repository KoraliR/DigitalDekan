import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { db } from "@/lib/db";
import { anySession } from "@/lib/api";
import { passwordError } from "@/lib/password.mjs";

const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(accountId: string) {
  const now = Date.now();
  const entry = attempts.get(accountId);
  if (!entry || entry.resetAt < now) {
    attempts.set(accountId, { count: 1, resetAt: now + 10 * 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 10;
}

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function POST(request: Request) {
  const session = await anySession();
  if ("response" in session) return session.response;
  if (rateLimited(session.accountId)) {
    return NextResponse.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429 });
  }

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
  attempts.delete(session.accountId);

  return NextResponse.json({ ok: true });
}
