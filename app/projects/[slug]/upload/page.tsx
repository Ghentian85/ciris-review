import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UploadClient } from "./upload-client";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const project = await prisma.project.findFirst({
    where: { slug, members: { some: { userId: user.id } } },
  });
  if (!project) notFound();

  // Galleries are hidden plumbing: the upload route routes to the project's
  // first existing gallery (or auto-creates one). The client doesn't need to
  // know about galleries at all.
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-medium tracking-tight">Upload images</h1>
      <p className="text-sm text-muted mt-1 mb-8">{project.name}</p>
      <UploadClient projectId={project.id} projectSlug={project.slug} />
    </main>
  );
}
