import { AttendanceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { extractAttendanceToken } from "@/lib/qr";

export type MarkAttendanceResult =
  | { ok: true; lesson: { title: string; startsAt: string; groupName: string } }
  | { ok: false; status: 400 | 403 | 404 | 410; code: "invalid" | "expired" | "foreign" | "missing"; message: string };

/**
 * Общая логика отметки посещаемости по токену QR-кода.
 * Используется и старым маршрутом /attendance/check (server action), и
 * POST /api/attendance/scan. Семантика GroupAttendance как была: upsert с
 * пустым update — уже выставленный преподавателем статус не перезаписывается.
 */
export async function markAttendanceByToken(userId: string, rawToken: unknown): Promise<MarkAttendanceResult> {
  const token = extractAttendanceToken(rawToken);
  if (!token) {
    return {
      ok: false, status: 400, code: "invalid",
      message: "Это не QR для отметки посещаемости. Вставьте ссылку из QR-кода или 48-символьный код.",
    };
  }

  const qr = await db.attendanceQr.findUnique({
    where: { token },
    select: {
      lessonId: true,
      expiresAt: true,
      lesson: { select: { title: true, startsAt: true, groupId: true, group: { select: { name: true } } } },
    },
  });
  if (!qr) {
    return {
      ok: false, status: 404, code: "missing",
      message: "Код не подходит к вашей группе. Попросите сотрудника показать актуальный QR-код.",
    };
  }

  const membership = await db.studentProfile.findFirst({
    where: { userId, groupId: qr.lesson.groupId },
    select: { userId: true },
  });
  if (!membership) {
    return { ok: false, status: 403, code: "foreign", message: "Код не подходит к вашей группе." };
  }
  if (qr.expiresAt.getTime() <= Date.now()) {
    return { ok: false, status: 410, code: "expired", message: "Код истёк. Попросите сотрудника показать новый QR-код." };
  }

  await db.groupAttendance.upsert({
    where: { lessonId_userId: { lessonId: qr.lessonId, userId } },
    create: { lessonId: qr.lessonId, userId, status: AttendanceStatus.PRESENT },
    update: {},
  });

  return {
    ok: true,
    lesson: { title: qr.lesson.title, startsAt: qr.lesson.startsAt.toISOString(), groupName: qr.lesson.group.name },
  };
}
