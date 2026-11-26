"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// Studio-mode only. Flips releasedAt on every image still held in the
// internal review tier (releasedAt === null), making them visible to the
// client-reviewer role. After this, "Notify client" sends the actual email.
export function ReleaseToClientButton({
  projectId,
  count,
}: {
  projectId: string;
  count: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function release() {
    if (busy) return;
    if (!confirm(`Release ${count} image${count === 1 ? "" : "s"} to client reviewers? They'll see the images once released.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/release-to-client`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        onClick={release}
        disabled={busy}
        variant="outline"
        className="border-accent/40 text-accent hover:bg-accent-soft/60 hover:border-accent"
      >
        {busy ? "Releasing…" : `Release ${count} to client`}
      </Button>
      {error ? (
        <span className="text-xs text-status-revision" title={error}>
          failed
        </span>
      ) : null}
    </div>
  );
}
