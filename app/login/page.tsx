"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    setDevLink(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error ?? "Failed to send link");
      }
      const body = await res.json();
      if (body.devLink) setDevLink(body.devLink);
      setState("sent");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send link";
      setError(msg);
      setState("error");
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto h-6 w-6 rounded-sm bg-ink mb-4" />
          <h1 className="text-lg font-medium tracking-tight">CIRIS Review</h1>
          <p className="text-sm text-muted mt-1">Sign in to continue</p>
        </div>

        {state === "sent" ? (
          <div className="surface p-6 text-sm">
            <p>
              A sign-in link has been sent to <span className="font-medium">{email}</span>. It
              expires in 30 minutes.
            </p>
            {devLink ? (
              <div className="mt-4 border-t hairline pt-4">
                <p className="text-xs text-muted mb-2">Dev mode (no email provider configured):</p>
                <a href={devLink} className="text-xs underline break-all">
                  {devLink}
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="surface p-6 space-y-4">
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
            <div className="space-y-1.5">
              <Label htmlFor="name">Name (first time only)</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            {error ? <p className="text-xs text-status-revision">{error}</p> : null}
            <Button type="submit" disabled={state === "sending"} className="w-full">
              {state === "sending" ? "Sending…" : "Send sign-in link"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
