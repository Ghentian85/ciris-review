"use client";

import { Logo } from "@/components/app/logo";

// Decorative pieces specific to Studio 360's sign-in panel. Lifted out
// of login-client.tsx so the login file stays legible — this one owns
// the brand shapes, the slow 360° rotation, the grain, and the hover-
// animated "Powered by CIRIS" lockup.

export function Studio360Backdrop({ accent }: { accent: string }) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-ink">
      {/* Bauhaus composition. Three big primitives — a quarter-circle, a
          half-circle, a disc — arranged asymmetrically against pure
          black. Direct lift of their brandbook vocabulary (geometric
          yellow/black primitives), but calmer: fewer forms, bigger,
          more negative space. Nothing rotates. Breathing only. */}

      {/* 1. Giant yellow quarter-circle rising from the bottom edge —
            the hero form. Positioned off-centre low so it reads as a
            "rising sun" shape. */}
      <div
        className="absolute left-[-10%] bottom-[-55%] h-[120%] w-[120%] rounded-full animate-s360-breathe"
        style={{
          background: accent,
          willChange: "transform, opacity",
        }}
      />

      {/* 2. Overlapping pure-black disc, smaller, pushed low-right so it
            carves into the yellow — the signature "eclipse" tension
            their brandbook uses on page 1 (big black half over yellow). */}
      <div
        className="absolute right-[-20%] bottom-[-10%] h-[70%] w-[70%] rounded-full"
        style={{ background: "#000" }}
      />

      {/* 3. Mid-tone yellow disc upper-right — the small "satellite"
            that keeps the composition from reading symmetrical. */}
      <div
        className="absolute right-[12%] top-[14%] h-[56px] w-[56px] rounded-full"
        style={{ background: accent, opacity: 0.9 }}
      />

      {/* 4. Tiny yellow dot cluster upper-left — the third-position
            visual rhyme with their pattern page. */}
      <div className="absolute left-[18%] top-[22%] flex gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: accent, opacity: 0.9 }}
        />
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: accent, opacity: 0.4 }}
        />
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: accent, opacity: 0.2 }}
        />
      </div>

      {/* 5. Soft glow haloing the yellow quarter-circle — so it feels
            lit rather than pasted on. */}
      <div
        className="absolute left-[-5%] bottom-[-45%] h-[110%] w-[110%] rounded-full pointer-events-none animate-s360-breathe"
        style={{
          background: `radial-gradient(circle at center, ${accent} 0%, transparent 60%)`,
          opacity: 0.35,
          filter: "blur(60px)",
          willChange: "opacity, transform",
        }}
      />

      {/* 6. Filmic grain — SVG fractal noise, 7%. Stops the flat fills
            reading as vector-plastic. */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none mix-blend-overlay"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="s360-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect
          width="100%"
          height="100%"
          filter="url(#s360-grain)"
          opacity="0.07"
        />
      </svg>

      <style>{`
        @keyframes s360-breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.015); opacity: 0.95; }
        }
        .animate-s360-breathe {
          animation: s360-breathe 10s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-s360-breathe { animation: none; }
        }
      `}</style>
    </div>
  );
}

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
