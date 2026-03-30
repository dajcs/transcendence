import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("access_token");
  const { pathname } = request.nextUrl;

  // Redirect unauthenticated users away from protected routes
  if (!token && (pathname.startsWith("/dashboard") || pathname.startsWith("/markets") || pathname.startsWith("/friends") || pathname.startsWith("/chat") || pathname.startsWith("/profile"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from auth pages
  if (token && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/markets/:path*", "/friends/:path*", "/chat/:path*", "/profile/:path*", "/login", "/register"],
};
