import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PackshotIdForm } from "./form";

// Editable Packshot ID for a client. One per client (Client.packshotId is
// 1:1). Admin / internal-reviewer only. Linked from the project overview
// when the project has a client.
export default async function PackshotIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: clientId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      packshotId: true,
      organization: { select: { id: true } },
    },
  });
  if (!client) notFound();

  // Org-member gate: must at least belong to the client's org.
  const membership = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId: client.organization.id, userId: user.id } },
  });
  if (!membership) redirect("/");
  if (membership.role !== "owner" && membership.role !== "admin" && membership.role !== "internal") {
    redirect("/");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pt-12 pb-24 animate-rise">
      <div className="flex items-center justify-between mb-10 gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {client.name}
          </p>
          <h1 className="font-display text-[40px] leading-[1.05] tracking-tight">
            Packshot ID
          </h1>
          <p className="text-sm text-muted mt-3 max-w-xl">
            Styling &amp; technical brief for the studio floor. Filled in once per
            client, used on every shoot. Export to PDF when done (print-ready).
          </p>
        </div>
        <Link
          href={`/clients/${clientId}/packshot-id/print`}
          target="_blank"
          className="press inline-flex items-center h-10 px-4 text-sm font-medium border border-ink bg-ink text-bg hover:bg-ink-soft flex-shrink-0"
        >
          Open print view
        </Link>
      </div>

      <PackshotIdForm
        clientId={clientId}
        initial={{
          brandBlurb: client.packshotId?.brandBlurb ?? "",
          audience: client.packshotId?.audience ?? "",
          stylingNotes: client.packshotId?.stylingNotes ?? "",
          fitNotes: client.packshotId?.fitNotes ?? "",
          cameraNotes: client.packshotId?.cameraNotes ?? "",
          lightingNotes: client.packshotId?.lightingNotes ?? "",
          shadowNotes: client.packshotId?.shadowNotes ?? "",
          colourNotes: client.packshotId?.colourNotes ?? "",
          formatNotes: client.packshotId?.formatNotes ?? "",
          whitespaceNotes: client.packshotId?.whitespaceNotes ?? "",
          deliverySpecs: client.packshotId?.deliverySpecs ?? "",
        }}
      />
    </main>
  );
}
