import { Screenshot } from "./screenshot";

// A numbered step with title, body, and optional screenshot. Stacked in a
// vertical list — number sits in a square next to the title, body and
// screenshot flow underneath.
export function Step({
  number,
  title,
  children,
  screenshot,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
  screenshot?: { src?: string; alt: string; caption?: string };
}) {
  return (
    <div className="mb-10">
      <div className="flex items-start gap-4">
        <span className="flex-shrink-0 h-8 w-8 bg-ink text-bg grid place-items-center font-display font-medium tabular-nums">
          {number}
        </span>
        <div className="flex-1 min-w-0 pt-1">
          <h3 className="font-display text-xl font-medium tracking-tight leading-tight mb-2">
            {title}
          </h3>
          <div className="text-[15px] text-ink-soft leading-relaxed [&>p]:mb-3 [&>ul]:my-3 [&>ul]:pl-5 [&>ul]:list-disc [&>ul>li]:mb-1.5 [&_strong]:font-medium [&_strong]:text-ink [&_code]:bg-line-soft [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:font-medium [&_code]:text-ink">
            {children}
          </div>
          {screenshot ? (
            <Screenshot
              src={screenshot.src}
              alt={screenshot.alt}
              caption={screenshot.caption}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Section header used to group steps under a higher-level topic, e.g.
// "Day one" / "Reviewing an image" / "When you're done".
export function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <div className="mb-8 pb-4 border-b hairline">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted mb-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {eyebrow}
        </p>
        <h2 className="font-display text-[28px] tracking-tight leading-tight">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
