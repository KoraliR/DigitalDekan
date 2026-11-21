import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Health-проверка для Docker Compose/Caddy и внешнего мониторинга.
 * Отвечает 200, только если приложение живо и PostgreSQL доступен.
 * Используется healthcheck'ом контейнера app в deploy/docker-compose.prod.yml.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", db: "up", time: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "down", time: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
