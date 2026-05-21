import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(["campaign", "look", "product_set", "batch", "custom"]).default("custom"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const me = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!me || me.role === "client_reviewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const last = await prisma.gallery.findFirst({
    where: { projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const gallery = await prisma.gallery.create({
    data: {
      projectId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      position: (last?.position ?? -1) + 1,
    },
  });

  return NextResponse.json({ id: gallery.id, name: gallery.name });
}
