import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BrandLogo } from "@/components/app/brand-logo";

// Print-styled read-only view of the Packshot ID. The user hits Cmd+P
// (or the browser's print shortcut) → Save as PDF. No extra PDF library
// needed. The page uses semantic print CSS so headings and sections
// break cleanly across pages, and the topbar is hidden on print.
export default async function PackshotIdPrintPage({
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
      organization: true,
    },
  });
  if (!client) notFound();

  const membership = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId: client.orgId, userId: user.id } },
  });
  if (!membership) redirect("/");

  const p = client.packshotId;
  const org = client.organization;

  const sections: Array<{ title: string; items: Array<{ label: string; value: string | null | undefined }> }> = [
    {
      title: "Brand",
      items: [
        { label: "About", value: p?.brandBlurb },
        { label: "Audience", value: p?.audience },
      ],
    },
    {
      title: "Styling",
      items: [
        { label: "Styling notes", value: p?.stylingNotes },
        { label: "Fit", value: p?.fitNotes },
      ],
    },
    {
      title: "Technical",
      items: [
        { label: "Camera", value: p?.cameraNotes },
        { label: "Lighting", value: p?.lightingNotes },
        { label: "Shadow", value: p?.shadowNotes },
        { label: "Warmth & colour", value: p?.colourNotes },
      ],
    },
    {
      title: "Finishing",
      items: [
        { label: "Formats", value: p?.formatNotes },
        { label: "Whitespace", value: p?.whitespaceNotes },
        { label: "Delivery specs", value: p?.deliverySpecs },
      ],
    },
  ];

  return (
    <main className="packshot-print mx-auto max-w-[760px] px-10 py-12 bg-white text-ink print:p-0">
      {/* Header */}
      <header className="flex items-start justify-between pb-6 mb-10 border-b border-ink/30">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted mb-2">
            Packshot ID
          </p>
          <h1 className="font-display text-[32px] leading-tight tracking-tight">
            {client.name}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <div className="text-ink">
            <BrandLogo logoUrl={org.logoUrl} alt={org.displayName ?? org.name} className="h-8 w-auto" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
            {org.displayName ?? org.name}
          </p>
        </div>
      </header>

      {/* Sections */}
      {sections.map((section) => {
        const filled = section.items.filter((i) => i.value && i.value.trim());
        if (filled.length === 0) return null;
        return (
          <section key={section.title} className="mb-10 break-inside-avoid">
            <h2 className="text-[11px] uppercase tracking-[0.22em] text-muted mb-4 border-b hairline pb-2">
              {section.title}
            </h2>
            <dl className="space-y-5">
              {filled.map((i) => (
                <div key={i.label}>
                  <dt className="text-[13px] font-medium text-ink mb-1">{i.label}</dt>
                  <dd className="text-sm leading-relaxed text-ink-soft whitespace-pre-wrap">
                    {i.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}

      {sections.every((s) => s.items.every((i) => !i.value || !i.value.trim())) ? (
        <p className="text-sm text-muted italic">
          No Packshot ID content yet.
        </p>
      ) : null}

      {/* Footer */}
      <footer className="mt-16 pt-6 border-t hairline text-[10px] uppercase tracking-[0.22em] text-muted-soft flex justify-between">
        <span>{client.name} · Packshot ID</span>
        <span>
          Updated {p?.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "—"}
        </span>
      </footer>

      {/* Print styles */}
      <style>
        {`@media print {
          @page { margin: 18mm 16mm; }
          body { background: white !important; }
          .packshot-print { max-width: none; padding: 0; }
          /* Hide any topbar / nav that might render above us */
          header[class*="sticky"] { display: none !important; }
        }`}
      </style>
    </main>
  );
}
