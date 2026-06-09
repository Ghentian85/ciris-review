"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app/logo";

// Anonymous "I forgot my password" entry point. Always reports success so
// nothing leaks about which addresses have accounts. The reset link itself
// is sent by /api/auth/forgot — a magic-link that lands on /account/reset.
export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [devLink, setDevLink] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = await res.json().catch(() => ({}));
    if (body.devLink) setDevLink(body.devLink);
    setState("sent");
  }

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
          <h1 className="font-display text-[26px] leading-[1.1] tracking-tight">
            Reset your password
          </h1>
          <p className="text-sm text-muted mt-3">
            Type your email — we&apos;ll send you a link to pick a new one.
          </p>
        </div>

        {state === "sent" ? (
          <div className="surface p-6 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-status-approved" />
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted">
                Check your inbox
              </span>
            </div>
            <p>
              If <span className="font-medium">{email}</span> matches an
              account, a reset link is on its way.
            </p>
            {devLink ? (
              <div className="mt-4 border-t hairline pt-4">
                <p className="text-xs text-muted mb-2">
                  Dev mode — no email provider configured:
                </p>
                <a href={devLink} className="text-xs underline break-all">
                  {devLink}
                </a>
              </div>
            ) : null}
            <a
              href="/login"
              className="block text-xs text-muted hover:text-ink mt-4 underline underline-offset-4"
            >
              Back to sign in
            </a>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="surface p-6 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
              />
            </div>
            <Button
              type="submit"
              disabled={state === "sending"}
              className="w-full h-11"
            >
              {state === "sending" ? "Sending…" : "Send reset link"}
            </Button>
            <a
              href="/login"
              className="block text-center text-[11px] text-muted-soft hover:text-ink underline underline-offset-4 pt-1"
            >
              Back to sign in
            </a>
          </form>
        )}
      </div>
    </main>
  );
}
