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

// Strongly-typed shape so the accept helper is independent of how the
// page's lookup query is written upstream.
type InviteWithProject = Prisma.InviteGetPayload<{
  include: { project: { include: { client: true; organization: true } } };
}>;

// Project invite — one-click access (with an interstitial confirm step).
//
// Email security scanners (Defender, Mimecast, Google Safe Browsing, etc.)
// follow every URL in a received email to scan for malware. That auto-GET
// would otherwise consume a single-use invite token before the recipient
// clicks. To guard against it:
//
//   - GET only RENDERS a confirm page (no DB writes)
//   - The "Continue" button POSTs a server action that does the actual
//     accept + redirect. Scanners don't click buttons.
//
// IMPORTANT (Next.js 15): cookies().set() doesn't follow onto a redirect
// from a Server Component. We mint a fresh login token here and bounce
// through /api/auth/verify (a Route Handler that CAN set cookies) for
// the session write.
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

  // Invite missing entirely → completely unknown link.
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

  // Already consumed → most likely by an email scanner. Offer the
  // recipient a magic-link sign-in for their address; if they were
  // successfully added to the project on the first (scanner) visit, the
  // magic-link will land them in the project just fine.
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

  // Already signed in with the matching email → no scanner risk for THIS
  // path (we're not in an email click, we're in the app). Accept directly.
  if (currentUser && currentUser.email === invite.email) {
    await acceptAndRedirect(invite, currentUser.id);
  }

  // Server actions for the two non-matching branches.
  async function acceptAnonymous() {
    "use server";
    await acceptAndRedirect(invite!, null);
  }
  async function switchAccount() {
    "use server";
    await destroySession();
    await acceptAndRedirect(invite!, null);
  }

  const mismatch = currentUser && currentUser.email !== invite.email;
  const roleLabel = invite.role.replace(/_/g, " ");

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
            You&apos;re invited as <strong className="text-ink">{roleLabel}</strong>.
          </p>

          {mismatch ? (
            <>
              <p className="text-sm text-muted mt-3">
                You&apos;re signed in as{" "}
                <span className="font-medium text-ink">{currentUser!.email}</span>,
                but this invite is for{" "}
                <span className="font-medium text-ink">{invite.email}</span>.
              </p>
              <form action={switchAccount} className="mt-6">
                <Button type="submit" className="w-full h-11">
                  Sign in as {invite.email}
                </Button>
              </form>
              <p className="text-[11px] text-muted-soft mt-4">
                Continuing will sign out your current session.
              </p>
            </>
          ) : (
            <>
              <form action={acceptAnonymous} className="mt-6">
                <Button type="submit" className="w-full h-11">
                  Continue as {invite.email}
                </Button>
              </form>
              <p className="text-[11px] text-muted-soft mt-4">
                Clicking continues to the project. Link is single-use.
              </p>
            </>
          )}
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
    await writeMembership(invite, existingUserId);
    redirect(projectPath);
  }

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

// "Already accepted" screen. Most common cause: an email security scanner
// followed the link before the human did. We offer a magic-link sign-in
// instead — the user is already a project member from the scanner's auto-
// visit, so the magic-link drops them straight into the project.
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
