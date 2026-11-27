"use client";

import { Logo } from "@/components/app/logo";

// Hover-animated CIRIS wordmark for the panel's lower-left footer.
// On hover: the "Powered by" caption fades to full opacity and the
// wordmark eases from muted to pure white. No glow, no sheen — a
// single quiet opacity transition that reads as premium rather than
// product-launch energy.
//
// The `accent` prop is intentionally unused for now but kept in the
// signature so we can add a tasteful accent flourish (a tick-bar
// underneath, a dot) later without touching call-sites.
export function PoweredByCirisMark({}: { accent: string }) {
  return (
    <a
      href="https://ciris.studio"
      target="_blank"
      rel="noopener"
      className="group absolute bottom-8 left-12 inline-flex items-baseline gap-2.5 text-bg/55 hover:text-bg/95"
      aria-label="Powered by CIRIS — visit ciris.studio"
      style={{ transition: "color 500ms ease" }}
    >
      <span className="text-[10px] tracking-[0.24em] uppercase font-medium translate-y-[1px] transition-opacity duration-500 opacity-70 group-hover:opacity-100">
        Powered by
      </span>
      {/* trim=true crops the SVG viewBox to the actual glyph block so
          baseline alignment works naturally against the caption. */}
      <Logo
        trim
        className="h-[18px] w-auto fill-current transition-transform duration-500 ease-out group-hover:scale-[1.02]"
      />
    </a>
  );
}
