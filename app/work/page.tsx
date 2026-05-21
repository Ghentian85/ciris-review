import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/app/topbar";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isOrgAdmin } from "@/lib/auth";
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

  return (
    <>
      <Topbar userEmail={user.email} isAdmin={await isOrgAdmin(user.id)} />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="text-2xl font-medium tracking-tight">Work</h1>
        <p className="text-sm text-muted mt-1 mb-8">
          Projects with feedback waiting for post-production.
        </p>

        {projects.length === 0 ? (
          <div className="surface p-12 text-center text-sm text-muted">
            All clear. Nothing needs your attention right now.
          </div>
        ) : (
          <div className="surface divide-y divide-line">
            {projects.map(({ project, counts }) => {
              const lastRound = project.rounds[0];
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.slug}?tab=revision`}
                  className="p-4 flex items-center justify-between hover:bg-line/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{project.name}</p>
                    <p className="text-xs text-muted mt-0.5 truncate">
                      {project.client?.name ?? "Internal"}
                      {lastRound
                        ? ` · Round ${lastRound.number} ${lastRound.status}`
                        : ""}
                      {lastRound?.closedAt
                        ? ` · submitted ${formatDate(lastRound.closedAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs flex-shrink-0">
                    {counts.revision > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-status-revision/30 bg-status-revision/5 text-status-revision px-2.5 py-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {counts.revision} revision{counts.revision === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    {counts.notes > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-status-notes/30 bg-status-notes/5 text-status-notes px-2.5 py-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {counts.notes} note{counts.notes === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
