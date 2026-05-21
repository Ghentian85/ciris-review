"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProjectInfo = {
  id: string;
  slug: string;
  name: string;
  status: string;
  clientName: string | null;
  updatedAt: string;
  galleryCount: number;
  memberCount: number;
  roundCount: number;
  imageCount: number;
};

export function ProjectAdminRow({
  project,
  canDelete,
}: {
  project: ProjectInfo;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isArchived = project.status === "archived";

  async function setStatus(status: "active" | "archived") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error ?? "Failed");
      }
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error ?? "Failed");
      }
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <div className={cn("p-3 grid grid-cols-[1fr_auto] gap-3 items-center", isArchived && "opacity-60")}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${project.slug}`}
            className="font-medium hover:underline underline-offset-4 truncate"
          >
            {project.name}
          </Link>
          {isArchived ? (
            <span className="text-[10px] uppercase tracking-wide bg-line/60 text-muted px-2 py-0.5 rounded-full">
              Archived
            </span>
          ) : null}
        </div>
        <p className="text-[11px] text-muted mt-0.5">
          {project.clientName ?? "Internal"} ·{" "}
          {project.imageCount} image{project.imageCount === 1 ? "" : "s"} ·{" "}
          {project.memberCount} member{project.memberCount === 1 ? "" : "s"} ·{" "}
          {project.roundCount} round{project.roundCount === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {error ? <p className="text-xs text-status-revision">{error}</p> : null}
        {confirmDelete ? (
          <>
            <span className="text-xs text-status-revision">Delete forever?</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={doDelete}
              disabled={busy}
              className="bg-status-revision hover:bg-status-revision/90"
            >
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </>
        ) : (
          <>
            {isArchived ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatus("active")}
                disabled={busy}
              >
                Unarchive
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatus("archived")}
                disabled={busy}
              >
                Archive
              </Button>
            )}
            {canDelete ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="text-muted hover:text-status-revision"
              >
                Delete
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
