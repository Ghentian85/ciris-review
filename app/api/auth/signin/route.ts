import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticatePassword, createSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Email + password sign-in. On success: writes the session cookie and
// returns the JSON the client uses to navigate. On failure: 401 with a
// generic message — never reveal whether email or password was wrong.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const user = await authenticatePassword(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await createSession(user.id, req.headers.get("user-agent") ?? undefined);
  return NextResponse.json({ ok: true });
}
