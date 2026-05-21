import { NextRequest, NextResponse } from "next/server";
import { consumeLoginToken, createSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing", req.url));
  }
  const userId = await consumeLoginToken(token);
  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=expired", req.url));
  }
  await createSession(userId, req.headers.get("user-agent") ?? undefined);
  return NextResponse.redirect(new URL("/", req.url));
}
