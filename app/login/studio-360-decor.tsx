"use client";

import { Logo } from "@/components/app/logo";

// Decorative pieces specific to Studio 360's sign-in panel. Lifted out
// of login-client.tsx so the login file stays legible — this one owns
// the brand shapes, the slow 360° rotation, the grain, and the hover-
// animated "Powered by CIRIS" lockup.

export function Studio360Backdrop({ accent }: { accent: string }) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* Big yellow radial glow lower-right — warms the panel. */}
      <div
        className="absolute -right-40 -bottom-56 h-[720px] w-[720px] rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle at center, ${accent} 0%, transparent 60%)`,
          opacity: 0.32,
          filter: "blur(40px)",
        }}
      />

      {/* Second, smaller spotlight upper-right — asymmetric so the page
          doesn't feel centred. */}
      <div
        className="absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle at center, ${accent} 0%, transparent 65%)`,
          opacity: 0.12,
          filter: "blur(30px)",
        }}
      />

      {/* Slow-rotating 360° protractor — the brand's core visual idea
          made literal. SVG sits in the centre-left, large enough to
          read as structure, light enough to never compete with type. */}
      <svg
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-rotate-slow"
        width="860"
        height="860"
        viewBox="0 0 860 860"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="s360-ring-fade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="0" />
            <stop offset="85%" stopColor={accent} stopOpacity="0.5" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer hairline ring */}
        <circle
          cx="430"
          cy="430"
          r="400"
          stroke={accent}
          strokeOpacity="0.18"
          strokeWidth="1"
        />
        {/* Inner ring, fades in/out through its arc */}
        <circle
          cx="430"
          cy="430"
          r="370"
          stroke="url(#s360-ring-fade)"
          strokeWidth="1"
        />

        {/* 360 tick-marks — one per degree. Rendered via SVG <g> with
            rotation transforms. Every 10th tick is longer so you read
            the full protractor. */}
        <g>
          {Array.from({ length: 72 }).map((_, i) => {
            const angle = (i / 72) * 360;
            const isMajor = i % 3 === 0; // every 15°
            const len = isMajor ? 18 : 8;
            const stroke = isMajor ? 0.22 : 0.12;
            return (
              <line
                key={i}
                x1="430"
                y1="18"
                x2="430"
                y2={18 + len}
                stroke={accent}
                strokeOpacity={stroke}
                strokeWidth="1"
                transform={`rotate(${angle} 430 430)`}
              />
            );
          })}
        </g>

        {/* The signature yellow arc at the top — their degree-mark dot
            made bigger, orbiting slowly as the whole SVG spins. */}
        <circle cx="430" cy="30" r="12" fill={accent} opacity="0.85" />
      </svg>

      {/* Filmic grain — SVG fractal noise, blended multiply at 6%. Cheap,
          scales with viewport, stops the flat black reading as plastic. */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="s360-noise">
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
          filter="url(#s360-noise)"
          opacity="0.06"
        />
      </svg>

      {/* Vignette — darkens the edges by a hair so the glow pops. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      <style>{`
        @keyframes s360-rotate-slow {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .animate-rotate-slow {
          animation: s360-rotate-slow 120s linear infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-rotate-slow { animation: none; }
        }
      `}</style>
    </div>
  );
}

// Hover-animated CIRIS wordmark for the panel's lower-left footer.
// On hover: a yellow sheen sweeps across the logo + the whole lockup
// lifts by a pixel. Reduced-motion users get a static glow.
export function PoweredByCirisMark({ accent }: { accent: string }) {
  return (
    <a
      href="https://ciris.studio"
      target="_blank"
      rel="noopener"
      className="group absolute bottom-8 left-12 inline-flex items-center gap-3 text-bg/55 hover:text-bg transition-colors"
      aria-label="Powered by CIRIS — visit ciris.studio"
    >
      <span className="text-[10px] tracking-[0.24em] uppercase font-medium">
        Powered by
      </span>
      <span className="relative inline-block overflow-hidden">
        <Logo className="h-5 w-auto fill-current transition-transform duration-300 group-hover:-translate-y-[1px]" />
        {/* Sheen bar — transparent → accent → transparent, mask-clipped
            to the logo width. Sits off-screen left and slides right on
            hover, like a glossy edge catching light. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full opacity-0 group-hover:translate-x-full group-hover:opacity-100"
          style={{
            background: `linear-gradient(110deg, transparent 20%, ${accent} 50%, transparent 80%)`,
            mixBlendMode: "screen",
            transition: "transform 900ms ease, opacity 900ms ease",
          }}
        />
      </span>
    </a>
  );
}
