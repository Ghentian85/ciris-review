import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLoginToken } from "@/lib/auth";
import { sendEmail, magicLinkEmail } from "@/lib/email";
import { getRequestBaseUrl } from "@/lib/request-url";
import { getCurrentOrg } from "@/lib/org";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
  // Optional path to send the user to after the magic-link verifies.
  // Same internal-only guard as on /api/auth/verify — embed it raw and
  // let verify validate, that way one open-redirect check stays canonical.
  next: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { user, raw } = await createLoginToken(parsed.data.email, parsed.data.name);

  // Mint the magic link against THIS tenant's hostname — not a global
  // env.APP_URL — so the verify callback lands back on studio360.ciris.
  // studio (or any future whitelabel host) and the session cookie is
  // set on the right origin.
  const base = getRequestBaseUrl(req);
  const verifyUrl = new URL("/api/auth/verify", base);
  verifyUrl.searchParams.set("token", raw);
  if (parsed.data.next) verifyUrl.searchParams.set("next", parsed.data.next);
  const url = verifyUrl.toString();

  const org = await getCurrentOrg();
  const tpl = magicLinkEmail(url, {
    name: org?.displayName
      ? `${org.displayName} Review`
      : `${org?.name ?? "CIRIS"} Review`,
    accent: org?.brandAccent,
    footerUrl: base,
    footerHost: base.replace(/^https?:\/\//, ""),
    poweredByCiris: org?.poweredByCiris ?? false,
  });
  const result = await sendEmail({ to: user.email, ...tpl });

  return NextResponse.json({
    ok: true,
    delivered: result.delivered,
    // In dev (no RESEND_API_KEY) expose the link so you can click through immediately.
    devLink: result.channel === "console" ? url : undefined,
  });
}
