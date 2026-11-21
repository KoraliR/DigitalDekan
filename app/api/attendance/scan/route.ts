import { NextResponse } from "next/server";
import { studentSession } from "@/lib/api";
import { markAttendanceByToken } from "@/lib/attendance-qr";

export const runtime = "nodejs";

/**
 * POST /api/attendance/scan — отметка посещаемости по токену QR-кода.
 * Тело: { token: string } — сам 48-символьный токен или ссылка из QR.
 * Ответ: { ok: true, lesson: { title, startsAt, groupName } } либо
 *        { ok: false, code, error } с подходящим HTTP-статусом.
 */
export async function POST(request: Request) {
  const session = await studentSession();
  if ("response" in session) return session.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid", error: "Некорректный запрос." }, { status: 400 });
  }
  const token = body && typeof body === "object" && "token" in body ? (body as { token?: unknown }).token : undefined;
  if (typeof token !== "string") {
    return NextResponse.json({ ok: false, code: "invalid", error: "Передайте код отметки." }, { status: 400 });
  }

  const result = await markAttendanceByToken(session.accountId, token);
  if (!result.ok) {
    return NextResponse.json({ ok: false, code: result.code, error: result.message }, { status: result.status });
  }
  return NextResponse.json({ ok: true, lesson: result.lesson });
}
