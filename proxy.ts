import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((request) => {
  if (!request.auth?.accountId) return NextResponse.redirect(new URL(request.nextUrl.pathname.startsWith("/staff") ? "/staff-login" : "/login", request.url));
  return NextResponse.next();
});
export const config = { matcher: ["/cabinet/:path*", "/staff/:path*"] };