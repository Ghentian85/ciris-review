import { NextRequest, NextResponse } from "next/server";

// Edge-light gate: only checks cookie presence; full validation happens server-side.
// Real RLS-style auth is enforced in page/route handlers via getCurrentUser().
const PUBLIC_PATHS = [
  // Sign-in surfaces and the routes they POST to.
  "/login",
  "/api/auth/login",
  "/api/auth/signin",
  "/api/auth/verify",
  "/api/auth/logout",
  // Password reset — anonymous flow until the user clicks the magic link
  // in their inbox (which mints a session on /api/auth/verify, after
  // which /account/reset becomes a regular logged-in page).
  "/api/auth/forgot",
  "/account/forgot",
  "/favicon.ico",
  // Static branding — needs to load even on the login page.
  "/logo.svg",
  // Public share links: unauthed visitors with a valid token can view.
  "/share",
  "/api/share-verify",
  // Invite acceptance: the URL is the secret. The page mints a session
  // server-side and redirects through /api/auth/verify, so it has to be
  // reachable without an existing cookie.
  "/invite",
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
