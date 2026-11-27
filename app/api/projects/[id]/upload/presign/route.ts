import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getStorage } from "@/lib/storage/index";

// Step 1 of the two-step direct-to-R2 upload flow.
//
// The client POSTs { filename, contentType, size } and gets back a short
// lived presigned PUT URL plus the storage key the server will finalise
// against. The raw file bytes NEVER go through a Vercel serverless route
// (4.5 MB body limit), so 30–80 MB fashion-shoot masters upload cleanly.
//
// On the local-FS adapter there is no presign — we return { uploadUrl:
// null } and the client falls back to the legacy multipart POST, which
// works fine in dev.

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB hard cap per file

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId } = await params;
    const me = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!me || me.role === "client_reviewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      filename?: string;
      contentType?: string;
      size?: number;
    };
    const filename = typeof body.filename === "string" ? body.filename : "";
    const contentType =
      typeof body.contentType === "string" && body.contentType
        ? body.contentType
        : "application/octet-stream";
    const size = typeof body.size === "number" ? body.size : 0;

    if (!filename) {
      return NextResponse.json({ error: "filename required" }, { status: 400 });
    }
    if (size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB)` },
        { status: 413 }
      );
    }

    // Pending uploads live under a per-project prefix. finalize() deletes
    // the pending object once it's been derived into preview/thumb. If a
    // finalize never happens (crashed client), the object stays until the
    // periodic cleanup prunes _uploads/ older than 24h.
    const id = randomBytes(6).toString("hex");
    const safeName = filename.replace(/[^\w.\-]/g, "_").slice(0, 200);
    const uploadKey = `projects/${projectId}/_uploads/${id}-${safeName}`;

    const storage = getStorage();
    const presigned = await storage.createUploadUrl(uploadKey, {
      contentType,
      expiresInSeconds: 3600,
    });

    return NextResponse.json({
      uploadKey,
      uploadUrl: presigned?.url ?? null,
      method: presigned?.method ?? null,
      headers: presigned?.headers ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload.presign] error:", msg, err);
    return NextResponse.json(
      { error: "Internal server error", detail: msg },
      { status: 500 }
    );
  }
}
