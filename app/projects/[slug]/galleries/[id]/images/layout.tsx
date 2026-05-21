import { redirect } from "next/navigation";
import { Topbar } from "@/components/app/topbar";
import { FullscreenShell } from "@/components/reviewer/fullscreen-shell";
import { getCurrentUser, isOrgAdmin } from "@/lib/auth";

// This layout sits one level above [imageId], so it persists when navigating
// between sibling images via prev/next or view-tabs. That's what lets the
// FullscreenShell's rootRef stay mounted — fullscreen survives navigation.
export default async function ImagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <>
      <Topbar userEmail={user.email} isAdmin={await isOrgAdmin(user.id)} />
      <FullscreenShell>{children}</FullscreenShell>
    </>
  );
}
