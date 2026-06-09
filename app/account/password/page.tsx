import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; continue?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { welcome, continue: cont } = await searchParams;

  const isWelcome = welcome === "1";
  // Only honor internal continue paths to prevent open-redirect via query.
  const safeContinue = cont && cont.startsWith("/") && !cont.startsWith("//") ? cont : "/";

  return (
    <main className="mx-auto max-w-md px-6 pt-12 pb-16 animate-rise">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {isWelcome ? "Welcome" : "Account"}
        </p>
        <h1 className="font-display text-[32px] leading-[1.1] tracking-tight">
          {isWelcome ? "Set a password" : user.passwordHash ? "Change password" : "Set a password"}
        </h1>
        <p className="text-sm text-muted mt-3">
          {isWelcome
            ? "Pick a password so signing in next time is one step. You can also skip this and keep using one-click email links."
            : user.passwordHash
              ? "Pick a new password. We'll keep you signed in on this device."
              : "Save a password so signing in doesn't always need an email round-trip."}
        </p>
      </div>

      <PasswordForm
        hasExistingPassword={!!user.passwordHash}
        isWelcome={isWelcome}
        continueTo={safeContinue}
      />
    </main>
  );
}
