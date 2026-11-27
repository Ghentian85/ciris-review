"use client";

import { Logo } from "@/components/app/logo";


// Hover-animated CIRIS wordmark for the panel's lower-left footer.
// On hover: label fades up, wordmark eases from muted to full white
// and a soft accent glow blooms underneath. No sliding sheen — quiet
// and premium, matches Studio 360's reduced vocabulary.
export function PoweredByCirisMark({ accent }: { accent: string }) {
  // Build the accent as an rgba-ish drop-shadow so we can colour the
  // glow directly from the brand accent without hardcoding yellow.
  return (
    <a
      href="https://ciris.studio"
      target="_blank"
      rel="noopener"
      className="ciris-mark group absolute bottom-8 left-12 inline-flex items-baseline gap-2 text-bg/55 hover:text-bg/95"
      aria-label="Powered by CIRIS — visit ciris.studio"
      style={
        {
          transition: "color 500ms ease",
          // Scoped CSS variable the <style> block below reads off —
          // lets the drop-shadow bloom follow whatever the tenant
          // picked as accent without hardcoding yellow.
          ["--brand-glow" as string]: accent,
        } as React.CSSProperties
      }
    >
      <span className="text-[10px] tracking-[0.24em] uppercase font-medium translate-y-[1px] transition-opacity duration-500 opacity-70 group-hover:opacity-100">
        Powered by
      </span>
      <Logo className="h-7 w-auto fill-current transition-transform duration-500 ease-out group-hover:scale-[1.02]" />
      <style>{`
        .ciris-mark svg {
          transition: filter 500ms ease;
        }
        .ciris-mark:hover svg {
          filter: drop-shadow(0 0 14px var(--brand-glow))
                  drop-shadow(0 0 3px var(--brand-glow));
        }
      `}</style>
    </a>
  );
}
