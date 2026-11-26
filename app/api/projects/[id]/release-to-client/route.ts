import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Studio-mode action. Releases every image's latest unreleased version to
// the client-facing view. V1 of a slot is always released on upload
// (clients see the first batch directly) — this flips V2 / V3 / ...
// retouched versions from "internal only" to "client visible".
//
// Only admin / internal_reviewer on the project can trigger it. Rejected
// on non-studio orgs (the button isn't shown there anyway).
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

  // Release every ImageVersion in this project that's still held back —
  // scoped via its parent image's gallery/project. Also resets the parent
  // image's status to "pending" so the client re-reviews the new version.
  const now = new Date();
  const releasedVersions = await prisma.imageVersion.updateMany({
    where: {
      releasedAt: null,
      image: {
        gallery: { projectId },
        killed: false,
      },
    },
    data: { releasedAt: now, releasedById: user.id },
  });

  // Reset status on every image whose currently-active version we just
  // released. Status flips back to "pending" so the client treats it as
  // a fresh thing to decide on.
  const touchedImages = await prisma.image.findMany({
    where: {
      gallery: { projectId },
      killed: false,
      currentVersion: { releasedAt: now },
    },
    select: { id: true },
  });
  if (touchedImages.length > 0) {
    await prisma.image.updateMany({
      where: { id: { in: touchedImages.map((i) => i.id) } },
      data: { status: "pending", updatedAt: now },
    });
  }

  await prisma.auditLog.create({
    data: {
      orgId: project.orgId,
      projectId,
      actorId: user.id,
      action: "project.released_to_client",
      targetType: "project",
      targetId: projectId,
      payload: JSON.stringify({ releasedVersions: releasedVersions.count }),
    },
  });

  return NextResponse.json({
    ok: true,
    releasedCount: releasedVersions.count,
  });
}
