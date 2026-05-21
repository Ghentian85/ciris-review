import type { Metadata } from "next";
import "./globals.css";
import { SiteFrame } from "@/components/app/site-frame";
import { getCurrentUser, isOrgAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "CIRIS Review",
  description: "Visual production review & approval for creative teams.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve auth context once at the root. SiteFrame decides whether the
  // topbar should render for the current route. Mounting the topbar here
  // means it survives client-side navigations — no flicker, no remount.
  const user = await getCurrentUser();
  const isAdmin = user ? await isOrgAdmin(user.id) : false;

  return (
    <html lang="en">
      <body>
        <SiteFrame user={user ? { email: user.email } : null} isAdmin={isAdmin}>
          {children}
        </SiteFrame>
      </body>
    </html>
  );
}
