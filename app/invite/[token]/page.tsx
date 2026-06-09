import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app/logo";

// Strongly-typed shape for the invite we hand to acceptAndRedirect — keeps
// the helper independent of how the lookup query is written upstream.
type InviteWithProject = Prisma.InviteGetPayload<{
  include: { project: { include: { client: true; organization: true } } };
}>;

// Project invite — one-click access.
//
// The token embedded in the URL IS the secret. Anyone holding this URL is
// trusted to be the invited recipient (same security model as a magic
// link). Clicking the invite from email therefore both signs you in AND
// adds you to the project — no second email round-trip.
//
// Three branches:
//   1. Not signed in            → auto sign in as invite.email, accept, go
//   2. Signed in, matching email → accept, go
//   3. Signed in, different email → render a "switch to <email>" button.
//      Edge case (shared computer, admin testing); confirms intent before
//      we replace the current session.
export default async function InviteAccept({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
    include: { project: { include: { client: true, organization: true } } },
  });

  if (!invite || invite.expiresAt < new Date() || invite.acceptedAt) {
    return <BlockedScreen body="This invite has expired or has already been used." />;
  }

  const currentUser = await getCurrentUser();

  // Branches 1 & 2 → accept silently and redirect.
  if (!currentUser || currentUser.email === invite.email) {
    await acceptAndRedirect(invite, currentUser?.id ?? null);
  }

  // Branch 3 → confirm session switch.
  async function switchAccount() {
    "use server";
    await destroySession();
    await acceptAndRedirect(invite!, null);
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 animate-rise">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 text-ink">
          <Logo className="h-7 w-auto mx-auto" />
          <p className="text-[10px] text-muted tracking-[0.28em] uppercase mt-3 font-medium">
            Review
          </p>
        </div>
        <div className="surface p-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted mb-3 flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Project invite
          </p>
          <h1 className="font-display text-[24px] tracking-tight leading-tight">
            {invite.project.name}
          </h1>
          <p className="text-sm text-muted mt-3">
            You&apos;re signed in as <span className="font-medium text-ink">{currentUser!.email}</span>,
            but this invite is for <span className="font-medium text-ink">{invite.email}</span>.
          </p>
          <form action={switchAccount} className="mt-6">
            <Button type="submit" className="w-full h-11">
              Sign in as {invite.email}
            </Button>
          </form>
          <p className="text-[11px] text-muted-soft mt-4">
            Continuing will sign out your current session.
          </p>
        </div>
      </div>
    </main>
  );
}

// Shared accept path: upsert the User (if first-time), create a session,
// attach project + org membership, mark the invite consumed, redirect.
// `existingUserId` lets us skip the user upsert + session create when the
// signed-in user already matches the invite — keeps that branch cheap.
async function acceptAndRedirect(
  invite: InviteWithProject,
  existingUserId: string | null
) {
  let userId = existingUserId;
  let isFreshUser = false;
  if (!userId) {
    const user = await prisma.user.upsert({
      where: { email: invite.email },
      update: {},
      create: { email: invite.email },
    });
    userId = user.id;
    isFreshUser = !user.passwordHash;
    await createSession(userId);
  }
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: invite.projectId, userId } },
    create: {
      projectId: invite.projectId,
      userId,
      role: invite.role,
      canApprove: invite.role === "client_reviewer" || invite.role === "admin",
    },
    update: { role: invite.role },
  });
  await prisma.organizationMember.upsert({
    where: { orgId_userId: { orgId: invite.project.orgId, userId } },
    create: {
      orgId: invite.project.orgId,
      userId,
      role: "internal",
    },
    update: {},
  });
  await prisma.invite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });
  // For fresh users (no passwordHash yet) detour through the welcome
  // password page so they're prompted once to set a password — they can
  // skip it and land on the project anyway. Returning users go direct.
  const projectPath = `/projects/${invite.project.slug}`;
  if (isFreshUser) {
    redirect(`/account/password?welcome=1&continue=${encodeURIComponent(projectPath)}`);
  }
  redirect(projectPath);
}

function BlockedScreen({ body }: { body: string }) {
  return (
    <main className="min-h-screen grid place-items-center p-6 animate-rise">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 text-ink">
          <Logo className="h-7 w-auto mx-auto" />
          <p className="text-[10px] text-muted tracking-[0.28em] uppercase mt-3 font-medium">
            Review
          </p>
        </div>
        <div className="surface p-8">
          <div className="mx-auto mb-4 h-10 w-10 bg-status-revision-soft grid place-items-center">
            <span className="h-2 w-2 rounded-full bg-status-revision" />
          </div>
          <h1 className="font-medium text-base">Invitation unavailable</h1>
          <p className="text-sm text-muted mt-2 leading-relaxed">{body}</p>
        </div>
      </div>
    </main>
  );
}
