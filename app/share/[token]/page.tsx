import Link from "next/link";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { StatusChip, type ImageStatus } from "@/components/ui/status-chip";
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
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="surface p-8 max-w-sm text-center">
          <h1 className="font-medium">Link unavailable</h1>
          <p className="text-sm text-muted mt-2">
            This share link doesn't exist or has been revoked.
          </p>
        </div>
      </main>
    );
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="surface p-8 max-w-sm text-center">
          <h1 className="font-medium">Link expired</h1>
          <p className="text-sm text-muted mt-2">
            This share link expired on {link.expiresAt.toLocaleDateString()}.
            Ask whoever sent you the link for a fresh one.
          </p>
        </div>
      </main>
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
        <main className="min-h-screen grid place-items-center p-6">
          <div className="w-full max-w-sm">
            <div className="mb-8 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="CIRIS" className="h-6 w-auto mx-auto mb-3" />
              <p className="text-xs text-muted tracking-[0.18em] uppercase">Review</p>
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
      <header className="border-b hairline bg-bg/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="CIRIS" className="h-5 w-auto" />
            <span className="text-[11px] text-muted tracking-[0.18em] uppercase">
              Review · Shared
            </span>
          </div>
          {link.expiresAt ? (
            <span className="text-[11px] text-muted">
              expires {link.expiresAt.toLocaleDateString()}
            </span>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wide text-muted mb-2">
            {link.project.client?.name ?? "Project preview"}
          </p>
          <h1 className="text-2xl font-medium tracking-tight">{link.project.name}</h1>
          <p className="text-sm text-muted mt-1">
            {images.length} image{images.length === 1 ? "" : "s"} · read-only preview
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
                    <div className="absolute top-2 right-2">
                      <StatusChip status={img.status as ImageStatus} />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-xs truncate">
                      {img.displayName ?? img.slotName}
                    </p>
                    <p className="text-[10px] text-muted mt-0.5 truncate">
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

        <p className="text-[11px] text-muted text-center mt-10">
          For full review with comments and approval, ask to be invited as a reviewer.
        </p>
      </main>
    </>
  );
}
