import Link from "next/link";

export default function InvitePending() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="surface p-8 max-w-sm text-center">
        <h1 className="font-medium text-lg mb-2">Check your email</h1>
        <p className="text-sm text-muted mb-6">
          You've been invited to a project. Click the link in your invitation email to accept and get started.
        </p>
        <p className="text-xs text-muted">
          Already accepted?{" "}
          <Link href="/" className="underline hover:text-ink">
            Go to projects
          </Link>
        </p>
      </div>
    </main>
  );
}
