import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/app/topbar";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isOrgAdmin } from "@/lib/auth";
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

  const projects = await prisma.project.findMany({
    where: {
      orgId: membership.orgId,
      status: showArchived ? "archived" : { not: "archived" },
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
    <>
      <Topbar userEmail={user.email} isAdmin={await isOrgAdmin(user.id)} />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">
              {showArchived ? "Archived projects" : "Projects"}
            </h1>
            <p className="text-sm text-muted mt-1">{membership.organization.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {archivedCount > 0 || showArchived ? (
              <Link
                href={showArchived ? "/" : "/?show=archived"}
                className="text-xs text-muted hover:text-ink transition-colors"
              >
                {showArchived
                  ? "← Back to active"
                  : `View archived (${archivedCount})`}
              </Link>
            ) : null}
            {!showArchived ? (
              <Button asChild>
                <Link href="/projects/new">New project</Link>
              </Button>
            ) : null}
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="surface p-12 text-center">
            <p className="text-sm text-muted">
              {showArchived ? "No archived projects." : "No projects yet."}
            </p>
            {!showArchived ? (
              <Button asChild className="mt-4">
                <Link href="/projects/new">Create your first project</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => {
              const cover = p.galleries[0]?.images[0]?.currentVersion?.storagePathThumb;
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.slug}`}
                  className="surface p-0 overflow-hidden hover:border-ink/30 transition-colors group"
                >
                  <div className="aspect-[4/3] bg-line/40 relative overflow-hidden">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/storage/${cover}`}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="p-6">
                    <h3 className="font-medium tracking-tight group-hover:underline underline-offset-4">
                      {p.name}
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      {p.client?.name ?? "No client"} · {p._count.galleries} galler
                      {p._count.galleries === 1 ? "y" : "ies"}
                    </p>
                    <p className="text-xs text-muted mt-4">Updated {formatDate(p.updatedAt)}</p>
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
