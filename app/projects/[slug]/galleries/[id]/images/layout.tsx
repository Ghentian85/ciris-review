import { redirect } from "next/navigation";
import { FullscreenShell } from "@/components/reviewer/fullscreen-shell";
import { getCurrentUser } from "@/lib/auth";

// This layout sits one level above [imageId], so it persists when navigating
// between sibling images via prev/next or view-tabs. That's what lets the
// FullscreenShell's rootRef stay mounted — fullscreen survives navigation.
// Topbar lives in the root layout now, not here.
export default async function ImagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <FullscreenShell>{children}</FullscreenShell>;
}
