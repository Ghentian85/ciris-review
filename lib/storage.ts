// Image derivation pipeline. Sharp reads the in-memory buffer, generates
// preview + thumb tiers, and hands the bytes to the storage adapter — the
// adapter decides whether they go to local FS or to S3/R2.

import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { getStorage } from "@/lib/storage/index";

export type ImageTier = "original" | "preview" | "thumb";

export async function storeImageVersion(opts: {
  projectId: string;
  imageId: string;
  versionNumber: number;
  buffer: Buffer;
}) {
  const storage = getStorage();
  const id = randomBytes(4).toString("hex");
  const base = `${opts.imageId}_v${opts.versionNumber}_${id}`;
  // NOTE: source file is intentionally NOT persisted. Sharp reads from the
  // in-memory buffer, derives preview + thumb, then the source goes out of
  // scope at end of request. High-res masters stay on the post-prod side.
  const previewKey = path.posix.join("projects", opts.projectId, "preview", `${base}.webp`);
  const thumbKey = path.posix.join("projects", opts.projectId, "thumb", `${base}.webp`);

  const meta = await sharp(opts.buffer, { failOn: "none" })
    .metadata()
    .catch(() => ({}) as sharp.Metadata);

  // Resize to the preview tier.
  const resized = await sharp(opts.buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 2000, withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });

  const previewBuffer = await sharp(resized.data, { failOn: "none" })
    .webp({ quality: 80 })
    .toBuffer();
  await storage.putObject(previewKey, previewBuffer, { contentType: "image/webp" });

  const thumbBuffer = await sharp(opts.buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();
  await storage.putObject(thumbKey, thumbBuffer, { contentType: "image/webp" });

  return {
    storagePathOriginal: null as string | null,
    storagePathPreview: previewKey,
    storagePathThumb: thumbKey,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    mime: meta.format ? `image/${meta.format}` : "image/jpeg",
    sizeBytes: opts.buffer.length,
  };
}
