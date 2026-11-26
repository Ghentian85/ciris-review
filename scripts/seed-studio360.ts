// Seeds the multi-tenant setup:
//   1. Assigns review.ciris.studio to chapter103 (so legacy stays explicit)
//   2. Creates Studio 360 organization with its own hostname, branding,
//      studioMode enabled, and Sam as an owner
//
// Run against prod:
//   DATABASE_URL='postgres://…' npm run seed:studio360
//
// Idempotent — safe to re-run; upserts only.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Lock Sam's primary org to review.ciris.studio. The slug varies
  //    between dev (chapter103 from the seed) and prod (an auto-generated
  //    studio-xxxx from the first sign-in). Find it via Sam's ownership
  //    so this script works in either environment.
  const sam = await prisma.user.findUnique({ where: { email: "sam@chapter103.com" } });
  if (!sam) {
    throw new Error("Sam's user (sam@chapter103.com) not found — sign in once first.");
  }
  const samOwnership = await prisma.organizationMember.findFirst({
    where: { userId: sam.id, role: "owner" },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  if (!samOwnership) {
    throw new Error("No owner-role organization found for Sam.");
  }
  const chapter = await prisma.organization.update({
    where: { id: samOwnership.orgId },
    data: {
      hostname: "review.ciris.studio",
      // leave displayName/logo/brandAccent null → defaults to CIRIS
      poweredByCiris: false,
      studioMode: false,
    },
  });
  console.log(`✓ ${chapter.name} (slug=${chapter.slug}) → hostname=${chapter.hostname}`);

  // 2. Create Studio 360 org
  const studio = await prisma.organization.upsert({
    where: { slug: "studio-360" },
    create: {
      name: "Studio 360",
      slug: "studio-360",
      hostname: "studio360.ciris.studio",
      displayName: "Studio 360",
      // logoUrl empty for now — Sam uploads the SVG into /public/orgs/
      // and we point this at `/orgs/studio-360.svg` after.
      logoUrl: null,
      brandAccent: null, // defaults to coral
      poweredByCiris: true,
      studioMode: true,
    },
    update: {
      hostname: "studio360.ciris.studio",
      displayName: "Studio 360",
      poweredByCiris: true,
      studioMode: true,
    },
  });
  console.log(`✓ ${studio.name} → hostname=${studio.hostname}  studioMode=${studio.studioMode}`);

  // 3. Add Sam as owner of Studio 360 (so he can log in on
  //    studio360.ciris.studio and set it up).
  const sam = await prisma.user.findUnique({ where: { email: "sam@chapter103.com" } });
  if (!sam) {
    console.warn("⚠ Sam's user not found — skipping ownership. Have him sign in first.");
  } else {
    await prisma.organizationMember.upsert({
      where: { orgId_userId: { orgId: studio.id, userId: sam.id } },
      create: { orgId: studio.id, userId: sam.id, role: "owner" },
      update: { role: "owner" },
    });
    console.log(`✓ Sam added as owner of ${studio.name}`);
  }

  console.log("");
  console.log("Done. Next steps:");
  console.log("  1. In Vercel: add 'studio360.ciris.studio' as a domain alias");
  console.log("  2. At your DNS: CNAME studio360.ciris.studio → cname.vercel-dns.com");
  console.log("  3. Drop Studio 360's logo into /public/orgs/studio-360.svg,");
  console.log("     then set Organization.logoUrl = '/orgs/studio-360.svg'");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
