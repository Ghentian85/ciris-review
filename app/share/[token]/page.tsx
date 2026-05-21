import Link from "next/link";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { StatusChip, type ImageStatus } from "@/components/ui/status-chip";
import { Logo } from "@/components/app/logo";
import { PasswordGate } from "./password-gate";

// Public, unauthenticated review page. Reachable by anyone with the token
// (and the password if set). Read-only: gallery grid with thumbs, no
// annotations or decisions. Token never appears in the DB unhashed — we
// match by sha256 hash.
//
// Password gate: when set, the user submits the password via PasswordGate
// (client form), which posts to /api/share-verify. On success we set a
// scoped cookie `share_<linkId>=1` valid for the same domain, then this
// page reads the cookie and renders content. Cookies are HttpOnly so the
// client can't tamper.

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

function hashPassword(password: string) {
  return createHash("sha256")
    .update(`${env.AUTH_SECRET}:share:${password}`)
    .digest("hex");
}

export default async function PublicSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ pw?: string }>;
}) {
  const { token } = await params;
  const { pw } = await searchParams;
  const tokenHash = sha256(token);

  const link = await prisma.shareLink.findUnique({
    where: { tokenHash },
    include: {
      project: {
        include: {
          client: { select: { name: true } },
        },
      },
    },
  });

  if (!link) {
    return <BlockedScreen title="Link unavailable" body="This share link doesn't exist or has been revoked." />;
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    return (
      <BlockedScreen
        title="Link expired"
        body={`This share link expired on ${link.expiresAt.toLocaleDateString()}. Ask whoever sent you the link for a fresh one.`}
      />
    );
  }

  // Password gate
  if (link.passwordHash) {
    const jar = await cookies();
    const cookieKey = `share_${link.id}`;
    const cookieValue = jar.get(cookieKey)?.value;
    const sessionOk = cookieValue === "1";
    const passwordOk = pw && hashPassword(pw) === link.passwordHash;

    if (!sessionOk && !passwordOk) {
      return (
        <main className="min-h-screen grid place-items-center p-6 animate-rise">
          <div className="w-full max-w-sm">
            <div className="mb-10 text-center text-ink">
              <Logo className="h-7 w-auto mx-auto" />
              <p className="text-[10px] text-muted tracking-[0.28em] uppercase mt-3 font-medium">
                Review
              </p>
            </div>
            <div className="mb-6 text-center">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted mb-3 flex items-center justify-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Password protected
              </p>
              <h1 className="font-display text-[26px] leading-tight tracking-tight">
                {link.project.name}
              </h1>
              <p className="text-sm text-muted mt-2">
                Enter the password you were given to continue.
              </p>
            </div>
            <PasswordGate token={token} />
          </div>
        </main>
      );
    }
    // Note: setting the cookie when password matches is done by the form-submit
    // route. For the server-side password check via ?pw= we just permit access
    // for this request — the client form path is the persistent one.
  }

  // Load gallery + images
  const images = await prisma.image.findMany({
    where: { gallery: { projectId: link.projectId }, killed: false },
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

  return (
    <>
      <header className="sticky top-0 z-30 bg-ink text-bg">
        <div className="mx-auto max-w-7xl px-5 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-bg">
            <Logo />
            <span className="hidden sm:inline text-[10px] tracking-[0.28em] uppercase font-medium opacity-60 border-l border-bg/20 pl-3 ml-1">
              Review · Shared
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-bg/50 hidden sm:inline">
              Read-only preview
            </span>
            {link.expiresAt ? (
              <span className="text-bg/70 tabular-nums">
                expires {link.expiresAt.toLocaleDateString()}
              </span>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 pt-10 pb-16 animate-rise">
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {link.project.client?.name ?? "Project preview"}
          </p>
          <h1 className="font-display text-[40px] md:text-[44px] font-medium tracking-tight leading-[1.05]">
            {link.project.name}
          </h1>
          <p className="text-sm text-muted mt-3">
            {images.length} image{images.length === 1 ? "" : "s"} · read-only
          </p>
        </div>

        {images.length === 0 ? (
          <div className="surface p-12 text-center text-sm text-muted">
            No images uploaded yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.map((img) => {
              const thumb = img.currentVersion?.storagePathThumb;
              return (
                <div key={img.id} className="surface p-0 overflow-hidden">
                  <div className="aspect-[3/4] bg-line/40 relative overflow-hidden">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        // The share token doubles as proof of access for assets
                        // — the storage endpoint now accepts it as a fallback
                        // when the user has no session cookie.
                        src={`/api/storage/${thumb}?share=${token}`}
                        alt={img.displayName ?? img.slotName}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs truncate flex-1 min-w-0">
                        {img.displayName ?? img.slotName}
                      </p>
                      <StatusChip status={img.status as ImageStatus} size="sm" />
                    </div>
                    <p className="text-[10px] text-muted mt-1 truncate">
                      {img.gallery.name}
                      {img.currentVersion && img.currentVersion.versionNumber > 1
                        ? ` · V${img.currentVersion.versionNumber}`
                        : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-muted-soft text-center mt-12">
          For full review with comments and approval, ask to be invited as a reviewer.
        </p>
      </main>
    </>
  );
}

function BlockedScreen({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen grid place-items-center p-6 animate-rise">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 text-ink">
          <Logo className="h-7 w-auto mx-auto" />
          <p className="text-[10px] text-muted tracking-[0.28em] uppercase mt-3 font-medium">
            Review
          </p>
        </div>
        <div className="surface p-8">
          <div className="mx-auto mb-4 h-10 w-10 bg-status-revision-soft grid place-items-center">
            <span className="h-2 w-2 rounded-full bg-status-revision" />
          </div>
          <h1 className="font-medium text-base">{title}</h1>
          <p className="text-sm text-muted mt-2 leading-relaxed">{body}</p>
        </div>
      </div>
    </main>
  );
}
