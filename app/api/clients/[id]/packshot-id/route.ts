import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const fieldSchema = z.object({
  brandBlurb: z.string().max(5000).optional().nullable(),
  audience: z.string().max(5000).optional().nullable(),
  stylingNotes: z.string().max(5000).optional().nullable(),
  fitNotes: z.string().max(5000).optional().nullable(),
  cameraNotes: z.string().max(5000).optional().nullable(),
  lightingNotes: z.string().max(5000).optional().nullable(),
  shadowNotes: z.string().max(5000).optional().nullable(),
  colourNotes: z.string().max(5000).optional().nullable(),
  formatNotes: z.string().max(5000).optional().nullable(),
  whitespaceNotes: z.string().max(5000).optional().nullable(),
  deliverySpecs: z.string().max(5000).optional().nullable(),
});

// Upsert the Packshot ID for a client. Admin / internal_reviewer /
// internal only — same tier that can edit project settings.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clientId } = await params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, orgId: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId: client.orgId, userId: user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (
    membership.role !== "owner" &&
    membership.role !== "admin" &&
    membership.role !== "internal"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = fieldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Normalize empty strings → null so blank sections don't bloat the PDF.
  const data: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    data[k] = v && v.trim() ? v : null;
  }

  const saved = await prisma.packshotId.upsert({
    where: { clientId },
    create: { clientId, ...data, updatedById: user.id },
    update: { ...data, updatedById: user.id },
  });

  return NextResponse.json({ ok: true, updatedAt: saved.updatedAt });
}
