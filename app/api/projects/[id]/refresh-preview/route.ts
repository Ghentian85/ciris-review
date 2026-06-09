import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseSlot } from "@/lib/parse-slot";
import { getStorage } from "@/lib/storage/index";

// Refresh the preview + thumb for an image's CURRENT version, in-place,
// from a freshly-provided source file. Use case: the original upload
// burned in a "PREVIEW" watermark and you've since turned that setting
// off — re-deriving from the master removes the watermark without
// creating a new version (no status reset, no rounds reset, no comments
// lost, no audit-of-decisions cluttered).
//
// One file per request, matched by parsed slot. Older versions in
// history are untouched — only the CURRENT version's preview/thumb get
// replaced. Older versions in the history switcher will keep whatever
// watermark state they had.
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
  if (!me || (me.role !== "admin" && me.role !== "internal_reviewer")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Match the existing image by slot — same parser as upload.
  const parsed = parseSlot(file.name);
  const image = await prisma.image.findFirst({
    where: { gallery: { projectId }, slotName: parsed.slotName, killed: false },
    include: { currentVersion: true },
  });
  if (!image) {
    return NextResponse.json(
      {
        error: `No image matched the slot "${parsed.slotName}". Filename must match an existing image.`,
        slotName: parsed.slotName,
      },
      { status: 404 }
    );
  }
  if (!image.currentVersion) {
    return NextResponse.json(
      { error: `Image "${parsed.slotName}" has no current version to refresh.` },
      { status: 404 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();

  // Fresh hex suffix → new keys, so browser caches don't keep serving the
  // old bytes (the storage endpoint sets immutable cache headers). Old
  // keys are deleted at the end, best-effort.
  const id = randomBytes(4).toString("hex");
  const base = `${image.id}_v${image.currentVersion.versionNumber}_${id}`;
  const previewKey = path.posix.join("projects", projectId, "preview", `${base}.webp`);
  const thumbKey = path.posix.join("projects", projectId, "thumb", `${base}.webp`);

  // Derive preview + thumb. NO watermark — refreshing is an explicit
  // "remove the burned-in PREVIEW" action.
  const meta = await sharp(buffer, { failOn: "none" })
    .metadata()
    .catch(() => ({}) as sharp.Metadata);

  const resized = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 2000, withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });

  const previewBuffer = await sharp(resized.data, { failOn: "none" })
    .webp({ quality: 80 })
    .toBuffer();
  await storage.putObject(previewKey, previewBuffer, { contentType: "image/webp" });

  const thumbBuffer = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();
  await storage.putObject(thumbKey, thumbBuffer, { contentType: "image/webp" });

  // Stash the old keys so we can clean them up after the DB pointer flip.
  const oldPreviewKey = image.currentVersion.storagePathPreview;
  const oldThumbKey = image.currentVersion.storagePathThumb;

  await prisma.imageVersion.update({
    where: { id: image.currentVersion.id },
    data: {
      storagePathPreview: previewKey,
      storagePathThumb: thumbKey,
      // Refresh dimensions in case the new master has a different ratio,
      // though normally it shouldn't.
      width: resized.info.width,
      height: resized.info.height,
      mime: meta.format ? `image/${meta.format}` : image.currentVersion.mime,
      sizeBytes: buffer.length,
    },
  });

  // Best-effort cleanup of orphaned storage. Don't fail the request if
  // the delete fails — the new preview is already live.
  for (const key of [oldPreviewKey, oldThumbKey]) {
    if (!key || key === previewKey || key === thumbKey) continue;
    try {
      await storage.deleteObject(key);
    } catch (err) {
      console.warn("refresh-preview: failed to delete old key", key, err);
    }
  }

  // Audit log so admins can trace who refreshed what.
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project) {
    await prisma.auditLog.create({
      data: {
        orgId: project.orgId,
        projectId,
        actorId: user.id,
        action: "image.preview_refreshed",
        targetType: "image",
        targetId: image.id,
        payload: JSON.stringify({
          slotName: image.slotName,
          versionNumber: image.currentVersion.versionNumber,
        }),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    slot: image.slotName,
    versionNumber: image.currentVersion.versionNumber,
  });
}
