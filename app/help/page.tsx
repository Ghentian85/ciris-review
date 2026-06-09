import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HelpTabs } from "./help-tabs";

// /help is public. Signed-in users get a tab pre-selected based on the
// roles they hold across their projects; anonymous visitors land on the
// admin tab by default (most likely audience checking the platform out).
async function defaultTabForUser(userId: string): Promise<"admin" | "client" | "post-prod"> {
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { role: true },
    take: 20,
  });
  if (memberships.some((m) => m.role === "client_reviewer")) return "client";
  if (memberships.some((m) => m.role === "post_production")) return "post-prod";
  return "admin";
}

export default async function HelpPage() {
  const user = await getCurrentUser();
  const defaultTab = user ? await defaultTabForUser(user.id) : "admin";

  return (
    <main className="mx-auto max-w-3xl px-6 pt-12 pb-24">
      <div className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          User guide
        </p>
        <h1 className="font-display text-[44px] leading-[1.05] tracking-tight">
          How to use CIRIS Review
        </h1>
        <p className="text-sm text-muted mt-3 max-w-xl">
          Three short guides — one per role. Pick the tab that matches you.
          You can also link straight to a single role:{" "}
          <DirectLink href="/help/admin">Studios</DirectLink>,{" "}
          <DirectLink href="/help/client">Clients</DirectLink>,{" "}
          <DirectLink href="/help/post-prod">Post-production</DirectLink>.
        </p>
      </div>

      <HelpTabs defaultTab={defaultTab} />
    </main>
  );
}

function DirectLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-ink underline underline-offset-4 hover:text-accent">
      {children}
    </Link>
  );
}
