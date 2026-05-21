import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { ProjectAdminRow } from "./project-admin-row";

// Org-level admin section. Owner + admin only. Lists every project (active
// AND archived) with lifecycle controls, plus the recent audit log so an admin
// can see who did what.
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  });
  if (!membership) redirect("/");
  const isAdmin = membership.role === "owner" || membership.role === "admin";
  if (!isAdmin) redirect("/");

  const orgId = membership.orgId;

  const projects = await prisma.project.findMany({
    where: { orgId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      client: { select: { name: true } },
      _count: { select: { galleries: true, members: true, rounds: true } },
    },
  });

  const orgMembers = await prisma.organizationMember.findMany({
    where: { orgId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  // 60 most-recent audit log entries across all projects of this org.
  const auditRaw = await prisma.auditLog.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      actor: { select: { name: true, email: true } },
      project: { select: { name: true, slug: true } },
    },
  });

  // Image counts per project (separate query — avoids exploding includes)
  const imageCounts = await prisma.image.groupBy({
    by: ["galleryId"],
    where: { gallery: { project: { orgId } }, killed: false },
    _count: { _all: true },
  });
  const galleries = await prisma.gallery.findMany({
    where: { project: { orgId } },
    select: { id: true, projectId: true },
  });
  const galleryToProject = new Map(galleries.map((g) => [g.id, g.projectId]));
  const imagesPerProject = new Map<string, number>();
  for (const ic of imageCounts) {
    const pid = galleryToProject.get(ic.galleryId);
    if (pid) imagesPerProject.set(pid, (imagesPerProject.get(pid) ?? 0) + ic._count._all);
  }

  const activeCount = projects.filter((p) => p.status !== "archived").length;
  const archivedCount = projects.filter((p) => p.status === "archived").length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wide text-muted mb-2">
            {membership.organization.name}
          </p>
          <h1 className="text-2xl font-medium tracking-tight">Admin</h1>
          <p className="text-sm text-muted mt-1">
            {activeCount} active · {archivedCount} archived · {orgMembers.length}{" "}
            org member{orgMembers.length === 1 ? "" : "s"}
          </p>
        </div>

        {/* ── Projects ─────────────────────────────────────────────────── */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm uppercase tracking-wide text-muted">Projects</h2>
            <Link
              href="/projects/new"
              className="text-xs text-muted hover:text-ink transition-colors"
            >
              + New project
            </Link>
          </div>
          {projects.length === 0 ? (
            <div className="surface p-8 text-center text-sm text-muted">
              No projects yet.
            </div>
          ) : (
            <div className="surface divide-y divide-line">
              {projects.map((p) => (
                <ProjectAdminRow
                  key={p.id}
                  project={{
                    id: p.id,
                    slug: p.slug,
                    name: p.name,
                    status: p.status,
                    clientName: p.client?.name ?? null,
                    updatedAt: p.updatedAt.toISOString(),
                    galleryCount: p._count.galleries,
                    memberCount: p._count.members,
                    roundCount: p._count.rounds,
                    imageCount: imagesPerProject.get(p.id) ?? 0,
                  }}
                  canDelete={membership.role === "owner"}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Org members ──────────────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-sm uppercase tracking-wide text-muted mb-3">
            Org members
          </h2>
          <div className="surface divide-y divide-line">
            {orgMembers.map((m) => (
              <div key={m.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{m.user.name ?? m.user.email}</p>
                  <p className="text-[11px] text-muted">{m.user.email}</p>
                </div>
                <span className="text-[11px] text-muted uppercase tracking-wide">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Audit log ────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm uppercase tracking-wide text-muted mb-3">
            Activity log
            <span className="text-[10px] text-muted/70 ml-2 normal-case font-normal">
              last {auditRaw.length}
            </span>
          </h2>
          {auditRaw.length === 0 ? (
            <div className="surface p-8 text-center text-sm text-muted">
              No activity yet.
            </div>
          ) : (
            <div className="surface divide-y divide-line max-h-[480px] overflow-y-auto">
              {auditRaw.map((a) => (
                <div key={a.id} className="p-3 grid grid-cols-[140px_120px_1fr_auto] gap-3 text-xs items-center">
                  <span className="text-muted tabular-nums">
                    {formatDate(a.createdAt)}{" "}
                    {a.createdAt.toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-muted truncate">
                    {a.actor?.name ?? a.actor?.email ?? "system"}
                  </span>
                  <span className="truncate">
                    <span className="font-medium">{a.action}</span>
                    {a.project ? (
                      <>
                        {" · "}
                        <Link
                          href={`/projects/${a.project.slug}`}
                          className="text-muted hover:text-ink transition-colors"
                        >
                          {a.project.name}
                        </Link>
                      </>
                    ) : null}
                  </span>
                  <span className="text-muted text-[10px] truncate max-w-[200px]" title={a.payload ?? undefined}>
                    {a.payload ? a.payload.slice(0, 60) : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
    </main>
  );
}
