/**
 * Разбор содержимого QR-кода отметки посещаемости.
 * Код сотрудника — это ссылка /attendance/check?token=<48 hex>, но вставить
 * можно и относительный путь, и просто сам токен. Модуль изоморфный: его
 * используют и клиентский сканер, и API-маршрут на сервере.
 */
export const ATTENDANCE_TOKEN_RE = /^[a-f0-9]{48}$/;

function lastPathSegment(pathname: string) {
  return pathname.split("/").filter(Boolean).pop() ?? "";
}

/** Возвращает нормализованный 48-символьный токен или null, если это не код отметки. */
export function extractAttendanceToken(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw || raw.length > 4096) return null;

  let candidate = raw;
  const tokenParam = /[?&#]token=([^&#\s]+)/i.exec(raw);
  if (tokenParam) {
    candidate = tokenParam[1];
  } else if (/^[a-z][a-z\d+.-]*:\/\//i.test(raw) || raw.startsWith("/")) {
    try {
      const url = new URL(raw, "http://localhost");
      candidate = url.searchParams.get("token") ?? lastPathSegment(url.pathname);
    } catch {
      candidate = lastPathSegment(raw.split(/[?#]/)[0]);
    }
  } else if (raw.includes("/")) {
    candidate = lastPathSegment(raw.split(/[?#]/)[0]);
  }

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // оставляем как есть — валидация ниже отсеет мусор
  }
  candidate = candidate.trim().toLowerCase();
  return ATTENDANCE_TOKEN_RE.test(candidate) ? candidate : null;
}
