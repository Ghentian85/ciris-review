import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Topbar({
  userEmail,
  isAdmin,
}: {
  userEmail?: string;
  // Owner / admin org-members get the Admin link. Pages compute this from
  // their own membership lookup and pass it in — keeps Topbar a thin
  // presentational component without extra DB hits.
  isAdmin?: boolean;
}) {
  return (
    <header className="border-b hairline bg-bg/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="CIRIS"
            className="h-5 w-auto"
          />
          <span className="text-[11px] text-muted tracking-[0.18em] uppercase">
            Review
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-muted hover:text-ink transition-colors">
            Projects
          </Link>
          <Link href="/work" className="text-muted hover:text-ink transition-colors">
            Work
          </Link>
          {isAdmin ? (
            <Link href="/admin" className="text-muted hover:text-ink transition-colors">
              Admin
            </Link>
          ) : null}
          {userEmail ? (
            <form action="/api/auth/logout" method="post" className="flex items-center gap-3">
              <span className="text-muted text-xs">{userEmail}</span>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
