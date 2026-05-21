import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorage, StorageNotFoundError } from "@/lib/storage/index";

// Serves files from the configured storage backend (local FS or S3/R2).
// Access via either:
//   1. Authenticated session (project member only)
//   2. Public share token (?share=<token> matching a ShareLink for the project)
// Path shape:
//   /api/storage/projects/:projectId/(original|preview|thumb)/:file

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  if (segments.length !== 4 || segments[0] !== "projects") {
    return new NextResponse("Not found", { status: 404 });
  }
  const [, projectId, tier, file] = segments;
  if (!["original", "preview", "thumb"].includes(tier)) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (file.includes("..") || file.includes("/")) {
    return new NextResponse("Bad request", { status: 400 });
  }

  // Auth tier 1: regular project membership.
  let authorized = false;
  let allowOriginal = false;

  const user = await getCurrentUser();
  if (user) {
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (membership) {
      authorized = true;
      // Block clients from downloading originals (review tier only)
      allowOriginal = membership.role !== "client_reviewer";
    }
  }

  // Auth tier 2: public share token. Only ever allows preview/thumb — never
  // grants access to originals, regardless of project role policy.
  if (!authorized) {
    const shareToken = req.nextUrl.searchParams.get("share");
    if (shareToken) {
      const tokenHash = createHash("sha256").update(shareToken).digest("hex");
      const link = await prisma.shareLink.findUnique({
        where: { tokenHash },
        select: { projectId: true, expiresAt: true },
      });
      if (
        link &&
        link.projectId === projectId &&
        (!link.expiresAt || link.expiresAt > new Date()) &&
        tier !== "original"
      ) {
        authorized = true;
        allowOriginal = false;
      }
    }
  }

  if (!authorized) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (tier === "original" && !allowOriginal) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const key = `projects/${projectId}/${tier}/${file}`;
  const storage = getStorage();

  let body: Buffer;
  let contentType: string;
  try {
    const obj = await storage.getObject(key);
    body = obj.body;
    contentType = obj.contentType;
  } catch (err) {
    if (err instanceof StorageNotFoundError) {
      return new NextResponse("Not found", { status: 404 });
    }
    throw err;
  }

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control":
        tier === "original"
          ? "private, max-age=60"
          : "private, max-age=31536000, immutable",
    },
  });
}
