import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAdminProject } from "@/lib/auth";
import { env } from "@/lib/env";

const schema = z.object({
  // Scope of the share. For MVP we only support project-wide; future could
  // narrow to a specific gallery or image.
  scope: z.enum(["project"]).default("project"),
  password: z.string().min(4).max(120).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

// Hash passwords with a salted SHA-256 (good enough for share-link gating —
// these aren't user credentials, just project access tokens). Real passwords
// would use argon2 / bcrypt.
function hashPassword(password: string) {
  return createHash("sha256")
    .update(`${env.AUTH_SECRET}:share:${password}`)
    .digest("hex");
}

// POST: create a new share link.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  if (!(await canAdminProject(user.id, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { orgId: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const passwordHash = parsed.data.password
    ? hashPassword(parsed.data.password)
    : null;
  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const link = await prisma.shareLink.create({
    data: {
      projectId,
      scope: parsed.data.scope,
      scopeId: projectId,
      tokenHash,
      passwordHash,
      expiresAt,
      createdById: user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      orgId: project.orgId,
      projectId,
      actorId: user.id,
      action: "share_link.created",
      targetType: "share_link",
      targetId: link.id,
      payload: JSON.stringify({
        hasPassword: !!passwordHash,
        expiresAt: expiresAt?.toISOString() ?? null,
      }),
    },
  });

  return NextResponse.json({
    id: link.id,
    // Token is only returned once — store/copy it now or it's lost (we only
    // keep the hash). The URL is the user-shareable form.
    url: `${env.APP_URL}/share/${rawToken}`,
    expiresAt: expiresAt?.toISOString() ?? null,
    hasPassword: !!passwordHash,
  });
}

// GET: list existing share links for the project.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  if (!(await canAdminProject(user.id, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const links = await prisma.shareLink.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      scope: true,
      passwordHash: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    links: links.map((l) => ({
      id: l.id,
      scope: l.scope,
      hasPassword: !!l.passwordHash,
      expiresAt: l.expiresAt?.toISOString() ?? null,
      createdAt: l.createdAt.toISOString(),
      // Token isn't recoverable (only hash stored) — UI must surface this.
      expired: l.expiresAt ? l.expiresAt < new Date() : false,
    })),
  });
}
