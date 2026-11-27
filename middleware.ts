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
  // Per-tenant logo + brand assets served from /public/orgs/. The sign-
  // in page references these before any cookie exists, so they MUST be
  // reachable anonymously — otherwise the middleware 307's them to
  // /login and the browser renders a broken-image icon in their place.
  "/orgs",
  // User guide — public so prospects, new hires, and confused clients
  // can read it without needing an account first.
  "/help",
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
    // Preserve the original target as ?next= so the user lands where they
    // tried to go after signing in. Skip noise like raw "/" and never
    // forward absolute / protocol-relative URLs (defense-in-depth — verify
    // already guards open redirects, but keeping it tight here too).
    const target = req.nextUrl.pathname + req.nextUrl.search;
    if (target !== "/" && target.startsWith("/") && !target.startsWith("//")) {
      url.searchParams.set("next", target);
    }
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
