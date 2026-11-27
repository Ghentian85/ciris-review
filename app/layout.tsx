import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteFrame } from "@/components/app/site-frame";
import { getCurrentUser, isOrgAdmin } from "@/lib/auth";
import { getCurrentOrg } from "@/lib/org";
import { brandFaviconSvg } from "@/lib/brand-favicon";

// Inter is the closest free analogue to Studio 360's Neue Haas
// Grotesque — same neutral grotesk skeleton, generous counters,
// comparable x-height. We load it site-wide but only *activate* it
// through the `[data-brand="studio-360"]` selector so chapter103
// keeps its existing serif/system stack untouched.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-grotesque",
  display: "swap",
});

// Metadata (title, description, favicon, open-graph) is resolved per
// tenant from the request hostname. Studio 360 visitors see "Studio 360
// Review" in their browser tab and get the 360° mark in the favicon;
// chapter103 visitors keep the CIRIS title. The favicon is served as a
// data: URI we generate from the org's brand accent so we don't have
// to ship a separate .ico per tenant.
export async function generateMetadata(): Promise<Metadata> {
  const org = await getCurrentOrg();
  const name = org?.displayName ?? "CIRIS";
  const title = `${name} Review`;
  const description =
    org?.poweredByCiris
      ? `${name} — production review, powered by CIRIS.`
      : "Visual production review & approval for creative teams.";
  const faviconHref = brandFaviconSvg(org?.brandAccent ?? null, org?.slug ?? null);
  return {
    title,
    description,
    icons: {
      icon: [{ url: faviconHref, type: "image/svg+xml" }],
    },
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
  };
}

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

  // Expose the tenant's brand accent as a CSS variable so Tailwind's
  // bg-accent / text-accent / border-accent utilities pick it up on
  // studio360.ciris.studio without touching every button/chip. If the
  // org didn't set one, falls back to whatever globals.css defined.
  const brandAccentStyle = org?.brandAccent
    ? ({ "--accent": org.brandAccent } as React.CSSProperties)
    : undefined;

  return (
    <html lang="en" className={inter.variable}>
      <body style={brandAccentStyle} data-brand={org?.slug ?? undefined}>
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
