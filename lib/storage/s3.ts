import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  NoSuchKey,
  NotFound,
} from "@aws-sdk/client-s3";
import {
  type StorageAdapter,
  type ObjectMeta,
  StorageNotFoundError,
} from "./adapter";

// S3-compatible adapter. Works with AWS S3, Cloudflare R2, MinIO, Backblaze
// B2, etc. — anything that speaks the S3 API. Configured via env vars:
//   S3_ENDPOINT   (optional, e.g. https://<accountid>.r2.cloudflarestorage.com)
//   S3_REGION     (default "auto" for R2)
//   S3_BUCKET     (required)
//   S3_ACCESS_KEY (required)
//   S3_SECRET_KEY (required)
//
// Keys mirror local paths verbatim — "projects/<id>/preview/<file>.webp" — so
// you can sync data with `aws s3 sync` between local and cloud during
// migrations.

export class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor(opts: {
    endpoint?: string;
    region?: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  }) {
    this.client = new S3Client({
      region: opts.region ?? "auto",
      endpoint: opts.endpoint,
      credentials: {
        accessKeyId: opts.accessKeyId,
        secretAccessKey: opts.secretAccessKey,
      },
      // R2 + MinIO need path-style addressing; AWS S3 supports both. Path
      // style is the safer universal default.
      forcePathStyle: true,
    });
    this.bucket = opts.bucket;
  }

  async putObject(key: string, body: Buffer, meta: ObjectMeta): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: meta.contentType,
      })
    );
  }

  async getObject(key: string) {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      if (!res.Body) throw new StorageNotFoundError(key);
      const arr = await res.Body.transformToByteArray();
      return {
        body: Buffer.from(arr),
        contentType: res.ContentType ?? "application/octet-stream",
      };
    } catch (err: unknown) {
      if (err instanceof NoSuchKey || err instanceof NotFound) {
        throw new StorageNotFoundError(key);
      }
      // S3 sometimes returns a generic 404 instead of typed error
      if (
        err &&
        typeof err === "object" &&
        "name" in err &&
        (err.name === "NoSuchKey" || err.name === "NotFound")
      ) {
        throw new StorageNotFoundError(key);
      }
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      );
      return true;
    } catch {
      return false;
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
      );
    } catch {
      // best-effort — match local adapter semantics
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    // S3 has no recursive delete. List + batch-delete.
    let continuationToken: string | undefined;
    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );
      const objects = (listed.Contents ?? [])
        .map((o) => (o.Key ? { Key: o.Key } : null))
        .filter((o): o is { Key: string } => o !== null);
      if (objects.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: objects, Quiet: true },
          })
        );
      }
      continuationToken = listed.NextContinuationToken;
    } while (continuationToken);
  }
}
