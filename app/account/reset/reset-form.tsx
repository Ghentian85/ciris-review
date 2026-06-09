"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Reset-password client form. Reuses /api/auth/set-password without a
// current-password because the magic-link sign-in already proved identity.
// The set-password endpoint accepts that (currentPassword is optional when
// the user has no existing hash, but for reset we always pass through and
// the server-side hash gets overwritten regardless).
export function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setState("saving");
    // Reset flow doesn't carry the old password. The set-password route
    // requires currentPassword when one exists — to support reset, the
    // server treats the magic-link session as sufficient proof for any
    // user who arrived via /account/reset. We just send password.
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Failed" }));
      setError(body.error ?? "Failed");
      setState("idle");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="surface p-6 space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          required
          autoFocus
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 10 characters"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error ? <p className="text-xs text-status-revision">{error}</p> : null}
      <Button type="submit" disabled={state === "saving"} className="w-full h-11">
        {state === "saving" ? "Saving…" : "Save and sign in"}
      </Button>
    </form>
  );
}
