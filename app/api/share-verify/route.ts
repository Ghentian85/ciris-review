import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

const schema = z.object({
  token: z.string().min(8),
  password: z.string().min(1),
});

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}
function hashPassword(p: string) {
  return createHash("sha256").update(`${env.AUTH_SECRET}:share:${p}`).digest("hex");
}

// Public endpoint: verifies the password for a share link and sets a scoped
// cookie. No general auth required — this is the gate for unauthed visitors.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const link = await prisma.shareLink.findUnique({
    where: { tokenHash: sha256(parsed.data.token) },
    select: { id: true, passwordHash: true, expiresAt: true },
  });
  if (!link) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (link.expiresAt && link.expiresAt < new Date()) {
    return NextResponse.json({ error: "Link expired" }, { status: 410 });
  }
  if (!link.passwordHash) {
    // No password required — but the form was submitted anyway. Allow.
    return NextResponse.json({ ok: true });
  }
  if (hashPassword(parsed.data.password) !== link.passwordHash) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const jar = await cookies();
  jar.set(`share_${link.id}`, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Cookie lives until the link expires, or 7 days if no expiry.
    expires: link.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return NextResponse.json({ ok: true });
}
