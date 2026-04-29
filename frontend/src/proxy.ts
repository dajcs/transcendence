import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("access_token");
  const { pathname } = request.nextUrl;
  const isProtectedRoute =
    pathname.startsWith("/markets") ||
    pathname.startsWith("/friends") ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings");

  // Redirect unauthenticated users away from protected routes
  if (!token && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from auth pages and root
  if (token && (pathname === "/" || pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/markets", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/markets/:path*", "/friends/:path*", "/chat/:path*", "/profile/:path*", "/settings/:path*", "/login", "/register"],
};
