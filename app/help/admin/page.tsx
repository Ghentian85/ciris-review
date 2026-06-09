import Link from "next/link";
import { AdminGuide } from "../guides/admin";

export const metadata = {
  title: "Help · For studios — CIRIS Review",
  description: "Setting up projects, inviting reviewers, running rounds, managing access.",
};

export default function AdminHelp() {
  return (
    <main className="mx-auto max-w-3xl px-6 pt-12 pb-24 animate-rise">
      <Link
        href="/help"
        className="text-[11px] text-muted-soft hover:text-ink underline underline-offset-4"
      >
        ← All guides
      </Link>
      <div className="mt-6 mb-12">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          For studios
        </p>
        <h1 className="font-display text-[40px] leading-[1.05] tracking-tight">
          Running projects from end to end
        </h1>
        <p className="text-sm text-muted mt-3 max-w-xl">
          Set up a project, invite the team, push images, run rounds, hand off
          to post-production, and close out cleanly.
        </p>
      </div>
      <AdminGuide />
    </main>
  );
}
