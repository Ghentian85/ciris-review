import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: "sam@chapter103.com" },
    update: {},
    create: { email: "sam@chapter103.com", name: "Sam" },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "chapter103" },
    update: {},
    create: { name: "Chapter 103", slug: "chapter103" },
  });

  await prisma.organizationMember.upsert({
    where: { orgId_userId: { orgId: org.id, userId: owner.id } },
    update: { role: "owner" },
    create: { orgId: org.id, userId: owner.id, role: "owner" },
  });

  const client = await prisma.client.upsert({
    where: { id: "seed-client" },
    update: {},
    create: { id: "seed-client", orgId: org.id, name: "House of Example" },
  });

  const project = await prisma.project.upsert({
    where: { orgId_slug: { orgId: org.id, slug: "aw26-lookbook" } },
    update: {},
    create: {
      orgId: org.id,
      clientId: client.id,
      name: "AW26 Lookbook",
      slug: "aw26-lookbook",
      createdById: owner.id,
      members: {
        create: { userId: owner.id, role: "admin", canApprove: true },
      },
      rounds: { create: { number: 1, status: "draft" } },
      galleries: {
        create: [
          { name: "Hero shots", kind: "campaign", position: 0 },
          { name: "Look 01", kind: "look", position: 1 },
          { name: "Look 02", kind: "look", position: 2 },
        ],
      },
    },
  });

  console.log("Seeded:", { org: org.slug, project: project.slug });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
