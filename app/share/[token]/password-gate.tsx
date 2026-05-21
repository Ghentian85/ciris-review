"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordGate({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/share-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error ?? "Wrong password");
      }
      // Server sets the share cookie; reload to render the protected content.
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface p-6 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="share-pw">Password</Label>
        <Input
          id="share-pw"
          type="password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <p className="text-[11px] text-muted">
          Ask the person who sent you this link for the password.
        </p>
      </div>
      {error ? <p className="text-xs text-status-revision">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={busy || !password}>
        {busy ? "Checking…" : "Unlock"}
      </Button>
    </form>
  );
}
