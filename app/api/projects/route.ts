import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1).max(120),
  clientName: z.string().min(1).max(120).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
  });
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 400 });

  let client = null;
  if (parsed.data.clientName) {
    client = await prisma.client.create({
      data: {
        orgId: membership.orgId,
        name: parsed.data.clientName,
      },
    });
  }

  let slug = slugify(parsed.data.name) || "project";
  // ensure unique within org
  const existing = await prisma.project.findMany({
    where: { orgId: membership.orgId, slug: { startsWith: slug } },
    select: { slug: true },
  });
  if (existing.find((p) => p.slug === slug)) {
    let n = 2;
    while (existing.find((p) => p.slug === `${slug}-${n}`)) n++;
    slug = `${slug}-${n}`;
  }

  const project = await prisma.project.create({
    data: {
      orgId: membership.orgId,
      clientId: client?.id,
      name: parsed.data.name,
      slug,
      createdById: user.id,
      members: {
        create: { userId: user.id, role: "admin", canApprove: true },
      },
      rounds: { create: { number: 1, status: "draft" } },
      // Galleries are an internal grouping concept that the UI no longer
      // exposes — we auto-create one "Images" bucket per project so uploads
      // have a home, and the user never needs to think about it.
      galleries: {
        create: { name: "Images", kind: "custom", position: 0 },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      orgId: membership.orgId,
      projectId: project.id,
      actorId: user.id,
      action: "project.created",
      targetType: "project",
      targetId: project.id,
    },
  });

  return NextResponse.json({ id: project.id, slug: project.slug });
}
