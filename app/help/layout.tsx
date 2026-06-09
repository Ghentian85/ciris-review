import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/app/logo";

// Layout for /help and its sub-routes. If the visitor is signed in, the
// root SiteFrame already mounts the full topbar — we add nothing. If
// they're anonymous, we render a minimal anthracite header with logo +
// "Sign in" CTA so the page still feels like part of the product.
export default async function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <>
      {user ? null : (
        <header className="sticky top-0 z-30 bg-ink text-bg">
          <div className="mx-auto max-w-7xl px-5 h-16 flex items-center justify-between gap-4">
            <Link
              href="/help"
              className="inline-flex items-center gap-3 h-10 pl-1 pr-3 hover:bg-white/[0.06] press text-white"
              aria-label="CIRIS Review home"
            >
              <Logo />
              <span className="hidden sm:inline text-[10px] tracking-[0.28em] uppercase font-medium opacity-60 border-l border-white/20 pl-3 ml-1">
                Help
              </span>
            </Link>
            <Link
              href="/login"
              className="press inline-flex items-center h-9 px-4 text-sm font-medium bg-bg text-ink hover:bg-white"
            >
              Sign in
            </Link>
          </div>
        </header>
      )}
      {children}
    </>
  );
}
