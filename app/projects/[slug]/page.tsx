import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { SubmitRoundButton } from "./submit-round-button";
import { NotifyClientButton } from "./notify-client-button";
import { SettingsDrawer } from "./settings-drawer";
import { ImageGridWithBulk, type GridImg } from "./image-grid-with-bulk";

type TabKey = "pending" | "approved" | "revision";

function statusToTab(status: string): TabKey | null {
  if (status === "pending") return "pending";
  if (status === "approved" || status === "approved_with_notes" || status === "final")
    return "approved";
  if (status === "revision_requested") return "revision";
  return null;
}

export default async function ProjectOverview({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: TabKey =
    rawTab === "approved" || rawTab === "revision" ? rawTab : "pending";

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await prisma.organizationMember.findFirst({ where: { userId: user.id } });
  if (!membership) redirect("/");

  const project = await prisma.project.findFirst({
    where: { orgId: membership.orgId, slug },
    include: {
      client: true,
      members: { include: { user: true } },
      rounds: { orderBy: { number: "asc" } },
    },
  });
  if (!project) notFound();

  const projectMember = project.members.find((m) => m.userId === user.id);
  const role = projectMember?.role ?? "client_reviewer";
  const isClient = role === "client_reviewer";
  const isOrgOwner = membership.role === "owner";
  const isOrgAdminRole = membership.role === "owner" || membership.role === "admin";

  // All images in the project, sorted for stable display. Excludes killed
  // images and orphans (no currentVersion — e.g. an upload that crashed in
  // Sharp after the Image row was created) so the overview never offers a
  // link that 404s.
  const images = await prisma.image.findMany({
    where: {
      gallery: { projectId: project.id },
      killed: false,
      currentVersionId: { not: null },
    },
    include: {
      currentVersion: {
        select: {
          storagePathThumb: true,
          versionNumber: true,
          width: true,
          height: true,
        },
      },
      gallery: { select: { id: true, name: true } },
    },
    orderBy: [{ gallery: { position: "asc" } }, { position: "asc" }],
  });

  const counts = { pending: 0, approved: 0, revision: 0 };
  for (const img of images) {
    const t = statusToTab(img.status);
    if (t) counts[t]++;
  }

  const visible = images.filter((i) => statusToTab(i.status) === tab);
  const currentRound =
    project.rounds.find((r) => r.status === "open") ??
    project.rounds.find((r) => r.status === "draft") ??
    project.rounds.at(-1);
  const canSubmit =
    counts.pending === 0 &&
    counts.approved + counts.revision > 0 &&
    currentRound?.status !== "closed";

  // Show the "Open round" / "Notify client" CTA when the current round is in
  // draft AND there are images that the client should review. Round 1 = any
  // image; Round 2+ = only the freshly-revised ones.
  const draftReady =
    !isClient && currentRound?.status === "draft"
      ? currentRound.number === 1
        ? counts.pending + counts.approved + counts.revision
        : await prisma.image.count({
            where: {
              gallery: { projectId: project.id },
              currentVersion: { versionNumber: { gt: 1 } },
              status: "pending",
              killed: false,
            },
          })
      : 0;
  const isFirstRound = currentRound?.number === 1;

  const baseQS = (t: TabKey) => `/projects/${project.slug}?tab=${t}`;

  return (
    <main className="mx-auto max-w-7xl px-6 pt-10 pb-16 animate-rise">
        {/* ── Project hero (no card wrap; bare editorial block) ──────── */}
        <section className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {project.client?.name ?? "Internal"}
            </p>
            <h1 className="text-[34px] md:text-[44px] font-display font-medium tracking-tight leading-[1.05]">
              {project.name}
            </h1>
            <p className="text-sm text-muted mt-3 flex items-center flex-wrap gap-x-2">
              <RoundIndicator round={currentRound} />
              <span className="text-muted-soft">·</span>
              <span>Updated {formatDate(project.updatedAt)}</span>
            </p>
          </div>
          {!isClient ? (
            <div className="flex items-center gap-2 flex-wrap">
              <SettingsDrawer
                project={{
                  id: project.id,
                  slug: project.slug,
                  name: project.name,
                  briefUrl: project.briefUrl,
                  watermarkPreview: project.watermarkPreview,
                  status: project.status,
                }}
                members={project.members.map((m) => ({
                  id: m.id,
                  role: m.role,
                  user: { id: m.user.id, name: m.user.name, email: m.user.email },
                }))}
                canArchive={isOrgAdminRole}
                canDelete={isOrgOwner}
              />
              <Button asChild>
                <Link href={`/projects/${project.slug}/upload`}>Upload images</Link>
              </Button>
              {draftReady > 0 && currentRound ? (
                <NotifyClientButton
                  projectId={project.id}
                  roundNumber={currentRound.number}
                  isFirstRound={isFirstRound}
                />
              ) : null}
            </div>
          ) : null}
        </section>

        {/* ── Status tabs (square, underline-on-active) ──────────────── */}
        <div className="border-b hairline mb-8 flex items-center">
          <TabPill href={baseQS("pending")} active={tab === "pending"} count={counts.pending}>
            Still to review
          </TabPill>
          <TabPill href={baseQS("approved")} active={tab === "approved"} count={counts.approved}>
            Approved
          </TabPill>
          <TabPill href={baseQS("revision")} active={tab === "revision"} count={counts.revision}>
            Needs revision
          </TabPill>
        </div>

        {/* ── Submit round CTA when nothing pending ───────────────────── */}
        {tab === "pending" && canSubmit ? (
          <div className="glass mb-8 p-5 md:p-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-medium">
                All caught up for Round {currentRound?.number ?? 1}.
              </p>
              <p className="text-xs text-muted mt-1">
                Submit your feedback so the post-production team gets one consolidated digest.
              </p>
            </div>
            <SubmitRoundButton
              projectId={project.id}
              roundNumber={currentRound?.number ?? 1}
              counts={{ approved: counts.approved, revision: counts.revision }}
            />
          </div>
        ) : null}

        {visible.length === 0 ? (
          <div className="surface p-16 text-center">
            <div className="mx-auto mb-4 h-10 w-10 bg-bg grid place-items-center">
              <span className="h-2 w-2 rounded-full bg-muted-soft" />
            </div>
            <p className="text-sm text-muted">
              {tab === "pending"
                ? counts.approved + counts.revision === 0
                  ? "No images uploaded yet."
                  : "Nothing left to review — everything is decided."
                : tab === "approved"
                  ? "No approved images yet."
                  : "No revisions requested."}
            </p>
          </div>
        ) : (
          <ImageGridWithBulk
            images={visible.map(
              (img): GridImg => ({
                id: img.id,
                slotName: img.slotName,
                displayName: img.displayName,
                status: img.status,
                galleryId: img.gallery.id,
                galleryName: img.gallery.name,
                thumbPath: img.currentVersion?.storagePathThumb ?? null,
                versionNumber: img.currentVersion?.versionNumber ?? 1,
                width: img.currentVersion?.width ?? 0,
                height: img.currentVersion?.height ?? 0,
              })
            )}
            projectId={project.id}
            projectSlug={project.slug}
            fromTab={tab}
            canActOnStatus={role !== "post_production"}
          />
        )}
    </main>
  );
}

function RoundIndicator({
  round,
}: {
  round: { number: number; status: string; openedAt: Date | null; closedAt: Date | null } | undefined;
}) {
  if (!round) return <span>Round 1 · draft</span>;
  const tone =
    round.status === "open"
      ? "bg-status-approved/15 text-status-approved"
      : round.status === "closed"
        ? "bg-status-v2/15 text-status-v2"
        : "bg-line/40 text-muted";
  const detail =
    round.status === "closed" && round.closedAt
      ? `closed ${formatDate(round.closedAt)}`
      : round.status === "open" && round.openedAt
        ? `open since ${formatDate(round.openedAt)}`
        : "not yet released";
  return (
    <span className="inline-flex items-center gap-2">
      <span>Round {round.number}</span>
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium ${tone}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {round.status} · {detail}
      </span>
    </span>
  );
}

function TabPill({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center gap-2 h-11 px-5 text-sm font-medium transition-colors border-b-2 -mb-px " +
        (active
          ? "border-ink text-ink"
          : "border-transparent text-muted hover:text-ink")
      }
    >
      <span>{children}</span>
      <span
        className={
          "h-5 min-w-5 px-1.5 text-[10px] inline-flex items-center justify-center font-semibold tabular-nums " +
          (active ? "bg-ink text-bg" : "bg-line/70 text-muted")
        }
      >
        {count}
      </span>
    </Link>
  );
}

