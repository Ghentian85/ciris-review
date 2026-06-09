import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCurrentUser,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  password: z.string().min(1),
  // Required when the user already has a password (change). Optional on
  // first-time set (the magic-link sign-in is itself the auth proof).
  currentPassword: z.string().optional(),
});

// Set or change the current user's password. Requires an active session.
// If a password is already set, current-password proof is required to
// rotate it; first-time set has no current to prove.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const check = validatePasswordStrength(parsed.data.password);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  if (user.passwordHash) {
    if (!parsed.data.currentPassword) {
      return NextResponse.json(
        { error: "Current password required to change password" },
        { status: 400 }
      );
    }
    const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }
  }

  const hash = await hashPassword(parsed.data.password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash },
  });

  return NextResponse.json({ ok: true });
}
