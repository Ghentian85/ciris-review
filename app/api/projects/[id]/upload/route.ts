import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ingestUpload } from "@/lib/upload-logic";

// LEGACY multipart POST path. Still used:
//   - on the local-FS dev adapter (no presigned URL available)
//   - as a fallback for small files
//
// For prod uploads the client goes through /upload/presign + /upload/
// finalize instead, because Vercel serverless functions reject bodies
// over 4.5 MB before this route ever runs. We cap this route at the
// same 4.5 MB on the client to keep the 413 off the wire entirely.

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

    const form = await req.formData();
    const file = form.get("file");
    const formGalleryId = form.get("galleryId");
    const slotName = form.get("slotName");
    const mode = form.get("mode") === "v2" ? "v2" : "v1";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await ingestUpload({
      projectId,
      userId: user.id,
      buffer,
      filename: file.name,
      slotName: typeof slotName === "string" ? slotName : null,
      mode,
      galleryId: typeof formGalleryId === "string" ? formGalleryId : null,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload] unhandled error:", msg, err);
    return NextResponse.json(
      { error: "Internal server error", detail: msg },
      { status: 500 }
    );
  }
}
