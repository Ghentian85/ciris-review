import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HelpTabs } from "./help-tabs";

// Picks the most-likely-relevant tab for the signed-in user. Defaults to
// "admin" since the studio team uses /help most. Anyone can switch tabs.
async function defaultTabForUser(userId: string): Promise<"admin" | "client" | "post-prod"> {
  // Look at the user's project memberships. Heuristic: if they're a client
  // anywhere, default to the client guide; if they're post-prod anywhere,
  // default to that; otherwise admin/internal → admin guide.
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
  if (!user) redirect("/login?next=/help");

  const defaultTab = await defaultTabForUser(user.id);

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
          You can also switch between them anytime.
        </p>
      </div>

      <HelpTabs defaultTab={defaultTab} />
    </main>
  );
}
