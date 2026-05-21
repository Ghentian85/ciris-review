import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  briefUrl: z.string().url().or(z.literal("")).nullable().optional(),
  watermarkPreview: z.boolean().optional(),
  status: z.enum(["active", "archived"]).optional(),
});

// PATCH project settings. General edits need project admin/internal; the
// status field (archive/unarchive) additionally needs org-level admin or
// owner. We also write a tailored audit-log entry per kind of change.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, orgId: true, status: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Two permission tiers:
  //   - status change → org admin/owner
  //   - everything else → project admin/internal
  const isStatusChange = parsed.data.status !== undefined;

  if (isStatusChange) {
    const orgMember = await prisma.organizationMember.findUnique({
      where: { orgId_userId: { orgId: project.orgId, userId: user.id } },
    });
    if (!orgMember || (orgMember.role !== "owner" && orgMember.role !== "admin")) {
      return NextResponse.json({ error: "Org admin only" }, { status: 403 });
    }
  } else {
    const me = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!me || (me.role !== "admin" && me.role !== "internal_reviewer")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Coerce empty string brief URL to null so we don't store ""
  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.briefUrl !== undefined) {
    data.briefUrl = parsed.data.briefUrl ? parsed.data.briefUrl : null;
  }
  if (parsed.data.watermarkPreview !== undefined) {
    data.watermarkPreview = parsed.data.watermarkPreview;
  }
  if (parsed.data.status !== undefined) {
    data.status = parsed.data.status;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data,
    select: {
      id: true,
      name: true,
      slug: true,
      briefUrl: true,
      watermarkPreview: true,
      status: true,
      orgId: true,
    },
  });

  const action = isStatusChange
    ? parsed.data.status === "archived"
      ? "project.archived"
      : "project.unarchived"
    : "project.updated";

  await prisma.auditLog.create({
    data: {
      orgId: updated.orgId,
      projectId,
      actorId: user.id,
      action,
      targetType: "project",
      targetId: projectId,
      payload: JSON.stringify(data),
    },
  });

  return NextResponse.json({ project: updated });
}

// DELETE the project entirely. Owner-only — this is destructive and cascades
// to all child rows (galleries → images → versions → comments → annotations →
// round states → audit) plus the on-disk preview/thumb files.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, orgId: true, name: true, slug: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgMember = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId: project.orgId, userId: user.id } },
  });
  if (!orgMember || orgMember.role !== "owner") {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  // Write an audit-log entry BEFORE deleting — once the project is gone the
  // FK cascade nukes its audit rows too, so this one needs to live on the
  // organization with project=null after.
  await prisma.auditLog.create({
    data: {
      orgId: project.orgId,
      projectId: null,
      actorId: user.id,
      action: "project.deleted",
      targetType: "project",
      targetId: projectId,
      payload: JSON.stringify({ name: project.name, slug: project.slug }),
    },
  });

  await prisma.project.delete({ where: { id: projectId } });

  // Storage cleanup: remove the project's preview + thumb objects via the
  // adapter (local FS or S3/R2 — same call). Best-effort, doesn't fail the
  // request.
  try {
    const { getStorage } = await import("@/lib/storage/index");
    await getStorage().deletePrefix(`projects/${projectId}`);
  } catch (err) {
    console.warn("Failed to clean storage on project delete:", err);
  }

  return NextResponse.json({ ok: true });
}
