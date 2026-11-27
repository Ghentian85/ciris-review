// Shared "create an Image + first ImageVersion" (v1) or "append a new
// ImageVersion to an existing slot" (v2) logic. The classic multipart POST
// route and the direct-to-R2 finalize route both call in here so the two
// upload paths stay bit-for-bit identical in what they write to the DB.

import { prisma } from "@/lib/prisma";
import { storeImageVersion } from "@/lib/storage";
import { parseSlot } from "@/lib/parse-slot";

export type UploadResult =
  | {
      ok: true;
      status: 200;
      body: {
        id: string;
        slot: string;
        matched: boolean;
        skipped?: boolean;
        reason?: string;
        versionNumber?: number;
        thumbUrl?: string;
      };
    }
  | { ok: false; status: number; body: { error: string } };

export async function ingestUpload(opts: {
  projectId: string;
  userId: string;
  buffer: Buffer;
  filename: string;
  slotName?: string | null;
  mode: "v1" | "v2";
  galleryId?: string | null;
}): Promise<UploadResult> {
  const { projectId, userId, buffer, filename, slotName, mode } = opts;

  let gallery = null;
  if (opts.galleryId) {
    gallery = await prisma.gallery.findFirst({
      where: { id: opts.galleryId, projectId },
    });
  }
  if (!gallery) {
    gallery = await prisma.gallery.findFirst({
      where: { projectId },
      orderBy: { position: "asc" },
    });
  }
  if (!gallery) {
    gallery = await prisma.gallery.create({
      data: { projectId, name: "Images", kind: "custom", position: 0 },
    });
  }
  const galleryId = gallery.id;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      orgId: true,
      organization: { select: { studioMode: true } },
    },
  });
  if (!project) return { ok: false, status: 404, body: { error: "Not found" } };
  const studioMode = project.organization.studioMode;

  const parsed = parseSlot(
    slotName && slotName.trim() ? `${slotName.trim()}.x` : filename
  );

  const existing = await prisma.image.findFirst({
    where: { galleryId, slotName: parsed.slotName, killed: false },
    include: { currentVersion: true },
  });

  if (mode === "v1" && existing) {
    return {
      ok: true,
      status: 200,
      body: {
        id: existing.id,
        slot: existing.slotName,
        matched: false,
        skipped: true,
        reason: "Slot already exists — switch to Revisions mode to add as a new version.",
      },
    };
  }

  if (mode === "v2" && existing) {
    const nextVersionNumber = (existing.currentVersion?.versionNumber ?? 0) + 1;
    const stored = await storeImageVersion({
      projectId,
      imageId: existing.id,
      versionNumber: nextVersionNumber,
      buffer,
    });
    const newVersion = await prisma.imageVersion.create({
      data: {
        imageId: existing.id,
        versionNumber: nextVersionNumber,
        storagePathOriginal: stored.storagePathOriginal,
        storagePathPreview: stored.storagePathPreview,
        storagePathThumb: stored.storagePathThumb,
        width: stored.width,
        height: stored.height,
        mime: stored.mime,
        sizeBytes: stored.sizeBytes,
        uploadedById: userId,
        releasedAt: studioMode ? null : new Date(),
      },
    });
    await prisma.image.update({
      where: { id: existing.id },
      data: {
        currentVersionId: newVersion.id,
        status: "pending",
        filenameOriginal: filename,
      },
    });
    await prisma.auditLog.create({
      data: {
        orgId: project.orgId,
        projectId,
        actorId: userId,
        action: "image.version_added",
        targetType: "image",
        targetId: existing.id,
        payload: JSON.stringify({ versionNumber: nextVersionNumber }),
      },
    });
    return {
      ok: true,
      status: 200,
      body: {
        id: existing.id,
        slot: existing.slotName,
        matched: true,
        versionNumber: nextVersionNumber,
        thumbUrl: `/api/storage/${stored.storagePathThumb}`,
      },
    };
  }

  // v1 path (also v2 fallback when slot doesn't match)
  const last = await prisma.image.findFirst({
    where: { galleryId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const image = await prisma.image.create({
    data: {
      galleryId,
      slotName: parsed.slotName,
      subjectKey: parsed.subjectKey,
      viewLabel: parsed.viewLabel,
      filenameOriginal: filename,
      position: (last?.position ?? -1) + 1,
    },
  });

  let stored;
  try {
    stored = await storeImageVersion({
      projectId,
      imageId: image.id,
      versionNumber: 1,
      buffer,
    });
  } catch (err) {
    await prisma.image.delete({ where: { id: image.id } }).catch(() => {});
    throw err;
  }

  const version = await prisma.imageVersion.create({
    data: {
      imageId: image.id,
      versionNumber: 1,
      storagePathOriginal: stored.storagePathOriginal,
      storagePathPreview: stored.storagePathPreview,
      storagePathThumb: stored.storagePathThumb,
      width: stored.width,
      height: stored.height,
      mime: stored.mime,
      sizeBytes: stored.sizeBytes,
      uploadedById: userId,
      releasedAt: new Date(),
    },
  });

  await prisma.image.update({
    where: { id: image.id },
    data: { currentVersionId: version.id },
  });

  return {
    ok: true,
    status: 200,
    body: {
      id: image.id,
      slot: image.slotName,
      matched: false,
      versionNumber: 1,
      thumbUrl: `/api/storage/${stored.storagePathThumb}`,
    },
  };
}
