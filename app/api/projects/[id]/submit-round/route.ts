import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, mintSignInUrl } from "@/lib/auth";
import {
  sendEmail,
  roundDigestEmail,
  roundSubmittedClientEmail,
  type DigestImageItem,
} from "@/lib/email";
import { env } from "@/lib/env";

// Submits the project's currently-open (or draft) round on behalf of the user.
//   - Locks the round (status → closed, closedAt set)
//   - Sends ONE digest email to all post-prod + admin members
//   - Sends ONE confirmation email to all client_reviewer members
//   - Auto-creates the next round as draft (so V2 uploads have a home)
//
// Refuses if there are still images with status "pending" — the UI prevents
// this case but we double-check server side.
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
  if (!me || me.role === "post_production") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      members: { include: { user: true } },
      rounds: { orderBy: { number: "desc" } },
      organization: true,
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const round =
    project.rounds.find((r) => r.status === "open") ??
    project.rounds.find((r) => r.status === "draft") ??
    project.rounds[0];
  if (!round) return NextResponse.json({ error: "No round to submit" }, { status: 400 });
  if (round.status === "closed") {
    return NextResponse.json({ error: "Round already submitted" }, { status: 400 });
  }

  // Refuse if any images are still pending.
  const pendingCount = await prisma.image.count({
    where: { gallery: { projectId }, status: "pending", killed: false },
  });
  if (pendingCount > 0) {
    return NextResponse.json(
      { error: `${pendingCount} image(s) still pending review` },
      { status: 400 }
    );
  }

  // Tally counts for the digest.
  const grouped = await prisma.image.groupBy({
    by: ["status"],
    where: { gallery: { projectId }, killed: false },
    _count: { _all: true },
  });
  const counts = {
    approved: 0,
    approvedWithNotes: 0,
    revisionRequested: 0,
  };
  for (const g of grouped) {
    if (g.status === "approved" || g.status === "final") counts.approved += g._count._all;
    if (g.status === "approved_with_notes") counts.approvedWithNotes += g._count._all;
    if (g.status === "revision_requested") counts.revisionRequested += g._count._all;
  }

  // Atomic: close round, audit-log, ensure next round exists.
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.reviewRound.update({
      where: { id: round.id },
      data: {
        status: "closed",
        closedAt: now,
        openedAt: round.openedAt ?? now,
      },
    });
    const nextNumber = round.number + 1;
    const existingNext = await tx.reviewRound.findUnique({
      where: { projectId_number: { projectId, number: nextNumber } },
    });
    if (!existingNext) {
      await tx.reviewRound.create({
        data: { projectId, number: nextNumber, status: "draft" },
      });
    }
    await tx.auditLog.create({
      data: {
        orgId: project.orgId,
        projectId,
        actorId: user.id,
        action: "round.submitted",
        targetType: "round",
        targetId: round.id,
        payload: JSON.stringify({ number: round.number, counts }),
      },
    });
  });

  // Fetch the per-image breakdown so the digest can include real comment
  // snippets — post-prod can scan the whole batch without opening the app.
  // We pull every image that either needs revision OR has at least one
  // client comment; the "Approved · notes" status no longer exists in the UI,
  // but approved images can still carry client comments that post-prod needs
  // to see (e.g. "looks great, just nudge the shadow on the left").
  const itemImages = await prisma.image.findMany({
    where: {
      gallery: { projectId },
      killed: false,
      OR: [
        { status: "revision_requested" },
        { status: "approved_with_notes" }, // legacy data only
        {
          status: { in: ["approved", "final"] },
          comments: { some: { visibility: "client" } },
        },
      ],
    },
    include: {
      gallery: { select: { name: true } },
      comments: {
        where: { visibility: "client" },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
    orderBy: [{ gallery: { position: "asc" } }, { position: "asc" }],
  });

  const toItem = (img: (typeof itemImages)[number]): DigestImageItem => ({
    slot: img.slotName,
    displayName: img.displayName,
    galleryName: img.gallery.name,
    comments: img.comments.map((c) => ({
      body: c.body,
      authorName: c.author.name ?? c.author.email,
    })),
  });
  const revisionItems = itemImages
    .filter((i) => i.status === "revision_requested")
    .map(toItem);
  // Anything approved that has at least one client comment is treated as
  // "approved with comments" in the digest.
  const notesItems = itemImages
    .filter(
      (i) =>
        (i.status === "approved" ||
          i.status === "final" ||
          i.status === "approved_with_notes") &&
        i.comments.length > 0
    )
    .map(toItem);

  // Fire-and-forget emails — never block the response on delivery.
  // Per-recipient one-click sign-in URLs so post-prod can jump straight
  // into the project from the digest, even weeks later.
  const projectPath = `/projects/${project.slug}`;
  const postProdRecipients = project.members
    .filter((m) => m.role === "post_production" || m.role === "admin")
    .map((m) => m.user.email);
  const clientRecipients = project.members
    .filter((m) => m.role === "client_reviewer")
    .map((m) => m.user.email);

  const confirm = roundSubmittedClientEmail({
    projectName: project.name,
    roundNumber: round.number,
    counts,
  });

  await Promise.all([
    ...postProdRecipients.map(async (to) => {
      const projectUrl = await mintSignInUrl({
        baseUrl: env.APP_URL,
        email: to,
        nextPath: projectPath,
      });
      const digest = roundDigestEmail({
        projectName: project.name,
        clientName: project.client?.name ?? null,
        roundNumber: round.number,
        counts,
        projectUrl,
        revisionItems,
        notesItems,
      });
      return sendEmail({ to, ...digest });
    }),
    ...clientRecipients.map((to) => sendEmail({ to, ...confirm })),
  ]);

  return NextResponse.json({
    ok: true,
    roundNumber: round.number,
    counts,
    digestSentTo: postProdRecipients.length,
    confirmSentTo: clientRecipients.length,
  });
}
