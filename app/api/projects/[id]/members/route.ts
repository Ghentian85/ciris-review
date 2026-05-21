import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "internal_reviewer", "client_reviewer", "post_production"]),
});

const INVITE_TTL_DAYS = 14;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const me = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!me || (me.role !== "admin" && me.role !== "internal_reviewer")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const raw = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60_000);

  await prisma.invite.create({
    data: {
      projectId,
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      tokenHash,
      expiresAt,
      createdById: user.id,
    },
  });

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  const url = `${env.APP_URL}/invite/${raw}`;
  const result = await sendEmail({
    to: parsed.data.email,
    subject: `You've been invited to review ${project?.name ?? "a project"}`,
    text: `Open this link to accept the invitation:\n\n${url}\n\nLink expires in ${INVITE_TTL_DAYS} days.`,
  });

  return NextResponse.json({
    ok: true,
    devLink: result.channel === "console" ? url : undefined,
  });
}
