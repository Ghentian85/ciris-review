// Add two demo users (client + post-prod) to the most-recently-updated
// project in the database, so you can sign in as each one to see the
// role-specific UI. Magic-link emails dump to the dev server console when
// RESEND_API_KEY is unset, so no SMTP setup is needed.
//
// Run:   npx tsx scripts/seed-demo-roles.ts
// Or:    npm run seed:demo-roles

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_CLIENT = {
  email: "client@demo.test",
  name: "Demo Client",
};
const DEMO_POSTPROD = {
  email: "postprod@demo.test",
  name: "Demo Post-prod",
};

async function main() {
  const projects = await prisma.project.findMany({
    where: { status: { not: "archived" } },
    include: { organization: true },
  });
  if (projects.length === 0) {
    console.error(
      "No active projects found. Create one first via the app before seeding demo roles."
    );
    process.exit(1);
  }

  const clientUser = await prisma.user.upsert({
    where: { email: DEMO_CLIENT.email },
    update: { name: DEMO_CLIENT.name },
    create: DEMO_CLIENT,
  });
  const postprodUser = await prisma.user.upsert({
    where: { email: DEMO_POSTPROD.email },
    update: { name: DEMO_POSTPROD.name },
    create: DEMO_POSTPROD,
  });

  // Add as org members (basic internal role) on each org we touch.
  const orgIds = [...new Set(projects.map((p) => p.orgId))];
  for (const orgId of orgIds) {
    await prisma.organizationMember.upsert({
      where: { orgId_userId: { orgId, userId: clientUser.id } },
      update: { role: "internal" },
      create: { orgId, userId: clientUser.id, role: "internal" },
    });
    await prisma.organizationMember.upsert({
      where: { orgId_userId: { orgId, userId: postprodUser.id } },
      update: { role: "internal" },
      create: { orgId, userId: postprodUser.id, role: "internal" },
    });
  }

  // Add as project members on every active project so whichever project
  // you open, the demo accounts can be tested against it.
  for (const project of projects) {
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId: project.id, userId: clientUser.id },
      },
      update: { role: "client_reviewer", canApprove: true },
      create: {
        projectId: project.id,
        userId: clientUser.id,
        role: "client_reviewer",
        canApprove: true,
      },
    });
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId: project.id, userId: postprodUser.id },
      },
      update: { role: "post_production", canApprove: false },
      create: {
        projectId: project.id,
        userId: postprodUser.id,
        role: "post_production",
        canApprove: false,
      },
    });
  }

  console.log("");
  console.log(`✓ Demo users added to ${projects.length} active project${projects.length === 1 ? "" : "s"}:`);
  for (const p of projects) console.log("   -", p.name);
  console.log("");
  console.log("  • Client view     →", DEMO_CLIENT.email);
  console.log("  • Post-prod view  →", DEMO_POSTPROD.email);
  console.log("");
  console.log("To preview each role:");
  console.log("  1. Sign out (top-right)");
  console.log("  2. Sign in with one of the emails above");
  console.log("  3. Magic link prints in this dev-server terminal");
  console.log("  4. Click the link in the terminal to authenticate");
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
