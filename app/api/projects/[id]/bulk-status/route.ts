import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  imageIds: z.array(z.string().min(1)).min(1).max(500),
  status: z.enum(["approved", "revision_requested", "pending"]),
});

// Bulk status update for many images at once. Post-prod can't change status;
// admin/internal/client_reviewer can. We validate that every image belongs to
// THIS project so no cross-project leakage is possible via crafted IDs.
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
  if (!me || me.role === "post_production") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { imageIds, status } = parsed.data;

  // Verify every image is in this project. Skip those that aren't.
  const valid = await prisma.image.findMany({
    where: {
      id: { in: imageIds },
      gallery: { projectId },
      killed: false,
    },
    select: { id: true, currentVersionId: true },
  });
  const validIds = valid.map((i) => i.id);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { orgId: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Use the active round, or fall back to the most-recent for the project.
  const round =
    (await prisma.reviewRound.findFirst({
      where: { projectId, status: "open" },
    })) ??
    (await prisma.reviewRound.findFirst({
      where: { projectId },
      orderBy: { number: "desc" },
    }));

  await prisma.$transaction(async (tx) => {
    await tx.image.updateMany({
      where: { id: { in: validIds } },
      data: { status },
    });

    // Per-round state per image for audit. Loop because upsert can't be batched.
    if (round) {
      for (const img of valid) {
        if (!img.currentVersionId) continue;
        await tx.imageRoundState.upsert({
          where: { imageId_roundId: { imageId: img.id, roundId: round.id } },
          create: {
            imageId: img.id,
            roundId: round.id,
            versionId: img.currentVersionId,
            status,
            decidedById: user.id,
            decidedAt: new Date(),
          },
          update: {
            status,
            versionId: img.currentVersionId,
            decidedById: user.id,
            decidedAt: new Date(),
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        orgId: project.orgId,
        projectId,
        actorId: user.id,
        action: "image.bulk_status_changed",
        targetType: "project",
        targetId: projectId,
        payload: JSON.stringify({ status, count: validIds.length }),
      },
    });
  });

  return NextResponse.json({ ok: true, updated: validIds.length });
}
