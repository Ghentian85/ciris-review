import { cookies } from "next/headers";
import { createHash, randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

const SESSION_COOKIE = "ciris_review_session";
const SESSION_TTL_DAYS = 30;
const LOGIN_TOKEN_TTL_MIN = 30;

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function sign(token: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(token).digest("hex");
}

export function newRawToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

// ---------- Magic-link login tokens ----------

export async function createLoginToken(email: string, name?: string) {
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: name ? { name } : {},
    create: { email: email.toLowerCase(), name: name ?? null },
  });
  const raw = newRawToken();
  const tokenHash = sha256(raw);
  const expiresAt = new Date(Date.now() + LOGIN_TOKEN_TTL_MIN * 60_000);
  await prisma.loginToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });
  return { user, raw };
}

export async function consumeLoginToken(raw: string) {
  const tokenHash = sha256(raw);
  const record = await prisma.loginToken.findUnique({ where: { tokenHash } });
  if (!record) return null;
  if (record.consumedAt) return null;
  if (record.expiresAt < new Date()) return null;
  await prisma.loginToken.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
  return record.userId;
}

// ---------- Sessions ----------

export async function createSession(userId: string, userAgent?: string) {
  const raw = newRawToken();
  const tokenHash = sha256(raw);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60_000);
  await prisma.session.create({
    data: { userId, tokenHash, expiresAt, userAgent: userAgent ?? null },
  });
  const signed = `${raw}.${sign(raw)}`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return raw;
}

export async function destroySession() {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  if (cookie) {
    const [raw] = cookie.split(".");
    const tokenHash = sha256(raw);
    await prisma.session.deleteMany({ where: { tokenHash } });
  }
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  const [raw, sig] = cookie.split(".");
  if (!raw || !sig) return null;
  const expected = sign(raw);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

// ---------- Membership helpers ----------

export async function getOrgMembership(userId: string, orgId: string) {
  return prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
}

export async function getProjectMembership(userId: string, projectId: string) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

// Single-row lookup: is this user an owner or admin in any org they belong
// to? Used to gate the Admin link in the topbar.
export async function isOrgAdmin(userId: string) {
  const found = await prisma.organizationMember.findFirst({
    where: { userId, role: { in: ["owner", "admin"] } },
    select: { id: true },
  });
  return found !== null;
}

// Returns true if the user can administrate the project — either as a
// project member with admin/internal_reviewer role, OR as an org
// owner/admin (which overrides project-level absence). Centralizing this
// so admin actions across the app stay consistent.
export async function canAdminProject(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { orgId: true },
  });
  if (!project) return false;

  const [pm, om] = await Promise.all([
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    }),
    prisma.organizationMember.findUnique({
      where: { orgId_userId: { orgId: project.orgId, userId } },
      select: { role: true },
    }),
  ]);

  if (pm && (pm.role === "admin" || pm.role === "internal_reviewer")) return true;
  if (om && (om.role === "owner" || om.role === "admin")) return true;
  return false;
}
