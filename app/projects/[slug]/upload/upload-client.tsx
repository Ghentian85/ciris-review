"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type UploadItem = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "skipped" | "error";
  progress: number;
  error?: string;
  skipReason?: string;
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
    const skipped = items.filter((i) => i.status === "skipped").length;
    const err = items.filter((i) => i.status === "error").length;
    return { done, skipped, err, total: items.length };
  }, [items]);

  function setProgress(itemId: string, pct: number) {
    setItems((cur) => cur.map((i) => (i.id === itemId ? { ...i, progress: pct } : i)));
  }

  function setItemStatus(
    itemId: string,
    patch: Partial<Pick<UploadItem, "status" | "progress" | "error" | "skipReason">>
  ) {
    setItems((cur) => cur.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
  }

  function handleFinalizeBody(
    item: UploadItem,
    body: { skipped?: boolean; reason?: string }
  ) {
    if (body.skipped) {
      setItemStatus(item.id, {
        status: "skipped",
        progress: 100,
        skipReason: body.reason,
      });
    } else {
      setItemStatus(item.id, { status: "done", progress: 100 });
    }
  }

  // Direct-to-storage PUT (bypasses Vercel's 4.5 MB serverless body limit).
  // Returns true on success so the caller can finalize.
  function putToPresignedUrl(
    item: UploadItem,
    url: string,
    headers: Record<string, string> | null
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      if (headers) {
        for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
      }
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        // Reserve the last 5% for the server-side derive step so the bar
        // doesn't sit at 100% while Sharp is running.
        const pct = Math.round((e.loaded / e.total) * 95);
        setProgress(item.id, pct);
      };
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.send(item.file);
    });
  }

  // Legacy flow for dev (local FS adapter can't presign). Full file goes
  // through our own /upload route as multipart.
  function legacyMultipartUpload(item: UploadItem): Promise<void> {
    return new Promise((resolve) => {
      const form = new FormData();
      form.append("file", item.file);
      form.append("mode", mode);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/projects/${projectId}/upload`);
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        setProgress(item.id, Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            handleFinalizeBody(
              item,
              JSON.parse(xhr.responseText) as { skipped?: boolean; reason?: string }
            );
          } catch {
            setItemStatus(item.id, { status: "done", progress: 100 });
          }
        } else {
          let msg = "Upload failed";
          try {
            const body = JSON.parse(xhr.responseText) as { error?: string };
            if (body.error) msg = body.error;
          } catch {}
          setItemStatus(item.id, { status: "error", error: msg });
        }
        resolve();
      };
      xhr.onerror = () => {
        setItemStatus(item.id, { status: "error", error: "Network error" });
        resolve();
      };
      xhr.send(form);
    });
  }

  async function uploadOne(item: UploadItem): Promise<void> {
    setItemStatus(item.id, { status: "uploading", progress: 0 });

    // Step 1: ask the server for a presigned URL. If the adapter can't
    // presign (local-FS dev adapter returns uploadUrl: null), fall back
    // to the legacy multipart POST.
    let presign: {
      uploadKey: string;
      uploadUrl: string | null;
      headers: Record<string, string> | null;
    };
    try {
      const res = await fetch(`/api/projects/${projectId}/upload/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: item.file.name,
          contentType: item.file.type || "application/octet-stream",
          size: item.file.size,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setItemStatus(item.id, {
          status: "error",
          error: body.error ?? `Presign failed (${res.status})`,
        });
        return;
      }
      presign = (await res.json()) as typeof presign;
    } catch {
      setItemStatus(item.id, { status: "error", error: "Network error (presign)" });
      return;
    }

    if (!presign.uploadUrl) {
      return legacyMultipartUpload(item);
    }

    // Step 2: PUT the raw bytes directly to R2.
    const putOk = await putToPresignedUrl(
      item,
      presign.uploadUrl,
      presign.headers
    );
    if (!putOk) {
      setItemStatus(item.id, { status: "error", error: "Upload to storage failed" });
      return;
    }

    // Step 3: tell the server to derive preview+thumb and write the row.
    try {
      const res = await fetch(`/api/projects/${projectId}/upload/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadKey: presign.uploadKey,
          filename: item.file.name,
          mode,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        skipped?: boolean;
        reason?: string;
        error?: string;
      };
      if (!res.ok) {
        setItemStatus(item.id, {
          status: "error",
          error: body.error ?? `Finalize failed (${res.status})`,
        });
        return;
      }
      handleFinalizeBody(item, body);
    } catch {
      setItemStatus(item.id, { status: "error", error: "Network error (finalize)" });
    }
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
              Only new slots are uploaded. Files matching existing slots are skipped.
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
                {totals.done} done
                {totals.skipped ? ` · ${totals.skipped} skipped` : ""}
                {totals.err ? ` · ${totals.err} failed` : ""}
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
                  ) : i.status === "skipped" ? (
                    <span className="text-muted-soft" title={i.skipReason}>
                      skipped
                    </span>
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
