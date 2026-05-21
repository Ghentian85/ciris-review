"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function NotifyClientButton({
  projectId,
  roundNumber,
  isFirstRound,
}: {
  projectId: string;
  roundNumber: number;
  isFirstRound: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedMessage, setDebouncedMessage] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    setDebouncedMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/notify-client`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        debounced?: boolean;
        message?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Failed");
      if (body.debounced) {
        setDebouncedMessage(body.message ?? "Already opened recently.");
      }
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const label = isFirstRound
    ? "Send to client"
    : `Notify client — Round ${roundNumber} ready`;

  return (
    <div className="flex items-center gap-2">
      {error ? <p className="text-xs text-status-revision">{error}</p> : null}
      {debouncedMessage ? (
        <p className="text-xs text-muted">{debouncedMessage}</p>
      ) : null}
      <Button onClick={go} disabled={busy}>
        {busy ? "Sending…" : label}
      </Button>
    </div>
  );
}
