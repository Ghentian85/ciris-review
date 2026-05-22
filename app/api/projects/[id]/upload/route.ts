import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { storeImageVersion } from "@/lib/storage";
import { parseSlot } from "@/lib/parse-slot";

// Increase body size limit for large image uploads (fashion shoots can be 80MB+)
export const config = {
  api: {
    bodyParser: false,
    responseLimit: "200mb",
  },
};

export const maxDuration = 60;

// One file per request. Client uploads in parallel with a concurrency cap.
// Large fashion shoots (200–800 files at 30–80MB) bust the per-request body
// limit, so we never bundle multi-file uploads into one POST.
//
// Modes:
//   v1 (default)  — every file creates a new Image + first ImageVersion
//   v2            — match each file by slotName to an existing Image in the
//                   target gallery; if found, append a new ImageVersion and
//                   reset image.status to "pending" so the client re-reviews;
//                   if not found, fall back to creating a new slot.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  return await uploadHandler(req, params);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload] unhandled error:', msg, err);
    return NextResponse.json({ error: 'Internal server error', detail: msg }, { status: 500 });
  }
}

async function uploadHandler(
  req: NextRequest,
  params: Promise<{ id: string }>
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

  const form = await req.formData();
  const file = form.get("file");
  const formGalleryId = form.get("galleryId");
  const slotName = form.get("slotName");
  const mode = form.get("mode") === "v2" ? "v2" : "v1";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Galleries are hidden from the UI — every project gets one default "Images"
  // bucket auto-created on project creation. If a client explicitly provides
  // galleryId we honor it (legacy data with multiple galleries); otherwise we
  // pick the first existing one, and if somehow none exist we lazily create.
  let gallery = null;
  if (typeof formGalleryId === "string" && formGalleryId) {
    gallery = await prisma.gallery.findFirst({
      where: { id: formGalleryId, projectId },
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
    select: { watermarkPreview: true, orgId: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseSlot(
    typeof slotName === "string" && slotName.trim() ? `${slotName.trim()}.x` : file.name
  );

  // V2 mode: look for an existing Image in this gallery whose slotName matches.
  // Matching uses exact slotName equality. If the post-prod team renamed files
  // they'll need to fix it on disk before uploading.
  if (mode === "v2") {
    const existing = await prisma.image.findFirst({
      where: { galleryId, slotName: parsed.slotName, killed: false },
      include: { currentVersion: true },
    });
    if (existing) {
      const nextVersionNumber = (existing.currentVersion?.versionNumber ?? 0) + 1;
      const stored = await storeImageVersion({
        projectId,
        imageId: existing.id,
        versionNumber: nextVersionNumber,
        buffer,
        watermarkPreview: project?.watermarkPreview ?? true,
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
          uploadedById: user.id,
        },
      });
      // Reset status to pending so the client re-reviews this version, and
      // point `currentVersionId` at the new version.
      await prisma.image.update({
        where: { id: existing.id },
        data: {
          currentVersionId: newVersion.id,
          status: "pending",
          filenameOriginal: file.name,
        },
      });
      await prisma.auditLog.create({
        data: {
          orgId: project.orgId,
          projectId,
          actorId: user.id,
          action: "image.version_added",
          targetType: "image",
          targetId: existing.id,
          payload: JSON.stringify({ versionNumber: nextVersionNumber }),
        },
      });
      return NextResponse.json({
        id: existing.id,
        slot: existing.slotName,
        matched: true,
        versionNumber: nextVersionNumber,
        thumbUrl: `/api/storage/${stored.storagePathThumb}`,
      });
    }
    // Fall through to v1 path if no slot match in v2 mode.
  }

  // V1 path: create a new Image + first version.
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
      filenameOriginal: file.name,
      position: (last?.position ?? -1) + 1,
    },
  });

  // Derive preview + thumb. If Sharp throws (corrupted file, unsupported
  // format, disk full…) we must delete the Image row we just created — an
  // image without a currentVersion becomes an unreachable orphan that 404s
  // when arrow-nav lands on it.
  let stored;
  try {
    stored = await storeImageVersion({
      projectId,
      imageId: image.id,
      versionNumber: 1,
      buffer,
      watermarkPreview: project?.watermarkPreview ?? true,
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
      uploadedById: user.id,
    },
  });

  await prisma.image.update({
    where: { id: image.id },
    data: { currentVersionId: version.id },
  });

  return NextResponse.json({
    id: image.id,
    slot: image.slotName,
    matched: false,
    versionNumber: 1,
    thumbUrl: `/api/storage/${stored.storagePathThumb}`,
  });
}
