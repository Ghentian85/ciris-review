import Link from "next/link";
import { ClientGuide } from "../guides/client";

export const metadata = {
  title: "Help · For client reviewers — CIRIS Review",
  description: "How to review your shoot, leave feedback, and submit a round.",
};

export default function ClientHelp() {
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
          For client reviewers
        </p>
        <h1 className="font-display text-[40px] leading-[1.05] tracking-tight">
          Reviewing your shoot
        </h1>
        <p className="text-sm text-muted mt-3 max-w-xl">
          The studio has set up your project. This guide walks you through how
          to look at images, leave feedback, and submit a round.
        </p>
      </div>
      <ClientGuide />
    </main>
  );
}
