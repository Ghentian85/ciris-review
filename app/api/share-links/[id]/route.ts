import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAdminProject } from "@/lib/auth";

// DELETE: revoke a share link. Project admin / internal_reviewer.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const link = await prisma.shareLink.findUnique({
    where: { id },
    include: { project: { select: { id: true, orgId: true } } },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canAdminProject(user.id, link.projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.shareLink.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      orgId: link.project.orgId,
      projectId: link.projectId,
      actorId: user.id,
      action: "share_link.revoked",
      targetType: "share_link",
      targetId: id,
    },
  });

  return NextResponse.json({ ok: true });
}
