import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        bg: "hsl(var(--bg))",
        "bg-elev": "hsl(var(--bg-elev))",
        surface: "hsl(var(--surface))",
        ink: "hsl(var(--ink))",
        "ink-soft": "hsl(var(--ink-soft))",
        muted: "hsl(var(--muted))",
        "muted-soft": "hsl(var(--muted-soft))",
        line: "hsl(var(--line))",
        "line-soft": "hsl(var(--line-soft))",
        accent: "hsl(var(--accent))",
        "accent-soft": "hsl(var(--accent-soft))",
        ring: "hsl(var(--ring))",
        status: {
          pending: "hsl(var(--status-pending))",
          "pending-soft": "hsl(var(--status-pending-soft))",
          approved: "hsl(var(--status-approved))",
          "approved-soft": "hsl(var(--status-approved-soft))",
          notes: "hsl(var(--status-notes))",
          "notes-soft": "hsl(var(--status-notes-soft))",
          revision: "hsl(var(--status-revision))",
          "revision-soft": "hsl(var(--status-revision-soft))",
          v2: "hsl(var(--status-v2))",
          "v2-soft": "hsl(var(--status-v2-soft))",
          final: "hsl(var(--status-final))",
          "final-soft": "hsl(var(--status-final-soft))",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
        md: "var(--radius)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        soft: "var(--shadow-sm)",
        pop: "var(--shadow-md)",
        float: "var(--shadow-lg)",
        glass: "var(--shadow-glass)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
