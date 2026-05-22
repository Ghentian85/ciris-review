import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Reviewer } from "@/components/reviewer/reviewer";
import type {
  Comment,
  ImageInfo,
  Role,
  SiblingView,
  VersionEntry,
} from "@/components/reviewer/types";

function sortImages<
  T extends {
    position: number;
    subjectKey: string | null;
    viewLabel: string | null;
    slotName: string;
    createdAt: Date;
  },
>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const aKey = a.subjectKey ?? a.slotName;
    const bKey = b.subjectKey ?? b.slotName;
    if (aKey !== bKey) return aKey.localeCompare(bKey);
    const aView = a.viewLabel ?? "";
    const bView = b.viewLabel ?? "";
    if (aView !== bView) return aView.localeCompare(bView);
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

type TabKey = "pending" | "approved" | "revision";

const TAB_LABELS: Record<TabKey, string> = {
  pending: "Still to review",
  approved: "Approved",
  revision: "Needs revision",
};

export default async function ImageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string; imageId: string }>;
  searchParams: Promise<{ from?: string; tab?: string; v?: string; compare?: string }>;
}) {
  const { slug, id: galleryId, imageId } = await params;
  const { from, tab: rawTab, v: rawV, compare: rawCompare } = await searchParams;
  const fromOverview = from === "overview";
  const tab: TabKey =
    rawTab === "approved" || rawTab === "revision" ? rawTab : "pending";

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const project = await prisma.project.findFirst({
    where: { slug, members: { some: { userId: user.id } } },
    include: {
      members: { where: { userId: user.id }, take: 1 },
    },
  });
  if (!project) notFound();
  const role = (project.members[0]?.role ?? "client_reviewer") as Role;

  const gallery = await prisma.gallery.findFirst({
    where: { id: galleryId, projectId: project.id },
    include: {
      images: {
        include: { currentVersion: true },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!gallery) notFound();

  // Drop killed images and orphans (no currentVersion — e.g. failed upload
  // where the version derivation threw after the Image row was created) so
  // arrow nav and sibling lists never land on a dead page.
  const navigable = gallery.images.filter(
    (i) => !i.killed && i.currentVersionId !== null
  );
  const sorted = sortImages(navigable);
  const idx = sorted.findIndex((i) => i.id === imageId);
  if (idx === -1) notFound();

  const currentImage = sorted[idx];
  if (!currentImage.currentVersion) notFound();

  // Load all versions for this image so we can render a switcher.
  const allVersions = await prisma.imageVersion.findMany({
    where: { imageId: currentImage.id },
    orderBy: { versionNumber: "asc" },
    select: {
      id: true,
      versionNumber: true,
      storagePathPreview: true,
      storagePathOriginal: true,
      width: true,
      height: true,
    },
  });

  // Resolve active version: default to currentVersion; ?v=N selects a specific
  // version when valid (otherwise we silently fall back to current).
  const requestedVersionNumber = rawV ? parseInt(rawV, 10) : NaN;
  const activeVersion =
    (!Number.isNaN(requestedVersionNumber)
      ? allVersions.find((v) => v.versionNumber === requestedVersionNumber)
      : null) ?? allVersions.find((v) => v.id === currentImage.currentVersionId);
  if (!activeVersion) notFound();

  const isHistory = activeVersion.id !== currentImage.currentVersionId;

  // Compare mode: ?compare=N pairs the active version against version N
  // (typically an older one). We refuse self-compare and silently ignore if
  // N doesn't exist. In compare mode the UI shows two stages side-by-side.
  const requestedCompareNumber = rawCompare ? parseInt(rawCompare, 10) : NaN;
  const compareVersion =
    !Number.isNaN(requestedCompareNumber) && allVersions.length > 1
      ? allVersions.find(
          (v) =>
            v.versionNumber === requestedCompareNumber && v.id !== activeVersion.id
        ) ?? null
      : null;
  const isCompare = compareVersion !== null;

  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;
  const baseHref = `/projects/${project.slug}/galleries/${gallery.id}/images`;

  // querySuffix preserves tab navigation. We deliberately DON'T preserve ?v=:
  // each image starts on its own current version. Switching versions stays
  // on the same image so the v param only lives on the version switcher.
  const querySuffix = fromOverview ? `?from=overview&tab=${tab}` : "";

  const siblings: SiblingView[] = (
    currentImage.subjectKey
      ? sorted.filter((i) => i.subjectKey === currentImage.subjectKey)
      : [currentImage]
  ).map((s) => ({
    id: s.id,
    viewLabel: s.viewLabel,
    href: `${baseHref}/${s.id}${querySuffix}`,
    previewPath: s.currentVersion?.storagePathPreview ?? undefined,
  }));

  // Comments + annotations are version-scoped; only load the ones tied to
  // the active version. Clients still only see client-visible comments.
  // We fetch the flat list and then group replies under their parents.
  const rawComments = await prisma.comment.findMany({
    where: {
      imageId,
      versionId: activeVersion.id,
      ...(role === "client_reviewer" ? { visibility: "client" } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, email: true, name: true } },
      annotations: true,
    },
  });

  const repliesByParent = new Map<string, typeof rawComments>();
  for (const c of rawComments) {
    if (c.parentId) {
      const arr = repliesByParent.get(c.parentId) ?? [];
      arr.push(c);
      repliesByParent.set(c.parentId, arr);
    }
  }

  const initialComments: Comment[] = rawComments
    .filter((c) => !c.parentId)
    .map((c) => ({
      id: c.id,
      body: c.body,
      visibility: c.visibility as "client" | "internal",
      createdAt: c.createdAt.toISOString(),
      parentId: null,
      resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : null,
      author: c.author,
      annotations: c.annotations.map((a) => ({
        id: a.id,
        commentId: a.commentId,
        shape: a.shape as "pin" | "rect" | "arrow" | "freehand",
        geom: a.geom,
        color: a.color,
      })),
      replies: (repliesByParent.get(c.id) ?? []).map((r) => ({
        id: r.id,
        body: r.body,
        visibility: r.visibility as "client" | "internal",
        createdAt: r.createdAt.toISOString(),
        parentId: r.parentId!,
        author: r.author,
      })),
    }));

  const imageInfo: ImageInfo = {
    id: currentImage.id,
    slotName: currentImage.slotName,
    subjectKey: currentImage.subjectKey,
    viewLabel: currentImage.viewLabel,
    filenameOriginal: currentImage.filenameOriginal,
    displayName: currentImage.displayName,
    status: currentImage.status,
    width: activeVersion.width || 1000,
    height: activeVersion.height || 1250,
    previewPath: activeVersion.storagePathPreview ?? activeVersion.storagePathOriginal ?? "",
    versionId: activeVersion.id,
    versionNumber: activeVersion.versionNumber,
  };

  // Build version switcher entries. Each version is a Link that swaps the v=
  // query while keeping any from/tab context.
  const buildVersionHref = (versionNumber: number) => {
    const params = new URLSearchParams();
    if (fromOverview) {
      params.set("from", "overview");
      params.set("tab", tab);
    }
    // Current version = no v param (cleaner URLs).
    const currentNum = allVersions.find(
      (v) => v.id === currentImage.currentVersionId
    )?.versionNumber;
    if (versionNumber !== currentNum) {
      params.set("v", String(versionNumber));
    }
    const qs = params.toString();
    return `${baseHref}/${currentImage.id}${qs ? "?" + qs : ""}`;
  };
  // Compare URL builder. `?compare=N` opens compare against version N.
  const buildCompareHref = (versionNumber: number) => {
    const params = new URLSearchParams();
    if (fromOverview) {
      params.set("from", "overview");
      params.set("tab", tab);
    }
    if (rawV) params.set("v", rawV);
    params.set("compare", String(versionNumber));
    return `${baseHref}/${currentImage.id}?${params.toString()}`;
  };

  const versions: VersionEntry[] = allVersions.map((v) => ({
    versionNumber: v.versionNumber,
    isCurrent: v.id === currentImage.currentVersionId,
    isActive: v.id === activeVersion.id,
    href: buildVersionHref(v.versionNumber),
    compareHref:
      // Don't offer compare against ourselves; only show when 2+ versions exist
      allVersions.length > 1 && v.id !== activeVersion.id
        ? buildCompareHref(v.versionNumber)
        : null,
  }));

  // ── Compare mode: load the other version's preview + annotations ──
  type CompareData = {
    versionNumber: number;
    previewPath: string;
    width: number;
    height: number;
    annotations: { id: string; shape: string; geom: string; color: string }[];
    exitHref: string;
  };
  let compareData: CompareData | null = null;
  if (isCompare && compareVersion) {
    const otherAnnotations = await prisma.annotation.findMany({
      where: { versionId: compareVersion.id },
      include: {
        // Annotations carry comment visibility via their parent comment.
        comment: { select: { visibility: true } },
      },
    });
    const filtered =
      role === "client_reviewer"
        ? otherAnnotations.filter((a) => a.comment?.visibility !== "internal")
        : otherAnnotations;
    // exitHref = same page minus the compare param.
    const exitParams = new URLSearchParams();
    if (fromOverview) {
      exitParams.set("from", "overview");
      exitParams.set("tab", tab);
    }
    if (rawV) exitParams.set("v", rawV);
    const exitQs = exitParams.toString();
    compareData = {
      versionNumber: compareVersion.versionNumber,
      previewPath:
        compareVersion.storagePathPreview ??
        compareVersion.storagePathOriginal ??
        "",
      width: compareVersion.width || 1000,
      height: compareVersion.height || 1250,
      annotations: filtered.map((a) => ({
        id: a.id,
        shape: a.shape,
        geom: a.geom,
        color: a.color,
      })),
      exitHref: `${baseHref}/${currentImage.id}${exitQs ? "?" + exitQs : ""}`,
    };
  }

  const backHref = fromOverview
    ? `/projects/${project.slug}?tab=${tab}`
    : `/projects/${project.slug}/galleries/${gallery.id}`;
  const backLabel = fromOverview ? TAB_LABELS[tab] : gallery.name;

  return (
    <Reviewer
      image={imageInfo}
      initialComments={initialComments}
      siblings={siblings}
      versions={versions}
      isHistory={isHistory}
      compare={compareData}
      prevHref={prev ? `${baseHref}/${prev.id}${querySuffix}` : null}
      nextHref={next ? `${baseHref}/${next.id}${querySuffix}` : null}
      galleryHref={backHref}
      galleryName={backLabel}
      position={{ index: idx, total: sorted.length }}
      role={role}
      userId={user.id}
    />
  );
}
