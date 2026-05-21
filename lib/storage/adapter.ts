// Storage adapter contract. The app talks to this interface and never to a
// specific backend, so swapping local FS → S3/R2 in production is a one-line
// env-var change.

export type ObjectMeta = {
  contentType: string;
};

export interface StorageAdapter {
  /** Write bytes at `key`. Creates parent path/prefix as needed. */
  putObject(key: string, body: Buffer, meta: ObjectMeta): Promise<void>;
  /** Read bytes. Throws an Error with code "ENOENT" if the key is missing. */
  getObject(key: string): Promise<{ body: Buffer; contentType: string }>;
  /** True if the object exists. */
  exists(key: string): Promise<boolean>;
  /** Delete a single object. No-op if it doesn't exist. */
  deleteObject(key: string): Promise<void>;
  /** Delete everything under a key prefix (for project cleanup). */
  deletePrefix(prefix: string): Promise<void>;
}

export class StorageNotFoundError extends Error {
  code = "ENOENT" as const;
  constructor(key: string) {
    super(`storage: key not found: ${key}`);
  }
}
