import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mintSignInUrl } from "@/lib/auth";
import { sendEmail, passwordResetEmail } from "@/lib/email";
import { env } from "@/lib/env";

const schema = z.object({
  email: z.string().email(),
});

// Initiate a password reset. Sends a one-click magic-link to /account/reset
// where the recipient can pick a new password. Always responds 200 so an
// attacker can't probe which addresses have accounts.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Silently succeed — same response shape as the happy path.
    return NextResponse.json({ ok: true });
  }

  const url = await mintSignInUrl({
    baseUrl: env.APP_URL,
    email,
    nextPath: "/account/reset",
  });
  // The mintSignInUrl helper uses the 14-day TTL by default — for resets
  // we surface it as hours in the email copy. 14*24 = 336h.
  const result = await sendEmail({
    to: email,
    ...passwordResetEmail({ url, expiresHours: 336 }),
  });

  return NextResponse.json({
    ok: true,
    devLink: result.channel === "console" ? url : undefined,
  });
}
