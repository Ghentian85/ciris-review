import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/app/topbar";
import { StatusChip, type ImageStatus } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isOrgAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ImgRow = {
  id: string;
  slotName: string;
  subjectKey: string | null;
  viewLabel: string | null;
  displayName: string | null;
  filenameOriginal: string;
  status: string;
  position: number;
  createdAt: Date;
  currentVersion: {
    storagePathThumb: string | null;
    versionNumber: number;
    width: number;
    height: number;
  } | null;
};

function groupBySubject(images: ImgRow[]) {
  // Same sort order as the detail page so prev/next matches the grid order.
  const sorted = [...images].sort((a, b) => {
    const aKey = a.subjectKey ?? a.slotName;
    const bKey = b.subjectKey ?? b.slotName;
    if (aKey !== bKey) return aKey.localeCompare(bKey);
    const aView = a.viewLabel ?? "";
    const bView = b.viewLabel ?? "";
    if (aView !== bView) return aView.localeCompare(bView);
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  // Build ordered groups
  const groups: { key: string; subject: string | null; items: ImgRow[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  for (const img of sorted) {
    const key = img.subjectKey ?? `__solo__${img.id}`;
    if (!current || current.key !== key) {
      current = { key, subject: img.subjectKey, items: [] };
      groups.push(current);
    }
    current.items.push(img);
  }
  return groups;
}

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const project = await prisma.project.findFirst({
    where: { slug, members: { some: { userId: user.id } } },
  });
  if (!project) notFound();

  const gallery = await prisma.gallery.findFirst({
    where: { id, projectId: project.id },
    include: {
      images: {
        include: {
          currentVersion: {
            select: {
              storagePathThumb: true,
              versionNumber: true,
              width: true,
              height: true,
            },
          },
        },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!gallery) notFound();

  const groups = groupBySubject(gallery.images);
  const baseHref = `/projects/${project.slug}/galleries/${gallery.id}/images`;

  return (
    <>
      <Topbar userEmail={user.email} isAdmin={await isOrgAdmin(user.id)} />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              <Link
                href={`/projects/${project.slug}`}
                className="hover:text-ink transition-colors"
              >
                {project.name}
              </Link>
              {" · "}
              {gallery.kind}
            </p>
            <h1 className="text-2xl font-medium tracking-tight">{gallery.name}</h1>
            <p className="text-sm text-muted mt-1">
              {gallery.images.length} image{gallery.images.length === 1 ? "" : "s"}
              {groups.length !== gallery.images.length
                ? ` · ${groups.length} subject${groups.length === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          <Button asChild>
            <Link href={`/projects/${project.slug}/upload?gallery=${gallery.id}`}>
              Upload more
            </Link>
          </Button>
        </div>

        {gallery.images.length === 0 ? (
          <div className="surface p-12 text-center">
            <p className="text-sm text-muted">No images yet.</p>
            <Button asChild className="mt-4">
              <Link href={`/projects/${project.slug}/upload?gallery=${gallery.id}`}>
                Upload images
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.key}>
                {g.subject && g.items.length > 1 ? (
                  <p className="text-xs uppercase tracking-wide text-muted mb-2 pl-1">
                    {g.subject} · {g.items.length} views
                  </p>
                ) : null}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {g.items.map((img) => {
                    const thumb = img.currentVersion?.storagePathThumb;
                    return (
                      <Link
                        key={img.id}
                        href={`${baseHref}/${img.id}`}
                        className="surface p-0 overflow-hidden group hover:border-ink/30 transition-colors block"
                      >
                        <div className="aspect-[3/4] bg-line/40 relative overflow-hidden">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/storage/${thumb}`}
                              alt={img.displayName ?? img.slotName}
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          ) : null}
                          {img.viewLabel ? (
                            <div className="absolute top-2 left-2 text-[10px] font-medium tracking-wide bg-ink/80 text-bg rounded-sm px-1.5 py-0.5">
                              {img.viewLabel}
                            </div>
                          ) : null}
                          <div className="absolute top-2 right-2">
                            <StatusChip status={img.status as ImageStatus} />
                          </div>
                        </div>
                        <div className="p-3">
                          <p
                            className="text-xs truncate"
                            title={img.filenameOriginal}
                          >
                            {img.displayName ?? img.slotName}
                          </p>
                          {img.currentVersion ? (
                            <p className="text-[10px] text-muted mt-0.5">
                              {img.currentVersion.width}×{img.currentVersion.height} · V
                              {img.currentVersion.versionNumber}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
