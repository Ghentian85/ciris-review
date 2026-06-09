import Link from "next/link";
import { PostProdGuide } from "../guides/post-prod";

export const metadata = {
  title: "Help · For post-production — CIRIS Review",
  description: "Working through revision lists, marking comments done, uploading v2.",
};

export default function PostProdHelp() {
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
          For post-production
        </p>
        <h1 className="font-display text-[40px] leading-[1.05] tracking-tight">
          Closing the revision loop
        </h1>
        <p className="text-sm text-muted mt-3 max-w-xl">
          Find the work that needs you, address comments image by image, and
          upload v2 cleanly so the client can re-review.
        </p>
      </div>
      <PostProdGuide />
    </main>
  );
}
