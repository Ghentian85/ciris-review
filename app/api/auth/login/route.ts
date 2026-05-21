import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLoginToken } from "@/lib/auth";
import { sendEmail, magicLinkEmail } from "@/lib/email";
import { env } from "@/lib/env";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { user, raw } = await createLoginToken(parsed.data.email, parsed.data.name);
  const url = `${env.APP_URL}/api/auth/verify?token=${encodeURIComponent(raw)}`;
  const tpl = magicLinkEmail(url);
  const result = await sendEmail({ to: user.email, ...tpl });

  return NextResponse.json({
    ok: true,
    delivered: result.delivered,
    // In dev (no RESEND_API_KEY) expose the link so you can click through immediately.
    devLink: result.channel === "console" ? url : undefined,
  });
}
