import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Annotation geom shapes (normalized 0–1 coords):
//   pin   { x, y }
//   rect  { x, y, w, h }
//   arrow { x1, y1, x2, y2 }
const annotationSchema = z.object({
  shape: z.enum(["pin", "rect", "arrow", "freehand"]),
  geom: z.record(z.unknown()),
  color: z.string().optional(),
});

const createSchema = z.object({
  body: z.string().min(1).max(2000),
  visibility: z.enum(["client", "internal"]).default("client"),
  annotations: z.array(annotationSchema).default([]),
  // Replies inherit the parent's visibility, never carry annotations of their
  // own, and are flat (no reply-to-a-reply chains).
  parentId: z.string().min(1).optional(),
});

async function loadImage(imageId: string) {
  return prisma.image.findUnique({
    where: { id: imageId },
    include: {
      gallery: { include: { project: true } },
      currentVersion: true,
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: imageId } = await params;
  const image = await loadImage(imageId);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const me = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: image.gallery.projectId, userId: user.id } },
  });
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Clients never see internal comments.
  const where = {
    imageId,
    ...(me.role === "client_reviewer" ? { visibility: "client" as const } : {}),
  };

  const comments = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, email: true, name: true } },
      annotations: true,
    },
  });
  return NextResponse.json({ comments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: imageId } = await params;
  const image = await loadImage(imageId);
  if (!image || !image.currentVersion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const me = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: image.gallery.projectId, userId: user.id } },
  });
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Clients can't author internal comments.
  // Replies inherit their parent's visibility (no mixed-visibility threads).
  let visibility = me.role === "client_reviewer" ? "client" : parsed.data.visibility;
  let parentId: string | null = null;
  if (parsed.data.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parsed.data.parentId },
      select: { imageId: true, visibility: true, parentId: true },
    });
    if (!parent || parent.imageId !== imageId) {
      return NextResponse.json({ error: "Invalid parent" }, { status: 400 });
    }
    // Disallow replies to replies — keep threads one level deep.
    if (parent.parentId) {
      return NextResponse.json({ error: "Cannot reply to a reply" }, { status: 400 });
    }
    parentId = parsed.data.parentId;
    visibility = parent.visibility as typeof visibility;
  }

  const comment = await prisma.comment.create({
    data: {
      imageId,
      versionId: image.currentVersion.id,
      authorId: user.id,
      body: parsed.data.body,
      visibility,
      parentId,
      // Replies never have their own annotations — annotations belong to the
      // parent comment and are shown for the whole thread.
      annotations: parentId
        ? undefined
        : {
            create: parsed.data.annotations.map((a) => ({
              imageId,
              versionId: image.currentVersion!.id,
              shape: a.shape,
              geom: JSON.stringify(a.geom),
              color: a.color ?? "#111111",
            })),
          },
    },
    include: {
      author: { select: { id: true, email: true, name: true } },
      annotations: true,
    },
  });

  return NextResponse.json({ comment });
}
