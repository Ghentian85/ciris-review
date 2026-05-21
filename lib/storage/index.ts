// Storage adapter selection. The app code always imports `getStorage()` from
// here and never touches a backend directly. Selection is env-driven so dev
// keeps using local FS while prod can swap to R2/S3 by setting env vars.
//
//   STORAGE_PROVIDER = "local" (default) | "s3"
//
// With "s3", the S3_* env vars must be present.

import type { StorageAdapter } from "./adapter";
import { LocalStorageAdapter } from "./local";
import { S3StorageAdapter } from "./s3";

let cached: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (cached) return cached;
  const provider = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  if (provider === "s3") {
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "STORAGE_PROVIDER=s3 but S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY are not all set"
      );
    }
    cached = new S3StorageAdapter({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "auto",
      bucket,
      accessKeyId,
      secretAccessKey,
    });
  } else {
    cached = new LocalStorageAdapter();
  }
  return cached;
}

export type { StorageAdapter } from "./adapter";
export { StorageNotFoundError } from "./adapter";
