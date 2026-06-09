import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, mintSignInUrl } from "@/lib/auth";
import { sendEmail, roundReadyClientEmail } from "@/lib/email";
import { env } from "@/lib/env";

// Post-prod / admin clicks "Notify client — Round N ready". Effect:
//   - Find the latest draft round; transition draft → open (set openedAt)
//   - Send ONE email to client_reviewer members with a link
// Only allowed for admin / internal_reviewer / post_production.
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
  if (!me || me.role === "client_reviewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: { include: { user: true } },
      rounds: { orderBy: { number: "desc" } },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Target the highest-number draft round; otherwise the current open one.
  const round =
    project.rounds.find((r) => r.status === "draft") ??
    project.rounds.find((r) => r.status === "open");
  if (!round) {
    return NextResponse.json({ error: "No round to open" }, { status: 400 });
  }

  // Debounce: if this same round was opened recently, don't fire another
  // client notification. Catches double-clicks and over-eager post-prod who
  // hit "notify" twice. 5 minute window is plenty for any legit second send.
  const DEBOUNCE_MINUTES = 5;
  if (round.openedAt) {
    const minutesSince = (Date.now() - round.openedAt.getTime()) / 60_000;
    if (minutesSince < DEBOUNCE_MINUTES) {
      return NextResponse.json(
        {
          ok: true,
          debounced: true,
          minutesSinceLastNotify: Math.round(minutesSince * 10) / 10,
          message: `Round ${round.number} was just opened — no second email sent.`,
        },
        { status: 200 }
      );
    }
  }

  // Round 1 = initial release: count every reviewable image in the project.
  // Round 2+ = revision round: count only images that got a new version since
  // the last close (those are what the client needs to re-review).
  const imageCount =
    round.number === 1
      ? await prisma.image.count({
          where: { gallery: { projectId }, killed: false },
        })
      : await prisma.image.count({
          where: {
            gallery: { projectId },
            currentVersion: { versionNumber: { gt: 1 } },
            killed: false,
            status: "pending",
          },
        });

  const now = new Date();
  if (round.status === "draft") {
    await prisma.reviewRound.update({
      where: { id: round.id },
      data: { status: "open", openedAt: now },
    });
  }

  await prisma.auditLog.create({
    data: {
      orgId: project.orgId,
      projectId,
      actorId: user.id,
      action: "round.opened",
      targetType: "round",
      targetId: round.id,
      payload: JSON.stringify({ number: round.number, imageCount }),
    },
  });

  // Per-recipient one-click sign-in URLs. Each email gets its own short-
  // lived token that signs the client in AND lands them on the project —
  // no /login + magic-link round-trip when the session has expired.
  const projectPath = `/projects/${project.slug}`;
  const clientRecipients = project.members
    .filter((m) => m.role === "client_reviewer")
    .map((m) => m.user.email);

  await Promise.all(
    clientRecipients.map(async (to) => {
      const projectUrl = await mintSignInUrl({
        baseUrl: env.APP_URL,
        email: to,
        nextPath: projectPath,
      });
      const tpl = roundReadyClientEmail({
        projectName: project.name,
        roundNumber: round.number,
        imageCount: Math.max(imageCount, 1),
        projectUrl,
      });
      return sendEmail({ to, ...tpl });
    })
  );

  return NextResponse.json({
    ok: true,
    roundNumber: round.number,
    notified: clientRecipients.length,
    imageCount,
  });
}
