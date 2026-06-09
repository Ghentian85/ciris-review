import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RefreshClient } from "./refresh-client";

// Restricted to admin / internal_reviewer — same gate as upload + member
// management. Clients should never see this.
export default async function RefreshPreviewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const project = await prisma.project.findFirst({
    where: { slug, members: { some: { userId: user.id } } },
    include: { members: { where: { userId: user.id }, take: 1 } },
  });
  if (!project) notFound();
  const role = project.members[0]?.role;
  if (role !== "admin" && role !== "internal_reviewer") {
    redirect(`/projects/${slug}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pt-12 pb-16 animate-rise">
      <Link
        href={`/projects/${slug}`}
        className="text-[11px] text-muted-soft hover:text-ink underline underline-offset-4"
      >
        ← Back to {project.name}
      </Link>

      <div className="mt-6 mb-10">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Maintenance
        </p>
        <h1 className="font-display text-[36px] leading-[1.05] tracking-tight">
          Refresh previews
        </h1>
        <p className="text-sm text-muted mt-3 max-w-xl leading-relaxed">
          Drop the original source files for the images you want re-rendered.
          Filenames must match the existing slots — same parser as upload.
          Each match overwrites the current preview and thumbnail{" "}
          <strong className="text-ink-soft">in place</strong>:
        </p>
        <ul className="text-sm text-muted mt-3 pl-5 list-disc space-y-1.5 max-w-xl">
          <li>No new version is created</li>
          <li>Status, decisions, comments, and annotations stay untouched</li>
          <li>The new preview is rendered <strong className="text-ink-soft">without</strong> the &quot;PREVIEW&quot; watermark, regardless of project settings</li>
          <li>Older versions in history keep whatever they had — only the current version is refreshed</li>
        </ul>
      </div>

      <RefreshClient projectId={project.id} projectSlug={project.slug} />
    </main>
  );
}
