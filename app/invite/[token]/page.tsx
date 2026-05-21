import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createLoginToken, getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { sendEmail, magicLinkEmail } from "@/lib/email";

export default async function InviteAccept({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
    include: { project: { include: { client: true, organization: true } } },
  });

  if (!invite || invite.expiresAt < new Date() || invite.acceptedAt) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="surface p-8 max-w-sm text-center">
          <h1 className="font-medium">Invitation unavailable</h1>
          <p className="text-sm text-muted mt-2">
            This link has expired or has already been used.
          </p>
        </div>
      </main>
    );
  }

  const currentUser = await getCurrentUser();

  // If user is logged in with the invited email, accept immediately.
  if (currentUser && currentUser.email === invite.email) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: invite.projectId, userId: currentUser.id } },
      create: {
        projectId: invite.projectId,
        userId: currentUser.id,
        role: invite.role,
        canApprove: invite.role === "client_reviewer" || invite.role === "admin",
      },
      update: { role: invite.role },
    });
    await prisma.organizationMember.upsert({
      where: { orgId_userId: { orgId: invite.project.orgId, userId: currentUser.id } },
      create: { orgId: invite.project.orgId, userId: currentUser.id, role: "internal" },
      update: {},
    });
    await prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    redirect(`/projects/${invite.project.slug}`);
  }

  async function sendLink() {
    "use server";
    const { user, raw } = await createLoginToken(invite!.email);
    const url = `${env.APP_URL}/api/auth/verify?token=${encodeURIComponent(raw)}&next=/invite/${token}`;
    await sendEmail({ to: user.email, ...magicLinkEmail(url) });
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="surface p-8 max-w-md text-center">
        <p className="text-xs uppercase tracking-wide text-muted mb-2">
          {invite.project.client?.name ?? invite.project.organization.name}
        </p>
        <h1 className="text-xl font-medium">{invite.project.name}</h1>
        <p className="text-sm text-muted mt-2">
          You've been invited as <span className="font-medium">{invite.role.replace("_", " ")}</span>.
        </p>
        <form action={sendLink} className="mt-6">
          <Button type="submit" className="w-full">
            Continue as {invite.email}
          </Button>
        </form>
        <p className="text-xs text-muted mt-3">We'll email a one-time sign-in link.</p>
      </div>
    </main>
  );
}
