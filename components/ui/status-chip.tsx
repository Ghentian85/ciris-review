import { cn } from "@/lib/utils";

// Underlying server-side status — 6 values, used by APIs, audit log, post-prod
// filters. The chip on photos only shows TWO labels: this is the client view,
// where every image is either "still needs your attention" or "you're done".
export type ImageStatus =
  | "pending"
  | "approved"
  | "approved_with_notes"
  | "revision_requested"
  | "v2_uploaded"
  | "final";

type Visual = "needs_review" | "approved";

function toVisual(status: ImageStatus): Visual {
  switch (status) {
    case "approved":
    case "approved_with_notes":
    case "final":
      return "approved";
    case "pending":
    case "revision_requested":
    case "v2_uploaded":
    default:
      return "needs_review";
  }
}

const LABEL: Record<Visual, string> = {
  needs_review: "Needs review",
  approved: "Approved",
};

// Solid pills, white text. Amber for action-needed (not red — too alarming
// for a normal review-stage marker). Sage green for done. Both with a
// subtle shadow so they read on light and dark images alike.
const TONE: Record<Visual, string> = {
  needs_review: "bg-status-notes text-white",
  approved: "bg-status-approved text-white",
};

type Size = "sm" | "md";

const SIZE: Record<Size, string> = {
  sm: "h-5 px-2 text-[10px] gap-1 [&_.dot]:h-1 [&_.dot]:w-1",
  md: "h-6 px-2.5 text-xs gap-1.5 [&_.dot]:h-1.5 [&_.dot]:w-1.5",
};

export function StatusChip({
  status,
  size = "md",
  className,
}: {
  status: ImageStatus;
  size?: Size;
  className?: string;
}) {
  const v = toVisual(status);
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium tracking-tight shadow-[0_1px_3px_rgba(0,0,0,0.18)]",
        TONE[v],
        SIZE[size],
        className
      )}
    >
      <span className="dot rounded-full bg-white/85" />
      {LABEL[v]}
    </span>
  );
}
