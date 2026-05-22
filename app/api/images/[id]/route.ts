import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// DELETE /api/images/[id] — admin/internal only, soft-deletes via killed flag
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: imageId } = await params;
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    include: { gallery: { include: { project: true } } },
  });
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const me = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: image.gallery.projectId, userId: user.id } },
  });
  if (!me || !["admin", "internal"].includes(me.role)) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  await prisma.image.update({
    where: { id: imageId },
    data: { killed: true },
  });

  await prisma.auditLog.create({
    data: {
      orgId: image.gallery.project.orgId,
      projectId: image.gallery.projectId,
      actorId: user.id,
      action: "image.deleted",
      targetType: "image",
      targetId: imageId,
      payload: JSON.stringify({ slotName: image.slotName }),
    },
  });

  return NextResponse.json({ ok: true });
}
