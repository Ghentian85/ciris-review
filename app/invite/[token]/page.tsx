import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createLoginToken,
  destroySession,
  getCurrentUser,
  mintSignInUrl,
} from "@/lib/auth";
import { sendEmail, magicLinkEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app/logo";

type InviteWithProject = Prisma.InviteGetPayload<{
  include: { project: { include: { client: true; organization: true } } };
}>;

// Project invite — one click straight into the project.
//
// Trade-off: this trusts that whoever opens the URL is the intended
// recipient (standard magic-link model). Some enterprise email security
// scanners auto-follow the link, which can consume the single-use token
// before the human clicks; the AlreadyAcceptedScreen below handles that
// gracefully by offering a fresh sign-in link.
//
// Server Components can't set cookies (Next.js 15), so the not-signed-in
// path mints a fresh login token and bounces through /api/auth/verify
// (a Route Handler) for the session-cookie write.
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

  if (!invite) {
    return <BlockedScreen body="This invite link is invalid." />;
  }
  if (invite.expiresAt < new Date()) {
    return (
      <BlockedScreen
        body={`This invite expired on ${invite.expiresAt.toLocaleDateString()}. Ask whoever sent it for a new one.`}
      />
    );
  }

  // Already consumed → most likely by an email scanner. Offer a magic
  // sign-in link to the invitee's address; membership was written on
  // the scanner's visit, so they'll land in the project anyway.
  if (invite.acceptedAt) {
    async function sendSignInLink() {
      "use server";
      const url = await mintSignInUrl({
        baseUrl: env.APP_URL,
        email: invite!.email,
        nextPath: `/projects/${invite!.project.slug}`,
      });
      await sendEmail({ to: invite!.email, ...magicLinkEmail(url) });
    }
    return (
      <AlreadyAcceptedScreen
        email={invite.email}
        projectName={invite.project.name}
        action={sendSignInLink}
      />
    );
  }

  const currentUser = await getCurrentUser();

  // Branch A: already signed in with the matching email → no cookie
  // work needed, just write membership and redirect.
  // Branch B: not signed in → mint login token, write membership, bounce
  // through verify so the session cookie sticks.
  if (!currentUser || currentUser.email === invite.email) {
    await acceptAndRedirect(invite, currentUser?.id ?? null);
  }

  // Branch C: signed in as a different user. Only here do we render UI —
  // an explicit switch confirmation so we don't silently kick someone
  // out of their current session.
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
            {invite.project.organization.name}
          </p>
          <h1 className="font-display text-[24px] tracking-tight leading-tight">
            {invite.project.name}
          </h1>
          <p className="text-sm text-muted mt-3">
            You&apos;re signed in as <strong className="text-ink">{currentUser!.email}</strong>,
            but this invite is for <strong className="text-ink">{invite.email}</strong>.
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

// Writes membership and redirects straight to the project. No interstitial,
// no welcome-password detour — users can set a password later via the
// avatar in the topbar.
async function acceptAndRedirect(
  invite: InviteWithProject,
  existingUserId: string | null
) {
  const projectPath = `/projects/${invite.project.slug}`;

  if (existingUserId) {
    await writeMembership(invite, existingUserId);
    redirect(projectPath);
  }

  // Mint a fresh login token, write membership, redirect through
  // /api/auth/verify so the Route Handler sets the cookie + lands on
  // the project.
  const { user, raw } = await createLoginToken(invite.email);
  await writeMembership(invite, user.id);
  redirect(
    `/api/auth/verify?token=${encodeURIComponent(raw)}&next=${encodeURIComponent(projectPath)}`
  );
}

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

function AlreadyAcceptedScreen({
  email,
  projectName,
  action,
}: {
  email: string;
  projectName: string;
  action: () => Promise<void>;
}) {
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
            <span className="h-1.5 w-1.5 rounded-full bg-status-notes" />
            Link already used
          </p>
          <h1 className="font-display text-[22px] tracking-tight leading-tight">
            {projectName}
          </h1>
          <p className="text-sm text-muted mt-3 leading-relaxed">
            This invite was already opened — sometimes an email scanner does this
            before you click. No problem: we&apos;ll send a fresh sign-in link to{" "}
            <strong className="text-ink">{email}</strong>.
          </p>
          <form action={action} className="mt-6">
            <Button type="submit" className="w-full h-11">
              Email me a sign-in link
            </Button>
          </form>
          <p className="text-[11px] text-muted-soft mt-4">
            Already added to the project — the link drops you straight in.
          </p>
        </div>
      </div>
    </main>
  );
}
