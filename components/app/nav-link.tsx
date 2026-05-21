"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Active-aware top-nav link, styled for the dark anthracite topbar. Active
// when pathname === href, or when href is a section root (length > 1) and
// pathname starts with it. Active = inverted (light pill on dark bg).
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const active =
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={
        "px-4 h-10 inline-flex items-center text-sm font-medium transition-colors press " +
        (active
          ? "bg-bg text-ink"
          : "text-bg/70 hover:text-bg hover:bg-bg/[0.08]")
      }
    >
      {children}
    </Link>
  );
}
