"use client";

import { usePathname } from "next/navigation";
import { Topbar } from "./topbar";

// Hide the topbar on auth-less / external / first-touch routes. Everything
// else gets the shared topbar mounted in the root layout — so it never
// remounts when navigating between authenticated pages.
//
// /account/forgot and /account/reset are anonymous-style flows (no project
// nav makes sense), so we hide the chrome there too. /account/password
// (logged-in change-password) still gets the topbar — it's a normal page.
const HIDDEN_PREFIXES = [
  "/login",
  "/share",
  "/invite",
  "/account/forgot",
  "/account/reset",
];

export function SiteFrame({
  user,
  isAdmin,
  children,
}: {
  user: { email: string } | null;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const hideTopbar =
    !user || HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  return (
    <>
      {hideTopbar ? null : <Topbar userEmail={user!.email} isAdmin={isAdmin} />}
      {children}
    </>
  );
}
