import { NextRequest, NextResponse } from "next/server";

// Edge-light gate: only checks cookie presence; full validation happens server-side.
// Real RLS-style auth is enforced in page/route handlers via getCurrentUser().
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/verify",
  "/api/auth/logout",
  "/favicon.ico",
  // Static branding — needs to load even on the login page.
  "/logo.svg",
  // Public share links: unauthed visitors with a valid token can view.
  "/share",
  "/api/share-verify",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/_next") || pathname.startsWith("/api/storage")) {
    return NextResponse.next();
  }
  const cookie = req.cookies.get("ciris_review_session")?.value;
  if (!cookie) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
