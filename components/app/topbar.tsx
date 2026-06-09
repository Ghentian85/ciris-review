import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NavLink } from "./nav-link";
import { Logo } from "./logo";

// Three-zone layout: logo left, primary nav perfectly centered, account
// actions right. Grid with 1fr / auto / 1fr keeps center cell centered
// regardless of left/right widths.
export function Topbar({
  userEmail,
  isAdmin,
}: {
  userEmail?: string;
  // Owner / admin org-members get the Admin link. Resolved server-side in
  // the root layout so the topbar stays a thin presentational component.
  isAdmin?: boolean;
}) {
  const initial = userEmail?.[0]?.toUpperCase() ?? "·";
  return (
    <header className="sticky top-0 z-30 bg-ink/95 backdrop-blur-md text-bg shadow-pop">
      <div className="mx-auto max-w-7xl px-5 h-16 grid grid-cols-[1fr_auto_1fr] items-center gap-6">
        {/* ── Left: logo (pure white, square hit area) ─────── */}
        <Link
          href="/"
          className="justify-self-start inline-flex items-center gap-3 h-10 pl-1 pr-3 hover:bg-white/[0.06] press text-white"
          aria-label="CIRIS Review home"
        >
          <Logo />
          <span className="hidden sm:inline text-[10px] tracking-[0.28em] uppercase font-medium opacity-60 border-l border-white/20 pl-3 ml-1">
            Review
          </span>
        </Link>

        {/* ── Center: primary nav ──────────────────────────── */}
        <nav className="justify-self-center flex items-center gap-1">
          <NavLink href="/">Projects</NavLink>
          <NavLink href="/work">Work</NavLink>
          {isAdmin ? <NavLink href="/admin">Admin</NavLink> : null}
        </nav>

        {/* ── Right: account (square avatar → /account/password) ──── */}
        <div className="justify-self-end flex items-center gap-2">
          {userEmail ? (
            <>
              <Link
                href="/account/password"
                className="hidden md:flex items-center gap-2 h-10 pl-2 pr-3 hover:bg-white/[0.06] press"
                title={`Signed in as ${userEmail} — manage password`}
              >
                <span className="h-7 w-7 bg-bg text-ink grid place-items-center text-[11px] font-semibold uppercase">
                  {initial}
                </span>
                <span className="text-xs max-w-[200px] truncate text-bg/70">
                  {userEmail}
                </span>
              </Link>
              <form action="/api/auth/logout" method="post">
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="border-bg/20 bg-bg/0 text-bg hover:bg-bg/10 hover:border-bg/30"
                >
                  Sign out
                </Button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
