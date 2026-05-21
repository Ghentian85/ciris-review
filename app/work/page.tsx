import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

// Cross-project inbox for post-prod and admins. Lists every project that has
// at least one image needing work (revision_requested or approved_with_notes),
// grouped by project with a quick count.
export default async function WorkInbox() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Projects where the user is a member with a working role.
  const memberships = await prisma.projectMember.findMany({
    where: {
      userId: user.id,
      role: { in: ["post_production", "admin", "internal_reviewer"] },
    },
    include: {
      project: {
        include: {
          client: { select: { name: true } },
          rounds: { orderBy: { number: "desc" }, take: 1 },
        },
      },
    },
  });

  const projectIds = memberships.map((m) => m.projectId);
  const grouped = await prisma.image.groupBy({
    by: ["galleryId", "status"],
    where: {
      gallery: { projectId: { in: projectIds } },
      status: { in: ["revision_requested", "approved_with_notes"] },
      killed: false,
    },
    _count: { _all: true },
  });

  // Map gallery → project
  const galleries = projectIds.length
    ? await prisma.gallery.findMany({
        where: { projectId: { in: projectIds } },
        select: { id: true, projectId: true },
      })
    : [];
  const galleryProject = new Map(galleries.map((g) => [g.id, g.projectId]));

  type ProjectCounts = { revision: number; notes: number };
  const counts = new Map<string, ProjectCounts>();
  for (const g of grouped) {
    const projectId = galleryProject.get(g.galleryId);
    if (!projectId) continue;
    const cur = counts.get(projectId) ?? { revision: 0, notes: 0 };
    if (g.status === "revision_requested") cur.revision += g._count._all;
    if (g.status === "approved_with_notes") cur.notes += g._count._all;
    counts.set(projectId, cur);
  }

  const projects = memberships
    .map((m) => ({
      project: m.project,
      role: m.role,
      counts: counts.get(m.projectId) ?? { revision: 0, notes: 0 },
    }))
    .filter((p) => p.counts.revision > 0 || p.counts.notes > 0)
    .sort((a, b) => b.counts.revision - a.counts.revision);

  const totalRevisions = projects.reduce((s, p) => s + p.counts.revision, 0);
  const totalNotes = projects.reduce((s, p) => s + p.counts.notes, 0);

  return (
    <main className="mx-auto max-w-5xl px-6 pt-12 pb-16 animate-rise">
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Post-production inbox
          </p>
          <h1 className="text-[40px] md:text-[48px] font-display font-medium tracking-tight leading-[1.05]">
            Work
          </h1>
          <p className="text-sm text-muted mt-3">
            {projects.length === 0
              ? "All clear. Nothing needs your attention right now."
              : `${projects.length} project${projects.length === 1 ? "" : "s"} · ${totalRevisions} revision${
                  totalRevisions === 1 ? "" : "s"
                }${totalNotes ? ` · ${totalNotes} note${totalNotes === 1 ? "" : "s"}` : ""}`}
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="surface-elev p-16 text-center max-w-xl mx-auto">
            <div className="mx-auto mb-5 h-12 w-12 bg-status-approved-soft grid place-items-center">
              <span className="h-2 w-2 rounded-full bg-status-approved" />
            </div>
            <h2 className="text-lg font-medium mb-1">Inbox zero</h2>
            <p className="text-sm text-muted">
              Nothing waiting for you. You&apos;ll see new revision requests here as
              clients submit rounds.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map(({ project, counts }) => {
              const lastRound = project.rounds[0];
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.slug}?tab=revision`}
                  className="group surface p-5 flex items-center gap-4 press hover:shadow-pop transition-shadow"
                >
                  <div className="h-10 w-10 flex-shrink-0 bg-status-revision-soft grid place-items-center">
                    <span className="h-2 w-2 rounded-full bg-status-revision" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tracking-tight truncate group-hover:text-ink-soft transition-colors">
                      {project.name}
                    </p>
                    <p className="text-xs text-muted mt-1 truncate">
                      <span>{project.client?.name ?? "Internal"}</span>
                      {lastRound ? (
                        <>
                          <span className="text-muted-soft mx-1.5">·</span>
                          <span>
                            Round {lastRound.number} {lastRound.status}
                          </span>
                        </>
                      ) : null}
                      {lastRound?.closedAt ? (
                        <>
                          <span className="text-muted-soft mx-1.5">·</span>
                          <span>submitted {formatDate(lastRound.closedAt)}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {counts.revision > 0 ? (
                      <span className="inline-flex items-center gap-1.5 bg-status-revision-soft text-status-revision px-3 h-7 text-xs font-medium tabular-nums">
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {counts.revision}
                      </span>
                    ) : null}
                    {counts.notes > 0 ? (
                      <span className="inline-flex items-center gap-1.5 bg-status-notes-soft text-status-notes px-3 h-7 text-xs font-medium tabular-nums">
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {counts.notes}
                      </span>
                    ) : null}
                    <span className="text-muted-soft text-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
    </main>
  );
}
