import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Status state machine:
//   pending → approved | approved_with_notes | revision_requested
//   approved | approved_with_notes → final (admin only) | revision_requested
//   revision_requested → (post-prod uploads V2, status returns to pending on new version)
//   final → locked unless admin unlocks
//
// Killed is a separate flag toggled via the killed boolean.
const NEXT_STATUSES = [
  "approved",
  "approved_with_notes",
  "revision_requested",
  "final",
  "pending", // allow reopening
] as const;

const schema = z.object({
  status: z.enum(NEXT_STATUSES),
  applyToSubject: z.boolean().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: imageId } = await params;
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    include: {
      gallery: { include: { project: true } },
      currentVersion: true,
    },
  });
  if (!image || !image.currentVersion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const me = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: image.gallery.projectId, userId: user.id } },
  });
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { status, applyToSubject } = parsed.data;

  // Role restrictions
  if (status === "final" && me.role !== "admin") {
    return NextResponse.json({ error: "Only admin can mark final" }, { status: 403 });
  }
  if (me.role === "post_production") {
    return NextResponse.json({ error: "Post-prod cannot set review status" }, { status: 403 });
  }

  // Which images to update
  let targets: { id: string; currentVersionId: string | null }[] = [];
  if (applyToSubject && image.subjectKey) {
    targets = await prisma.image.findMany({
      where: { galleryId: image.galleryId, subjectKey: image.subjectKey },
      select: { id: true, currentVersionId: true },
    });
  } else {
    targets = [{ id: image.id, currentVersionId: image.currentVersionId }];
  }

  // Use the active round, or fall back to the most-recent for the project.
  const round =
    (await prisma.reviewRound.findFirst({
      where: { projectId: image.gallery.projectId, status: "open" },
    })) ??
    (await prisma.reviewRound.findFirst({
      where: { projectId: image.gallery.projectId },
      orderBy: { number: "desc" },
    }));

  await prisma.$transaction(async (tx) => {
    for (const t of targets) {
      if (!t.currentVersionId) continue;
      await tx.image.update({ where: { id: t.id }, data: { status } });
      if (round) {
        await tx.imageRoundState.upsert({
          where: { imageId_roundId: { imageId: t.id, roundId: round.id } },
          create: {
            imageId: t.id,
            roundId: round.id,
            versionId: t.currentVersionId,
            status,
            decidedById: user.id,
            decidedAt: new Date(),
          },
          update: {
            status,
            versionId: t.currentVersionId,
            decidedById: user.id,
            decidedAt: new Date(),
          },
        });
      }
      await tx.auditLog.create({
        data: {
          orgId: image.gallery.project.orgId,
          projectId: image.gallery.projectId,
          actorId: user.id,
          action: "image.status_changed",
          targetType: "image",
          targetId: t.id,
          payload: JSON.stringify({ status, viaSubjectSync: applyToSubject }),
        },
      });
    }
  });

  return NextResponse.json({ ok: true, updated: targets.length });
}
