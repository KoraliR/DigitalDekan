import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((request) => {
  const role = request.auth?.role;
  if (role !== "STUDENT" && role !== "STAFF") return NextResponse.redirect(new URL("/login", request.url));
  if (request.nextUrl.pathname.startsWith("/staff") && role !== "STAFF") {
    return NextResponse.redirect(new URL("/cabinet/services", request.url));
  }
  return NextResponse.next();
});

export const config = { matcher: ["/cabinet/:path*", "/staff/:path*"] };