"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type UploadItem = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
};

const CONCURRENCY = 4;

export function UploadClient({
  projectId,
  projectSlug,
}: {
  projectId: string;
  projectSlug: string;
}) {
  const router = useRouter();
  // Galleries are server-side plumbing only — the upload route picks/creates
  // a gallery on its own. No need to expose a picker.
  const [mode, setMode] = useState<"v1" | "v2">("v1");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const next: UploadItem[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        status: "queued",
        progress: 0,
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

  async function uploadOne(item: UploadItem): Promise<void> {
    return new Promise((resolve) => {
      const form = new FormData();
      form.append("file", item.file);
      form.append("mode", mode);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/projects/${projectId}/upload`);
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        setItems((cur) =>
          cur.map((i) => (i.id === item.id ? { ...i, progress: pct } : i))
        );
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setItems((cur) =>
            cur.map((i) =>
              i.id === item.id ? { ...i, status: "done", progress: 100 } : i
            )
          );
        } else {
          let msg = "Upload failed";
          try {
            const body = JSON.parse(xhr.responseText) as { error?: string };
            if (body.error) msg = body.error;
          } catch {}
          setItems((cur) =>
            cur.map((i) =>
              i.id === item.id ? { ...i, status: "error", error: msg } : i
            )
          );
        }
        resolve();
      };
      xhr.onerror = () => {
        setItems((cur) =>
          cur.map((i) =>
            i.id === item.id ? { ...i, status: "error", error: "Network error" } : i
          )
        );
        resolve();
      };
      setItems((cur) =>
        cur.map((i) => (i.id === item.id ? { ...i, status: "uploading" } : i))
      );
      xhr.send(form);
    });
  }

  async function start() {
    if (items.length === 0 || running) return;
    setRunning(true);
    const queue = items.filter((i) => i.status === "queued" || i.status === "error");
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (cursor < queue.length) {
        const item = queue[cursor++];
        await uploadOne(item);
      }
    });
    await Promise.all(workers);
    setRunning(false);
    // Land back on the project overview so the user sees their uploads in the
    // status tabs immediately.
    setTimeout(() => {
      router.push(`/projects/${projectSlug}`);
      router.refresh();
    }, 600);
  }

  return (
    <div className="space-y-6">
      <div className="surface p-5">
        <Label>Mode</Label>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          <button
            type="button"
            disabled={running}
            onClick={() => setMode("v1")}
            className={cn(
              "rounded-md border px-3 py-2 text-left transition-colors",
              mode === "v1"
                ? "border-ink/40 bg-line/30"
                : "border-line hover:border-ink/20"
            )}
          >
            <p className="text-sm font-medium">New images (V1)</p>
            <p className="text-xs text-muted mt-0.5">
              Each file becomes a new image in the project.
            </p>
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => setMode("v2")}
            className={cn(
              "rounded-md border px-3 py-2 text-left transition-colors",
              mode === "v2"
                ? "border-ink/40 bg-line/30"
                : "border-line hover:border-ink/20"
            )}
          >
            <p className="text-sm font-medium">Revisions (V2+)</p>
            <p className="text-xs text-muted mt-0.5">
              Match by filename to existing images; status resets to needs review.
            </p>
          </button>
        </div>
      </div>

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
          Drop images here or <span className="underline underline-offset-4">browse</span>
        </p>
        <p className="text-xs text-muted mt-1">
          Original is preserved. Preview &amp; thumbnail are generated server-side.
        </p>
      </div>

      {items.length > 0 ? (
        <div className="surface divide-y divide-line">
          <div className="p-4 flex items-center justify-between">
            <p className="text-sm">
              {items.length} file{items.length === 1 ? "" : "s"} ·{" "}
              <span className="text-muted">
                {totals.done} done{totals.err ? ` · ${totals.err} failed` : ""}
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
              <Button
                type="button"
                disabled={running || items.length === 0}
                onClick={start}
              >
                {running ? "Uploading…" : `Upload ${items.length}`}
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
                <span className="w-28 text-right">
                  {i.status === "queued" ? (
                    <span className="text-muted">queued</span>
                  ) : i.status === "uploading" ? (
                    <span className="text-status-v2">{i.progress}%</span>
                  ) : i.status === "done" ? (
                    <span className="text-status-approved">done</span>
                  ) : (
                    <span className="text-status-revision" title={i.error}>
                      failed
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
