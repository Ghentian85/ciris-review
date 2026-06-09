"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app/logo";

// WebGL shader background — loaded only on the client so three.js +
// react-three-fiber don't end up in the SSR bundle.
const LoginShader = dynamic(() => import("@/components/app/login-shader"), {
  ssr: false,
  loading: () => null,
});

type Mode = "password" | "magic";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get("next") ?? "/";

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Sign-in failed" }));
        throw new Error(body.error ?? "Sign-in failed");
      }
      // Server set the cookie; client just navigates.
      router.push(next);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setError(msg);
      setState("idle");
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
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
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Left: brand panel — shadergradient background, logo + REVIEW pair
          centered vertically with horizontal divider. Mobile collapses. */}
      <aside className="hidden lg:block relative bg-ink text-bg overflow-hidden">
        <div aria-hidden className="absolute inset-0">
          <LoginShader />
        </div>
        <div aria-hidden className="absolute inset-0 bg-black/35 pointer-events-none" />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40 pointer-events-none"
        />
        <div className="relative h-full flex items-center px-12">
          <div className="flex items-center gap-5 text-bg">
            <Logo className="h-14 w-auto" />
            <span className="text-[12px] tracking-[0.32em] uppercase font-medium opacity-70 border-l border-bg/25 pl-5">
              Review
            </span>
          </div>
        </div>
        <p className="absolute bottom-8 left-12 text-[10px] tracking-[0.2em] uppercase text-bg/40">
          A CIRIS Studio product
        </p>
      </aside>

      {/* Right: auth form */}
      <section className="grid place-items-center px-6 py-12 animate-rise">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex flex-col items-center mb-10 text-ink">
            <Logo className="h-7 w-auto" />
            <p className="text-[10px] tracking-[0.28em] uppercase font-medium text-muted mt-3">
              Review
            </p>
          </div>

          <div className="mb-8">
            <h1 className="font-display text-[32px] leading-[1.1] tracking-tight">
              Sign in
            </h1>
            <p className="text-sm text-muted mt-3">
              {mode === "password"
                ? "Use your email and password."
                : "We'll email you a one-tap sign-in link."}
            </p>
          </div>

          {state === "sent" ? (
            <SentScreen
              email={email}
              devLink={devLink}
              onReset={() => {
                setState("idle");
                setDevLink(null);
              }}
            />
          ) : mode === "password" ? (
            <form onSubmit={signInWithPassword} className="surface p-6 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@studio.com"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="/account/forgot"
                    className="text-[11px] text-muted hover:text-ink underline underline-offset-4"
                  >
                    Forgot?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                />
              </div>
              {error ? <p className="text-xs text-status-revision">{error}</p> : null}
              <Button
                type="submit"
                disabled={state === "sending"}
                className="w-full h-11"
              >
                {state === "sending" ? "Signing in…" : "Sign in"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode("magic");
                  setError(null);
                }}
                className="block w-full text-center text-[11px] text-muted-soft hover:text-ink underline underline-offset-4 pt-2"
              >
                Or email me a sign-in link
              </button>
            </form>
          ) : (
            <form onSubmit={sendMagicLink} className="surface p-6 space-y-5">
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
                <Label htmlFor="name">
                  Name <span className="text-muted-soft">(first time only)</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              {error ? <p className="text-xs text-status-revision">{error}</p> : null}
              <Button
                type="submit"
                disabled={state === "sending"}
                className="w-full h-11"
              >
                {state === "sending" ? "Sending…" : "Send sign-in link"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode("password");
                  setError(null);
                }}
                className="block w-full text-center text-[11px] text-muted-soft hover:text-ink underline underline-offset-4 pt-2"
              >
                Sign in with password instead
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function SentScreen({
  email,
  devLink,
  onReset,
}: {
  email: string;
  devLink: string | null;
  onReset: () => void;
}) {
  return (
    <div className="surface p-6 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-2 w-2 rounded-full bg-status-approved" />
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted">
          Link sent
        </span>
      </div>
      <p>
        Check <span className="font-medium">{email}</span>. The link
        expires in 30 minutes.
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
      <button
        onClick={onReset}
        className="text-xs text-muted hover:text-ink mt-4 underline underline-offset-4"
      >
        Use a different email
      </button>
    </div>
  );
}
