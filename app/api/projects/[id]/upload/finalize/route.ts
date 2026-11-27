import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getStorage } from "@/lib/storage/index";
import { ingestUpload } from "@/lib/upload-logic";

// Step 2 of the direct-to-R2 upload flow. Client has already PUT the raw
// bytes to the presigned URL — we read them back out of R2, derive
// preview + thumb, write the Image + ImageVersion rows, then delete the
// pending upload object so storage doesn't balloon with raw masters.
//
// The buffer read here can be 30–80 MB; Sharp decodes in memory. Keep
// per-worker concurrency low on the client (4) so we don't OOM a
// serverless function that's handling several at once.

export const maxDuration = 60;

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
      uploadKey?: string;
      filename?: string;
      slotName?: string;
      mode?: "v1" | "v2";
      galleryId?: string;
    };

    const uploadKey = typeof body.uploadKey === "string" ? body.uploadKey : "";
    const filename = typeof body.filename === "string" ? body.filename : "";
    const mode = body.mode === "v2" ? "v2" : "v1";

    if (!uploadKey || !filename) {
      return NextResponse.json(
        { error: "uploadKey and filename required" },
        { status: 400 }
      );
    }
    // Defence in depth: the key the client sends back MUST sit under this
    // project's pending-uploads prefix. Without this check a logged-in
    // member could finalise someone else's pending upload by guessing the
    // key.
    const prefix = `projects/${projectId}/_uploads/`;
    if (!uploadKey.startsWith(prefix)) {
      return NextResponse.json({ error: "Invalid uploadKey" }, { status: 400 });
    }

    const storage = getStorage();
    let buffer: Buffer;
    try {
      const obj = await storage.getObject(uploadKey);
      buffer = obj.body;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "Pending upload not found", detail: msg },
        { status: 404 }
      );
    }

    const result = await ingestUpload({
      projectId,
      userId: user.id,
      buffer,
      filename,
      slotName: body.slotName ?? null,
      mode,
      galleryId: body.galleryId ?? null,
    });

    // Original master is intentionally NOT kept — only preview + thumb
    // live in persistent storage. Delete the pending object either way
    // (even on skipped v1 slot-collisions) to keep _uploads/ tidy.
    await storage.deleteObject(uploadKey).catch(() => {});

    return NextResponse.json(result.body, { status: result.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload.finalize] error:", msg, err);
    return NextResponse.json(
      { error: "Internal server error", detail: msg },
      { status: 500 }
    );
  }
}
