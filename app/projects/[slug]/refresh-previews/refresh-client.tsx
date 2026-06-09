"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Each row is one source file the user dropped. Status flips through the
// pipeline; on success we surface the matched slot so the user can spot
// rename mishaps quickly.
type Item = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  matchedSlot?: string;
  error?: string;
};

const CONCURRENCY = 4;

export function RefreshClient({
  projectId,
  projectSlug,
}: {
  projectId: string;
  projectSlug: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const next: Item[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        status: "queued",
      });
    }
    setItems((cur) => [...cur, ...next]);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const totals = useMemo(() => {
    const done = items.filter((i) => i.status === "done").length;
    const err = items.filter((i) => i.status === "error").length;
    return { done, err, total: items.length };
  }, [items]);

  async function refreshOne(item: Item): Promise<void> {
    setItems((cur) =>
      cur.map((i) => (i.id === item.id ? { ...i, status: "uploading" } : i))
    );
    try {
      const form = new FormData();
      form.append("file", item.file);
      const res = await fetch(`/api/projects/${projectId}/refresh-preview`, {
        method: "POST",
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        slot?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setItems((cur) =>
        cur.map((i) =>
          i.id === item.id
            ? { ...i, status: "done", matchedSlot: body.slot }
            : i
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setItems((cur) =>
        cur.map((i) => (i.id === item.id ? { ...i, status: "error", error: msg } : i))
      );
    }
  }

  async function start() {
    if (items.length === 0 || running) return;
    setRunning(true);
    const queue = items.filter((i) => i.status === "queued" || i.status === "error");
    let cursor = 0;
    const workers = Array.from(
      { length: Math.min(CONCURRENCY, queue.length) },
      async () => {
        while (cursor < queue.length) {
          const item = queue[cursor++];
          await refreshOne(item);
        }
      }
    );
    await Promise.all(workers);
    setRunning(false);
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "surface p-12 text-center cursor-pointer transition-colors",
          dragging ? "border-ink/40 bg-line/20" : "hover:border-ink/20"
        )}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <p className="text-sm">
          Drop the original source files here or{" "}
          <span className="underline underline-offset-4">browse</span>
        </p>
        <p className="text-xs text-muted mt-1">
          Filenames must match existing slots. Files without a match are reported as errors.
        </p>
      </div>

      {items.length > 0 ? (
        <div className="surface divide-y divide-line">
          <div className="p-4 flex items-center justify-between">
            <p className="text-sm">
              {items.length} file{items.length === 1 ? "" : "s"} ·{" "}
              <span className="text-muted">
                {totals.done} refreshed{totals.err ? ` · ${totals.err} failed` : ""}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={running}
                onClick={() => setItems([])}
              >
                Clear
              </Button>
              {totals.done > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    router.push(`/projects/${projectSlug}`);
                    router.refresh();
                  }}
                >
                  Back to project
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={running || items.length === 0}
                onClick={start}
              >
                {running ? "Refreshing…" : `Refresh ${items.length}`}
              </Button>
            </div>
          </div>
          <ul className="max-h-[420px] overflow-y-auto">
            {items.map((i) => (
              <li
                key={i.id}
                className="px-4 py-2 flex items-center justify-between text-xs gap-3"
              >
                <span className="truncate flex-1">{i.file.name}</span>
                <span className="text-muted tabular-nums w-16 text-right">
                  {(i.file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <span className="w-40 text-right">
                  {i.status === "queued" ? (
                    <span className="text-muted">queued</span>
                  ) : i.status === "uploading" ? (
                    <span className="text-status-v2">refreshing…</span>
                  ) : i.status === "done" ? (
                    <span className="text-status-approved">
                      ✓ {i.matchedSlot ?? "done"}
                    </span>
                  ) : (
                    <span className="text-status-revision" title={i.error}>
                      {i.error?.slice(0, 30) ?? "failed"}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
