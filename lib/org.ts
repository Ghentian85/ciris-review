// Tenant resolution.
//
// Each request belongs to one Organization. We derive it from the request
// hostname (set by the hosting layer as the `host` header) and match
// against Organization.hostname. No middleware change needed — this
// resolution happens in Server Components / Route Handlers that call
// getCurrentOrg().
//
// Fallbacks (in order) so dev and backwards-compat keep working:
//   1. Host header matches Organization.hostname → use that org
//   2. First org the signed-in user belongs to (legacy single-tenant)
//   3. null — anonymous pages that render without org context

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export type OrgBrand = {
  id: string;
  name: string;
  slug: string;
  displayName: string | null;
  logoUrl: string | null;
  brandAccent: string | null;
  poweredByCiris: boolean;
  studioMode: boolean;
  hostname: string | null;
};

// Server-only. Returns the active org or null.
export async function getCurrentOrg(): Promise<OrgBrand | null> {
  const h = await headers();
  // Vercel surfaces the public hostname via `x-forwarded-host`; locally
  // `host` is set by the dev server. Strip any port so "localhost:3001"
  // resolves to "localhost" for matching.
  const rawHost =
    h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const hostname = rawHost.split(":")[0].toLowerCase();

  if (hostname) {
    const org = await prisma.organization.findUnique({
      where: { hostname },
    });
    if (org) return pickBrand(org);
  }

  // Legacy fallback: the signed-in user's first-known org. Keeps dev and
  // not-yet-hostname-mapped setups working exactly as before.
  const user = await getCurrentUser();
  if (user) {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
    if (membership) return pickBrand(membership.organization);
  }

  return null;
}

function pickBrand(org: {
  id: string;
  name: string;
  slug: string;
  displayName: string | null;
  logoUrl: string | null;
  brandAccent: string | null;
  poweredByCiris: boolean;
  studioMode: boolean;
  hostname: string | null;
}): OrgBrand {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    displayName: org.displayName,
    logoUrl: org.logoUrl,
    brandAccent: org.brandAccent,
    poweredByCiris: org.poweredByCiris,
    studioMode: org.studioMode,
    hostname: org.hostname,
  };
}
