import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((request) => {
  if (!request.auth?.accountId) {
    const login = new URL(request.nextUrl.pathname.startsWith("/staff") ? "/staff-login" : "/login", request.url);
    if (request.nextUrl.pathname === "/staff/campus/pass") {
      login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
});
export const config = { matcher: ["/cabinet/:path*", "/staff/:path*"] };
