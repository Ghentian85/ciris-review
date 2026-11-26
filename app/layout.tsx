import type { Metadata } from "next";
import "./globals.css";
import { SiteFrame } from "@/components/app/site-frame";
import { getCurrentUser, isOrgAdmin } from "@/lib/auth";
import { getCurrentOrg } from "@/lib/org";

export const metadata: Metadata = {
  title: "CIRIS Review",
  description: "Visual production review & approval for creative teams.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve auth + tenant context once at the root. SiteFrame decides
  // whether the topbar should render for the current route; mounting it
  // here keeps it alive across client-side navigations.
  const [user, org] = await Promise.all([getCurrentUser(), getCurrentOrg()]);
  const isAdmin = user ? await isOrgAdmin(user.id) : false;

  const brand = {
    logoUrl: org?.logoUrl ?? null,
    displayName: org?.displayName ?? null,
    poweredByCiris: org?.poweredByCiris ?? false,
  };

  return (
    <html lang="en">
      <body>
        <SiteFrame
          user={user ? { email: user.email } : null}
          isAdmin={isAdmin}
          brand={brand}
        >
          {children}
        </SiteFrame>
      </body>
    </html>
  );
}
