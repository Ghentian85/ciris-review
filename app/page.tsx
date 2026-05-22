import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const showArchived = show === "archived";

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  });
  if (!membership) {
    const org = await prisma.organization.create({
      data: {
        name: user.name ? `${user.name}'s Studio` : "My Studio",
        slug: `studio-${user.id.slice(-6)}`,
      },
    });
    membership = await prisma.organizationMember.create({
      data: { orgId: org.id, userId: user.id, role: "owner" },
      include: { organization: true },
    });
  }

  // client_reviewer and post_production only see projects they're a member of
  const isLimitedRole = ["client_reviewer", "post_production"].includes(membership.role);
  const projects = await prisma.project.findMany({
    where: {
      orgId: membership.orgId,
      status: showArchived ? "archived" : { not: "archived" },
      ...(isLimitedRole ? { members: { some: { userId: user.id } } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      client: true,
      galleries: {
        orderBy: { position: "asc" },
        take: 1,
        include: {
          images: {
            take: 1,
            orderBy: { position: "asc" },
            include: { currentVersion: true },
          },
        },
      },
      _count: { select: { galleries: true } },
    },
  });

  const archivedCount = await prisma.project.count({
    where: { orgId: membership.orgId, status: "archived" },
  });

  return (
    <main className="mx-auto max-w-7xl px-6 pt-12 pb-16 animate-rise">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {membership.organization.name}
            </p>
            <h1 className="text-[40px] md:text-[48px] font-display font-medium tracking-tight leading-[1.05]">
              {showArchived ? "Archived projects" : "Projects"}
            </h1>
            <p className="text-sm text-muted mt-3">
              {projects.length} {showArchived ? "archived" : "active"} ·{" "}
              <span className="text-muted-soft">
                {showArchived
                  ? "read-only"
                  : "review, comment, approve"}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {archivedCount > 0 || showArchived ? (
              <Link
                href={showArchived ? "/" : "/?show=archived"}
                className="text-xs text-muted hover:text-ink transition-colors h-9 px-3 inline-flex items-center hover:bg-ink/[0.04]"
              >
                {showArchived ? "← Back to active" : `Archived (${archivedCount})`}
              </Link>
            ) : null}
            {!showArchived && !isLimitedRole ? (
              <Button asChild size="lg">
                <Link href="/projects/new">+ New project</Link>
              </Button>
            ) : null}
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="surface-elev p-16 text-center max-w-xl mx-auto">
            <div className="mx-auto mb-5 h-12 w-12 bg-accent-soft grid place-items-center">
              <span className="h-2 w-2 rounded-full bg-accent" />
            </div>
            <h2 className="text-lg font-medium mb-1">
              {showArchived ? "No archived projects" : "No projects yet"}
            </h2>
            <p className="text-sm text-muted mb-6">
              {showArchived
                ? "Nothing in the archive."
                : "Create one to start reviewing shoots and approvals."}
            </p>
            {!showArchived && !isLimitedRole ? (
              <Button asChild size="lg">
                <Link href="/projects/new">Create your first project</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p) => {
              const cover = p.galleries[0]?.images[0]?.currentVersion?.storagePathThumb;
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.slug}`}
                  className="group surface p-0 overflow-hidden press hover:shadow-pop transition-shadow"
                >
                  <div className="aspect-[4/3] bg-line/30 relative overflow-hidden">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/storage/${cover}`}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center">
                        <span className="text-[11px] text-muted-soft tracking-[0.2em] uppercase">
                          No cover yet
                        </span>
                      </div>
                    )}
                    {/* Soft gradient sweep for text legibility on hover */}
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="p-5">
                    <h3 className="font-display font-medium tracking-tight text-[17px] leading-snug">
                      {p.name}
                    </h3>
                    <p className="text-xs text-muted mt-1">
                      {p.client?.name ?? "Internal"}
                    </p>
                    <p className="text-[11px] text-muted-soft mt-4 tabular-nums">
                      Updated {formatDate(p.updatedAt)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
    </main>
  );
}
