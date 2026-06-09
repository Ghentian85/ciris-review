"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Set OR change password — same form. When the user has an existing
// password we require current-password proof; first-time set skips it
// (their session is already auth proof). After success we land on the
// `continueTo` path (project after invite-accept, or "/" otherwise).
export function PasswordForm({
  hasExistingPassword,
  isWelcome,
  continueTo,
}: {
  hasExistingPassword: boolean;
  isWelcome: boolean;
  continueTo: string;
}) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
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
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          currentPassword: hasExistingPassword ? currentPassword : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error ?? "Failed");
      }
      router.push(continueTo);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
      setState("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} className="surface p-6 space-y-5">
      {hasExistingPassword ? (
        <div className="space-y-1.5">
          <Label htmlFor="current">Current password</Label>
          <Input
            id="current"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="password">
          {hasExistingPassword ? "New password" : "Password"}
        </Label>
        <Input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          autoFocus={!hasExistingPassword}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 10 characters"
        />
        <p className="text-[11px] text-muted-soft pt-1">
          Tip: a short phrase you can remember is stronger than a random string.
        </p>
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
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={state === "saving"} className="flex-1 h-11">
          {state === "saving"
            ? "Saving…"
            : hasExistingPassword
              ? "Update password"
              : "Save password"}
        </Button>
        {isWelcome ? (
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => router.push(continueTo)}
          >
            Skip
          </Button>
        ) : null}
      </div>
    </form>
  );
}
