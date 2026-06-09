import { NextRequest, NextResponse } from "next/server";
import { consumeLoginToken, mintSession } from "@/lib/auth";

// Validates a magic-link token, creates a session, and redirects. Supports
// `?next=` to drop the user where they were headed (e.g. a specific project
// from a round-ready email or an invite acceptance), with an internal-path
// guard so the param can't be abused for an open redirect.
//
// IMPORTANT: writes the session cookie via `response.cookies.set()`, not
// `cookies().set()` from next/headers — the latter doesn't follow onto a
// freshly-constructed NextResponse.redirect() in Next.js 15 Route Handlers.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const rawNext = req.nextUrl.searchParams.get("next");
  const next = isSafeNext(rawNext) ? rawNext! : "/";

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing", req.url));
  }
  const userId = await consumeLoginToken(token);
  if (!userId) {
    const errUrl = new URL("/login?error=expired", req.url);
    if (next !== "/") errUrl.searchParams.set("next", next);
    return NextResponse.redirect(errUrl);
  }

  const session = await mintSession(userId, req.headers.get("user-agent") ?? undefined);
  const response = NextResponse.redirect(new URL(next, req.url));
  response.cookies.set(session.name, session.value, session.options);
  return response;
}

// Only allow same-origin paths. Must start with "/" and NOT be a protocol-
// relative URL ("//evil.com") or contain a backslash (Edge URL-parsing
// inconsistency). Defense in depth — also bounded length.
function isSafeNext(next: string | null): next is string {
  if (!next) return false;
  if (next.length > 512) return false;
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  if (next.includes("\\")) return false;
  return true;
}
