import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createLoginToken,
  destroySession,
  getCurrentUser,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app/logo";

// Strongly-typed shape so the accept helper is independent of how the
// page's lookup query is written upstream.
type InviteWithProject = Prisma.InviteGetPayload<{
  include: { project: { include: { client: true; organization: true } } };
}>;

// Project invite — one-click access.
//
// The token in the URL is the secret (same trust model as a magic link).
// Clicking the invite both signs the recipient in AND adds them to the
// project — no second email round-trip.
//
// IMPORTANT (Next.js 15): Server Components can read cookies but can't
// SET them. To set the session cookie we mint a fresh login-token and
// redirect to /api/auth/verify (a Route Handler) which sets the cookie
// and then redirects to `next`. The page handles everything except the
// final session write.
//
// Three branches:
//   1. Not signed in            → mint login-token, accept, redirect via verify
//   2. Signed in, matching email → accept, redirect (no new session needed)
//   3. Signed in, different email → show switch-account confirmation
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

// Shared accept path. Two flavors based on whether we already have a
// matching session: if yes, just write membership and redirect; if no,
// mint a login token and detour through /api/auth/verify so the Route
// Handler can set the session cookie (Server Components can't).
async function acceptAndRedirect(
  invite: InviteWithProject,
  existingUserId: string | null
) {
  const projectPath = `/projects/${invite.project.slug}`;

  if (existingUserId) {
    // Already signed in with the matching email — no cookie work needed.
    await writeMembership(invite, existingUserId);
    redirect(projectPath);
  }

  // Fresh / mismatched session: mint a one-shot login token for the
  // invite email, write membership now, then redirect to verify which
  // sets the cookie and forwards to `next`. Fresh users (no password
  // yet) get nudged through the welcome password page; returning users
  // go straight to the project.
  const { user, raw } = await createLoginToken(invite.email);
  await writeMembership(invite, user.id);

  const isFreshUser = !user.passwordHash;
  const next = isFreshUser
    ? `/account/password?welcome=1&continue=${encodeURIComponent(projectPath)}`
    : projectPath;

  redirect(
    `/api/auth/verify?token=${encodeURIComponent(raw)}&next=${encodeURIComponent(next)}`
  );
}

// Idempotent membership writes — safe to call multiple times if the user
// retries the invite link before the redirect lands.
async function writeMembership(invite: InviteWithProject, userId: string) {
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
    create: { orgId: invite.project.orgId, userId, role: "internal" },
    update: {},
  });
  await prisma.invite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });
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
