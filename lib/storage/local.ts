import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";
import {
  type StorageAdapter,
  type ObjectMeta,
  StorageNotFoundError,
} from "./adapter";

// Local filesystem adapter. Used in dev and on single-instance hosts that have
// a persistent disk. Not suitable for Vercel / serverless deployments —
// switch to the S3 adapter there.
export class LocalStorageAdapter implements StorageAdapter {
  private root: string;

  constructor(root?: string) {
    this.root = path.resolve(process.cwd(), root ?? env.STORAGE_DIR);
  }

  private abs(key: string) {
    // Defensive: refuse traversal.
    if (key.includes("..")) {
      throw new Error(`storage: illegal key ${key}`);
    }
    return path.join(this.root, key);
  }

  async putObject(key: string, body: Buffer, _meta: ObjectMeta): Promise<void> {
    const file = this.abs(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
  }

  async getObject(key: string) {
    try {
      const body = await fs.readFile(this.abs(key));
      return { body, contentType: guessContentType(key) };
    } catch {
      throw new StorageNotFoundError(key);
    }
  }

  async exists(key: string) {
    try {
      await fs.access(this.abs(key));
      return true;
    } catch {
      return false;
    }
  }

  async deleteObject(key: string) {
    try {
      await fs.unlink(this.abs(key));
    } catch {
      // ignore missing
    }
  }

  async deletePrefix(prefix: string) {
    try {
      await fs.rm(this.abs(prefix), { recursive: true, force: true });
    } catch {
      // ignore missing
    }
  }
}

function guessContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}
