import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const updateSchema = z.object({
  body: z.string().min(1).max(2000).optional(),
  visibility: z.enum(["client", "internal"]).optional(),
});

async function loadAuth(commentId: string, userId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { image: { include: { gallery: true } } },
  });
  if (!comment) return null;
  const me = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId: comment.image.gallery.projectId, userId },
    },
  });
  if (!me) return null;
  return { comment, role: me.role };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ctx = await loadAuth(id, user.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { comment, role } = ctx;

  // Only the author or an admin can edit; clients can never edit internal comments.
  if (comment.authorId !== user.id && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Clients can never bump to internal.
  const data: Record<string, string> = {};
  if (parsed.data.body !== undefined) data.body = parsed.data.body;
  if (parsed.data.visibility !== undefined && role !== "client_reviewer") {
    data.visibility = parsed.data.visibility;
  }

  const updated = await prisma.comment.update({
    where: { id },
    data,
    include: {
      author: { select: { id: true, email: true, name: true } },
      annotations: true,
    },
  });
  return NextResponse.json({ comment: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ctx = await loadAuth(id, user.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { comment, role } = ctx;
  if (comment.authorId !== user.id && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Cascading: comment delete also drops annotations (FK onDelete).
  await prisma.comment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
