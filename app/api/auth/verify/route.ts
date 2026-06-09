import { NextRequest, NextResponse } from "next/server";
import { consumeLoginToken, createSession } from "@/lib/auth";

// Validates a magic-link token and creates a session. Supports `?next=` to
// drop the user where they were headed (e.g. a specific project from a
// round-ready email), with an internal-path guard so the param can't be
// abused for an open redirect to a phishing site.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const rawNext = req.nextUrl.searchParams.get("next");
  const next = isSafeNext(rawNext) ? rawNext! : "/";

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing", req.url));
  }
  const userId = await consumeLoginToken(token);
  if (!userId) {
    // Keep the destination on failure too — once they sign in fresh via
    // /login, we can still send them where they meant to go.
    const errUrl = new URL("/login?error=expired", req.url);
    if (next !== "/") errUrl.searchParams.set("next", next);
    return NextResponse.redirect(errUrl);
  }
  await createSession(userId, req.headers.get("user-agent") ?? undefined);
  return NextResponse.redirect(new URL(next, req.url));
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
