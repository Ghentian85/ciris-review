"use client";

import { Logo } from "@/components/app/logo";

// "Powered by CIRIS" footer lockup. Mirrors the topbar's pattern:
//   [primary mark] · | · [caption]
// but inverted — here CIRIS is the trailing mark and "Powered by" is
// the lead-in caption, divided by a hairline. Cap-heights are matched
// visually (CIRIS trimmed to ~12px, Powered by at 10px) so neither
// element dwarfs the other.
//
// Hover: both halves lift from 55% to full white, caption gets a hint
// of tracking, wordmark eases scale(1.02). No glow — the composition
// carries the branding on its own.
//
// `accent` kept in the signature for later use (small accent dot or
// underline trick) without touching call-sites.
export function PoweredByCirisMark({}: { accent: string }) {
  return (
    <a
      href="https://ciris.studio"
      target="_blank"
      rel="noopener"
      className="group absolute bottom-8 left-12 inline-flex items-center gap-3 text-bg/55 hover:text-bg/95"
      aria-label="Powered by CIRIS — visit ciris.studio"
      style={{ transition: "color 500ms ease" }}
    >
      <span className="text-[10px] tracking-[0.22em] uppercase font-medium transition-[letter-spacing,opacity] duration-500 opacity-70 group-hover:opacity-100 group-hover:tracking-[0.24em]">
        Powered by
      </span>
      {/* Hairline divider — same role as the topbar's border between
          the brand mark and the REVIEW label. Height is pinned so it
          doesn't scale with font changes. */}
      <span
        aria-hidden
        className="h-3 w-px bg-current opacity-30"
      />
      <Logo
        trim
        className="h-3 w-auto fill-current transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      />
    </a>
  );
}
