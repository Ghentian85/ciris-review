import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/app/logo";
import { ResetForm } from "./reset-form";

// Landing page for the password reset magic-link. The verify route signed
// the recipient in before they landed here, so we only render if there's a
// session. Otherwise redirect to /login — happens if someone bookmarks the
// URL or copies it without the token.
export default async function ResetPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen grid place-items-center px-6 py-12 animate-rise">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10 text-ink">
          <Logo className="h-7 w-auto" />
          <p className="text-[10px] tracking-[0.28em] uppercase font-medium text-muted mt-3">
            Review
          </p>
        </div>

        <div className="mb-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted mb-3 flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Reset
          </p>
          <h1 className="font-display text-[26px] leading-[1.1] tracking-tight">
            Pick a new password
          </h1>
          <p className="text-sm text-muted mt-3">
            For <span className="font-medium text-ink">{user.email}</span>.
          </p>
        </div>

        <ResetForm />
      </div>
    </main>
  );
}
