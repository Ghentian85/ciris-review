import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, mintSignInUrl } from "@/lib/auth";
import { sendEmail, passwordResetEmail } from "@/lib/email";
import { env } from "@/lib/env";

// Admin-initiated password reset for a project member. Sends the same
// magic-link reset email the user can request themselves via /api/auth/forgot.
// Useful when a client emails Sam saying "I can't log in" — Sam clicks
// "Send reset link" in the members panel and they get an email immediately.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, memberId } = await params;

  const me = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!me || (me.role !== "admin" && me.role !== "internal_reviewer")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await prisma.projectMember.findUnique({
    where: { id: memberId },
    include: { user: true },
  });
  if (!target || target.projectId !== projectId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = await mintSignInUrl({
    baseUrl: env.APP_URL,
    email: target.user.email,
    nextPath: "/account/reset",
  });
  const result = await sendEmail({
    to: target.user.email,
    ...passwordResetEmail({ url, expiresHours: 336 }),
  });

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project) {
    await prisma.auditLog.create({
      data: {
        orgId: project.orgId,
        projectId,
        actorId: user.id,
        action: "member.reset_sent",
        targetType: "user",
        targetId: target.userId,
        payload: JSON.stringify({ email: target.user.email }),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    devLink: result.channel === "console" ? url : undefined,
  });
}
