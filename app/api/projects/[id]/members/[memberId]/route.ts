import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Revoke a member's access to a project. Admin / internal_reviewer only.
// Deletes the projectMember row — user.id is preserved (they may be on
// other projects), and any active sessions stay valid. Their next request
// against this project will 404 / 403 because membership lookups fail.
export async function DELETE(
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
    include: { user: { select: { email: true } } },
  });
  if (!target || target.projectId !== projectId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Can't revoke yourself — admins should hand off ownership first.
  if (target.userId === user.id) {
    return NextResponse.json({ error: "You can't revoke your own access" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });

  await prisma.projectMember.delete({ where: { id: memberId } });

  if (project) {
    await prisma.auditLog.create({
      data: {
        orgId: project.orgId,
        projectId,
        actorId: user.id,
        action: "member.revoked",
        targetType: "user",
        targetId: target.userId,
        payload: JSON.stringify({ email: target.user.email, role: target.role }),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
