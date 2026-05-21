"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SubmitRoundButton({
  projectId,
  roundNumber,
  counts,
}: {
  projectId: string;
  roundNumber: number;
  counts: { approved: number; revision: number };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/submit-round`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error ?? "Failed");
      }
      setConfirming(false);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <div className="flex items-center gap-2">
        {error ? <p className="text-xs text-status-revision">{error}</p> : null}
        <Button onClick={() => setConfirming(true)}>Submit Round {roundNumber}</Button>
      </div>
    );
  }

  return (
    <div className="surface p-4 bg-bg w-full max-w-sm">
      <p className="text-sm">
        Submit Round {roundNumber} feedback?
      </p>
      <p className="text-xs text-muted mt-1">
        {counts.approved} approved · {counts.revision} need revision. The post-prod team
        receives one digest email.
      </p>
      {error ? <p className="text-xs text-status-revision mt-2">{error}</p> : null}
      <div className="flex items-center justify-end gap-2 mt-3">
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? "Submitting…" : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
