import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Studio-mode action. Sets Image.releasedAt = NOW on every image in the
// project that's still in the internal review tier. After this call,
// client-reviewer roles start seeing those images in their overview.
//
// Only admin / internal_reviewer on the project can trigger it. No-op on
// non-studio orgs (setting the timestamp would be harmless there, but the
// button is only rendered on studio orgs anyway).
export async function POST(
  _req: NextRequest,
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

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { organization: { select: { studioMode: true } } },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!project.organization.studioMode) {
    return NextResponse.json(
      { error: "This project does not use the internal review tier." },
      { status: 400 }
    );
  }

  // Bulk release every image still held back.
  const now = new Date();
  const result = await prisma.image.updateMany({
    where: {
      gallery: { projectId },
      killed: false,
      currentVersionId: { not: null },
      releasedAt: null,
    },
    data: { releasedAt: now },
  });

  await prisma.auditLog.create({
    data: {
      orgId: project.orgId,
      projectId,
      actorId: user.id,
      action: "project.released_to_client",
      targetType: "project",
      targetId: projectId,
      payload: JSON.stringify({ releasedCount: result.count }),
    },
  });

  return NextResponse.json({ ok: true, releasedCount: result.count });
}
