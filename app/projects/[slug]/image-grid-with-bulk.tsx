"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusChip, type ImageStatus } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TabKey = "pending" | "approved" | "revision";

export type GridImg = {
  id: string;
  slotName: string;
  displayName: string | null;
  status: string;
  galleryId: string;
  galleryName: string;
  thumbPath: string | null;
  versionNumber: number;
  width: number;
  height: number;
};

export function ImageGridWithBulk({
  images,
  projectId,
  projectSlug,
  fromTab,
  canActOnStatus,
}: {
  images: GridImg[];
  projectId: string;
  projectSlug: string;
  fromTab: TabKey;
  canActOnStatus: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qs = `?from=overview&tab=${fromTab}`;
  const selectedCount = selected.size;
  const allSelected = images.length > 0 && selected.size === images.length;

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(images.map((i) => i.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function bulkSet(status: "approved" | "revision_requested") {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/bulk-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageIds: [...selected],
          status,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error ?? "Failed");
      }
      clearSelection();
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar — only when selection is non-empty */}
      {canActOnStatus && selectedCount > 0 ? (
        <div className="surface p-3 flex items-center justify-between flex-wrap gap-3 sticky top-16 z-20 bg-surface/95 backdrop-blur">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium">
              {selectedCount} selected
            </span>
            <button
              type="button"
              onClick={allSelected ? clearSelection : selectAll}
              className="text-xs text-muted hover:text-ink transition-colors"
            >
              {allSelected ? "Clear" : `Select all ${images.length}`}
            </button>
          </div>
          {error ? <p className="text-xs text-status-revision">{error}</p> : null}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => bulkSet("revision_requested")}
            >
              Needs revision · {selectedCount}
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => bulkSet("approved")}
            >
              Approve · {selectedCount}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {images.map((img) => {
          const isSelected = selected.has(img.id);
          return (
            <div
              key={img.id}
              className={cn(
                "surface p-0 overflow-hidden group transition-colors relative block",
                isSelected
                  ? "border-ink ring-2 ring-ink/30"
                  : "hover:border-ink/30"
              )}
            >
              {/* Selection checkbox — appears on hover or when this is selected */}
              {canActOnStatus ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    toggle(img.id);
                  }}
                  className={cn(
                    "absolute top-2 left-2 z-10 h-6 w-6 rounded-md border flex items-center justify-center",
                    "transition-all",
                    isSelected
                      ? "bg-ink border-ink text-bg opacity-100"
                      : "bg-surface/90 border-line text-transparent opacity-0 group-hover:opacity-100 hover:border-ink/50"
                  )}
                  aria-label={isSelected ? "Deselect" : "Select"}
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8.5l3.5 3.5L13 5" />
                  </svg>
                </button>
              ) : null}

              <Link
                href={`/projects/${projectSlug}/galleries/${img.galleryId}/images/${img.id}${qs}`}
                className="block"
              >
                <div className="aspect-[3/4] bg-line/40 relative overflow-hidden">
                  {img.thumbPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/storage/${img.thumbPath}`}
                      alt={img.displayName ?? img.slotName}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                {/* Status moved OFF the image into the info strip — no
                    visual overlap with the artwork. */}
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className="text-xs truncate flex-1 min-w-0"
                      title={img.displayName ?? img.slotName}
                    >
                      {img.displayName ?? img.slotName}
                    </p>
                    <StatusChip status={img.status as ImageStatus} size="sm" />
                  </div>
                  <p className="text-[10px] text-muted mt-1 truncate">
                    {img.galleryName}
                    {img.versionNumber > 1 ? ` · V${img.versionNumber}` : ""}
                  </p>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
