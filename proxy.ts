import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Проверка сессии без перевыпуска cookie.
 * Раньше здесь использовался wrapper `auth()` из NextAuth: он на каждом запросе
 * заново подписывал JWT-сессию и перевыставлял cookie с session.maxAge (30 дней),
 * из-за чего «Запомнить меня» ни на что не влияло. Здесь мы только читаем токен.
 */
export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: request.nextUrl.protocol === "https:",
  });
  if (!token?.sub) {
    const login = new URL(request.nextUrl.pathname.startsWith("/staff") ? "/staff-login" : "/login", request.url);
    if (request.nextUrl.pathname === "/staff/campus/pass") {
      login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/cabinet/:path*", "/staff/:path*"] };
