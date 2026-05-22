"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnnotationLayer } from "./annotation-layer";
import { PendingPopover } from "./pending-popover";
import { useFullscreen } from "./fullscreen-shell";
import { StatusChip, type ImageStatus } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  Annotation,
  CompareData,
  Comment,
  ImageInfo,
  PendingDraft,
  Role,
  SiblingView,
  Tool,
  VersionEntry,
} from "./types";

type Props = {
  image: ImageInfo;
  initialComments: Comment[];
  siblings: SiblingView[];
  versions: VersionEntry[];
  // True when the active version is not the image's current version. In that
  // mode the reviewer is read-only: no annotating, no status changes, no
  // pending popovers — the user is browsing history.
  isHistory: boolean;
  // Non-null when comparing two versions side-by-side. The active version is
  // the right stage; `compare` is the left. Annotation tools + decision are
  // hidden in compare mode — it's a pure visual reference.
  compare: CompareData | null;
  prevHref: string | null;
  nextHref: string | null;
  galleryHref: string;
  galleryName: string;
  position: { index: number; total: number };
  role: Role;
  userId: string;
};

export function Reviewer(props: Props) {
  const {
    image,
    initialComments,
    siblings,
    versions,
    isHistory,
    compare,
    prevHref,
    nextHref,
    galleryHref,
    galleryName,
    position,
    role,
    userId,
  } = props;

  const router = useRouter();
  const { fullscreen, enterFullscreen, exitFullscreen } = useFullscreen();

  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [tool, setTool] = useState<Tool>("pin");
  const [pending, setPending] = useState<PendingDraft | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applyToSubject, setApplyToSubject] = useState(false);

  // Zoom + pan. transform-origin "0 0" so a pure (translate, scale) pair has
  // a single predictable focal anchor: the image's natural top-left.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    panX: number;
    panY: number;
  } | null>(null);

  // Reset zoom/pan when navigating to a different image.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [image.id]);

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 8;

  function zoomBy(factor: number, focalClientX?: number, focalClientY?: number) {
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
    if (Math.abs(newZoom - zoom) < 0.001) return;
    if (newZoom === ZOOM_MIN) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const inner = innerRef.current;
    if (focalClientX !== undefined && focalClientY !== undefined && inner) {
      // rect.left/width reflect the *current* transform. With origin 0,0
      // and translate-then-scale, naturalLeft = rect.left - 0 (scale doesn't
      // shift origin) and naturalWidth = rect.width / zoom. The shortcut:
      // shifting panX by (cx - rect.left) * (1 - newZoom/zoom) keeps the
      // focal pixel under the cursor.
      const rect = inner.getBoundingClientRect();
      const relX = focalClientX - rect.left;
      const relY = focalClientY - rect.top;
      const f = newZoom / zoom;
      setPan({
        x: pan.x + relX * (1 - f),
        y: pan.y + relY * (1 - f),
      });
    }
    setZoom(newZoom);
  }

  function resetZoom() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function onStageWheel(e: React.WheelEvent) {
    // Mac trackpad pinch generates wheel events with ctrlKey=true, so the
    // same Cmd/Ctrl path catches both browser zoom shortcuts and pinch.
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomBy(factor, e.clientX, e.clientY);
  }

  function onStagePointerDown(e: React.PointerEvent) {
    // Only pan when in cursor tool and zoomed in. Annotation tools still
    // own pointer events at the SVG layer; markers stay clickable via the
    // dedicated [data-marker] elements below.
    if (tool !== "cursor" || zoom === 1) return;
    if ((e.target as Element).closest?.("[data-stop-pan]")) return;
    setPanning(true);
    panStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // Capture may fail mid-gesture in some browsers; pan still works.
    }
  }

  function onStagePointerMove(e: React.PointerEvent) {
    if (!panning || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.pointerX;
    const dy = e.clientY - panStartRef.current.pointerY;
    setPan({
      x: panStartRef.current.panX + dx,
      y: panStartRef.current.panY + dy,
    });
  }

  function onStagePointerUp() {
    setPanning(false);
    panStartRef.current = null;
  }

  const isCompareMode = compare !== null;
  const canChangeStatus = role !== "post_production" && !isHistory && !isCompareMode;
  const canAnnotate = !isHistory && !isCompareMode;

  // When viewing history, force the cursor tool so the user can't even try to
  // annotate. Stays in cursor mode for the lifetime of the history view.
  useEffect(() => {
    if (isHistory && tool !== "cursor") setTool("cursor");
  }, [isHistory, tool]);

  // Optimistic status — flashes the just-clicked pill to its active state
  // before the server roundtrip. Cleared whenever the server-confirmed
  // image.status prop updates.
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  useEffect(() => {
    setOptimisticStatus(null);
  }, [image.status]);
  const effectiveStatus = optimisticStatus ?? image.status;
  const isApprovedActive =
    effectiveStatus === "approved" ||
    effectiveStatus === "approved_with_notes" ||
    effectiveStatus === "final";
  const isRevisionActive = effectiveStatus === "revision_requested";

  // Sync state with prop changes (e.g., after router.refresh)
  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  const pinNumberById = useMemo(() => {
    const map: Record<string, number> = {};
    comments.forEach((c, i) => {
      map[c.id] = i + 1;
    });
    return map;
  }, [comments]);

  const annotations = useMemo<Annotation[]>(
    () => comments.flatMap((c) => c.annotations),
    [comments]
  );

  // ─── Keyboard ────────────────────────────────────────────────────────────
  // Real OS Fullscreen state + enter/exitFullscreen come from the
  // <FullscreenShell> in the images-level layout, so they survive navigations
  // between sibling images.
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
      }
      if (e.key === "ArrowLeft" && prevHref) {
        e.preventDefault();
        router.push(prevHref);
      } else if (e.key === "ArrowRight" && nextHref) {
        e.preventDefault();
        router.push(nextHref);
      } else if (e.key === "v" || e.key === "V") {
        setTool("cursor");
      } else if (!isHistory && (e.key === "p" || e.key === "P")) {
        setTool("pin");
      } else if (!isHistory && (e.key === "r" || e.key === "R")) {
        setTool("rect");
      } else if (!isHistory && (e.key === "d" || e.key === "D")) {
        setTool("draw");
      } else if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) void exitFullscreen();
        else void enterFullscreen();
      } else if (e.key === "+" || e.key === "=") {
        // = is unshifted + on US keyboards; accept both.
        e.preventDefault();
        zoomBy(1.25);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomBy(1 / 1.25);
      } else if (e.key === "0") {
        e.preventDefault();
        resetZoom();
      } else if (e.key === "Escape" && pending) {
        // Cancel a pending annotation. (Esc to exit fullscreen is handled by
        // the browser itself.)
        setPending(null);
      }
    },
    // zoomBy/resetZoom close over zoom + pan; we need to refresh the handler
    // when those change so the math stays correct.
    [prevHref, nextHref, router, pending, zoom, pan, isHistory]
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  useEffect(() => {
    if (prevHref) router.prefetch(prevHref);
    if (nextHref) router.prefetch(nextHref);
  }, [prevHref, nextHref, router]);

  // ─── Server actions ──────────────────────────────────────────────────────
  const handleCommit = useCallback(
    (draft: PendingDraft) => {
      // Read-only on history: ignore annotation attempts. AnnotationLayer
      // already disables the SVG capture layer for cursor tool, this is just
      // a belt-and-suspenders guard.
      if (isHistory) return;
      setPending(draft);
    },
    [isHistory]
  );

  async function savePending(body: string, visibility: "client" | "internal") {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/images/${image.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          visibility,
          annotations: [{ shape: pending.kind, geom: pending.geom }],
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as { comment: Omit<Comment, "replies" | "parentId"> };
      // New top-level comment: no replies yet, parentId null.
      setComments((cur) => [...cur, { ...json.comment, parentId: null, replies: [] }]);
      setPending(null);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function editComment(commentId: string, body: string) {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) return;
    const json = (await res.json()) as { comment: Omit<Comment, "replies" | "parentId"> };
    // Preserve existing replies on the parent — the PATCH response only carries
    // the comment row itself, not its thread.
    setComments((cur) =>
      cur.map((c) =>
        c.id === commentId
          ? { ...json.comment, parentId: c.parentId, replies: c.replies }
          : c
      )
    );
  }

  async function deleteComment(commentId: string) {
    const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    if (!res.ok) return;
    setComments((cur) => cur.filter((c) => c.id !== commentId));
    if (activeCommentId === commentId) setActiveCommentId(null);
  }

  // Post-prod / admin / internal_reviewer can mark feedback "done" once
  // they've addressed it. Optimistic flip; rolls back on API failure.
  async function toggleResolved(commentId: string, next: boolean) {
    setComments((cur) =>
      cur.map((c) =>
        c.id === commentId
          ? { ...c, resolvedAt: next ? new Date().toISOString() : null }
          : c
      )
    );
    const res = await fetch(`/api/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: next }),
    });
    if (!res.ok) {
      // Rollback
      setComments((cur) =>
        cur.map((c) =>
          c.id === commentId
            ? { ...c, resolvedAt: next ? null : new Date().toISOString() }
            : c
        )
      );
    }
  }

  async function replyToComment(parentId: string, body: string) {
    const res = await fetch(`/api/images/${image.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, parentId }),
    });
    if (!res.ok) return;
    const json = (await res.json()) as {
      comment: {
        id: string;
        body: string;
        visibility: string;
        createdAt: string;
        parentId: string;
        author: { id: string; email: string; name: string | null };
      };
    };
    // Append reply to the parent comment's replies list.
    setComments((cur) =>
      cur.map((c) =>
        c.id === parentId
          ? {
              ...c,
              replies: [
                ...c.replies,
                {
                  id: json.comment.id,
                  body: json.comment.body,
                  visibility: json.comment.visibility as "client" | "internal",
                  createdAt: json.comment.createdAt,
                  parentId,
                  author: json.comment.author,
                },
              ],
            }
          : c
      )
    );
  }

  function canEditComment(commentId: string) {
    const c = comments.find((x) => x.id === commentId);
    if (!c) return false;
    return c.author.id === userId || role === "admin";
  }
  function canDeleteComment(commentId: string) {
    return canEditComment(commentId);
  }

  async function changeStatus(status: ImageStatus) {
    // Optimistic: flip the pill state instantly so the click feels alive.
    // On error we revert; on success the server-confirmed status arrives via
    // router.refresh() and the effect above clears the optimistic flag.
    setOptimisticStatus(status);
    setBusy(true);
    try {
      const res = await fetch(`/api/images/${image.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, applyToSubject }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setOptimisticStatus(null);
        throw new Error(body.error ?? "Failed");
      }
      router.refresh();
    } catch (err) {
      console.error(err);
      setOptimisticStatus(null);
    } finally {
      setBusy(false);
    }
  }

  const previewUrl = `/api/storage/${image.previewPath}`;

  // ─── Image stage (shared between compact and fullscreen) ─────────────────
  // Cursor hint for the stage when panning is available
  const stageCursor =
    tool === "cursor" && zoom > 1 ? (panning ? "grabbing" : "grab") : undefined;

  const stage = (
    <div
      ref={stageRef}
      onWheel={onStageWheel}
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onPointerUp={onStagePointerUp}
      onPointerCancel={onStagePointerUp}
      className="relative flex items-center justify-center w-full h-full bg-[#0c0c0c] overflow-hidden"
      style={stageCursor ? { cursor: stageCursor } : undefined}
    >
      <div
        ref={innerRef}
        className="relative"
        style={{
          aspectRatio: `${image.width} / ${image.height}`,
          maxWidth: "100%",
          maxHeight: "100%",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          // No transition during an active drag so panning feels 1:1; otherwise
          // a short ease smooths the +/-/reset button clicks.
          transition: panning ? "none" : "transform 120ms ease-out",
          willChange: "transform",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={image.displayName ?? image.slotName}
          className="block w-full h-full"
          style={{ objectFit: "fill" }}
          draggable={false}
        />
        <AnnotationLayer
          annotations={annotations}
          comments={comments}
          pinNumberById={pinNumberById}
          tool={tool}
          activeCommentId={activeCommentId}
          onActivate={setActiveCommentId}
          onCommit={handleCommit}
          canEditComment={canEditComment}
          canDeleteComment={canDeleteComment}
          onEditComment={editComment}
          onDeleteComment={deleteComment}
          onReplyComment={replyToComment}
          role={role}
        />
        {pending ? (
          <PendingPopover
            pending={pending}
            number={comments.length + 1}
            role={role}
            busy={busy}
            onSave={savePending}
            onCancel={() => setPending(null)}
          />
        ) : null}
      </div>
      {/* Floating zoom controls — bottom-right of the stage */}
      <div
        data-stop-pan
        className="absolute bottom-3 right-3 z-20 surface bg-surface/95 backdrop-blur p-1 inline-flex items-center gap-0.5 text-xs"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.25)}
          disabled={zoom <= ZOOM_MIN + 0.001}
          className="h-7 w-7 inline-flex items-center justify-center rounded-sm hover:bg-line/40 disabled:opacity-30 disabled:pointer-events-none"
          title="Zoom out (−)"
          aria-label="Zoom out"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 8h10" />
          </svg>
        </button>
        <button
          type="button"
          onClick={resetZoom}
          disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
          className="h-7 px-2 min-w-[3.25rem] inline-flex items-center justify-center rounded-sm hover:bg-line/40 disabled:opacity-50 tabular-nums font-medium"
          title="Reset zoom (0)"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1.25)}
          disabled={zoom >= ZOOM_MAX - 0.001}
          className="h-7 w-7 inline-flex items-center justify-center rounded-sm hover:bg-line/40 disabled:opacity-30 disabled:pointer-events-none"
          title="Zoom in (+)"
          aria-label="Zoom in"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 8h10M8 3v10" />
          </svg>
        </button>
      </div>
    </div>
  );

  // ─── Tools + Decision blocks (shared) ────────────────────────────────────
  // In history mode there's nothing to annotate, so we collapse the palette
  // down to just the cursor — keeps the toolbar present (so layout doesn't
  // jump) but signals clearly that annotating isn't available.
  const toolPalette = (compact = false) => (
    <div
      className={cn(
        "surface inline-flex items-center gap-1 p-1 backdrop-blur bg-surface/95",
        compact ? "" : ""
      )}
    >
      <ToolButton
        active={tool === "cursor"}
        onClick={() => setTool("cursor")}
        label="Cursor"
        kbd="V"
      />
      {!isHistory ? (
        <>
          <ToolButton
            active={tool === "pin"}
            onClick={() => setTool("pin")}
            label="Pin"
            kbd="P"
          />
          <ToolButton
            active={tool === "rect"}
            onClick={() => setTool("rect")}
            label="Rect"
            kbd="R"
          />
          <ToolButton
            active={tool === "draw"}
            onClick={() => setTool("draw")}
            label="Draw"
            kbd="D"
          />
        </>
      ) : null}
    </div>
  );

  const viewTabs =
    siblings.length > 1 ? (
      <div className="flex flex-wrap gap-1.5">
        {siblings.map((s) => {
          const active = s.id === image.id;
          return (
            <Link
              key={s.id}
              href={s.href}
              className={
                active
                  ? "inline-flex h-8 min-w-8 px-3 items-center justify-center rounded-md bg-ink text-bg text-xs font-medium"
                  : "inline-flex h-8 min-w-8 px-3 items-center justify-center rounded-md border border-line bg-surface text-xs hover:border-ink/30 transition-colors"
              }
            >
              {s.viewLabel ?? "·"}
            </Link>
          );
        })}
      </div>
    ) : null;

  // The first non-active version is the natural "compare against" target —
  // for a 2-version image the user just clicks "Compare" without picking.
  const compareTarget = versions.find((v) => !v.isActive && v.compareHref);
  const versionSwitcher =
    versions.length > 1 ? (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {versions.map((v) => (
            <Link
              key={v.versionNumber}
              href={v.href}
              className={
                v.isActive
                  ? "inline-flex h-8 min-w-10 px-3 items-center justify-center rounded-md bg-ink text-bg text-xs font-medium gap-1"
                  : "inline-flex h-8 min-w-10 px-3 items-center justify-center rounded-md border border-line bg-surface text-xs hover:border-ink/30 transition-colors gap-1"
              }
              title={v.isCurrent ? `V${v.versionNumber} (current)` : `V${v.versionNumber}`}
            >
              <span>V{v.versionNumber}</span>
              {v.isCurrent ? (
                <span
                  className={
                    v.isActive
                      ? "h-1.5 w-1.5 rounded-full bg-bg/80"
                      : "h-1.5 w-1.5 rounded-full bg-status-approved"
                  }
                  aria-hidden
                />
              ) : null}
            </Link>
          ))}
        </div>
        {compareTarget && compareTarget.compareHref ? (
          <Link
            href={compareTarget.compareHref}
            className="inline-flex h-7 px-2.5 items-center rounded-md text-[11px] text-muted hover:text-ink border border-line hover:border-ink/30 transition-colors gap-1.5"
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1.5" y="3.5" width="5" height="9" rx="0.5" />
              <rect x="9.5" y="3.5" width="5" height="9" rx="0.5" />
            </svg>
            Compare V{compareTarget.versionNumber} ↔ V{image.versionNumber}
          </Link>
        ) : null}
      </div>
    ) : null;

  // Subtle banner shown when the active version is not the current. Keeps the
  // user oriented: they're browsing history, not the live image.
  const historyBanner = isHistory ? (
    <div className="surface p-3 border-status-v2/40 bg-status-v2/10 text-xs">
      <p className="text-status-v2 font-medium">
        Viewing V{image.versionNumber} history
      </p>
      <p className="text-muted mt-0.5">
        Read-only. Switch back to the current version to annotate or decide.
      </p>
    </div>
  ) : null;

  const statusActions = canChangeStatus ? (
    <div className="space-y-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        Decision
      </p>
      <div className="grid grid-cols-2 gap-2">
        <DecisionPill
          tone="revision"
          active={isRevisionActive}
          busy={busy && isRevisionActive}
          disabled={busy && !isRevisionActive}
          onClick={() => changeStatus("revision_requested")}
        >
          Needs revision
        </DecisionPill>
        <DecisionPill
          tone="approved"
          active={isApprovedActive}
          busy={busy && isApprovedActive}
          disabled={busy && !isApprovedActive}
          onClick={() => changeStatus("approved")}
        >
          Approve
        </DecisionPill>
      </div>
      {image.subjectKey && siblings.length > 1 ? (
        <label className="flex items-center gap-2 text-xs text-muted pt-1">
          <input
            type="checkbox"
            checked={applyToSubject}
            onChange={(e) => setApplyToSubject(e.target.checked)}
          />
          Apply to all {siblings.length} views ({image.subjectKey})
        </label>
      ) : null}
    </div>
  ) : null;

  // Admin-only delete (soft-kill) action
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  async function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setDeleteBusy(true);
    try {
      await fetch(`/api/images/${image.id}`, { method: "DELETE" });
      window.history.back();
    } finally {
      setDeleteBusy(false);
      setDeleteConfirm(false);
    }
  }
  const deleteAction = role === "admin" && !isHistory && !isCompareMode ? (
    <div className="pt-2 border-t border-line">
      <button
        onClick={handleDelete}
        disabled={deleteBusy}
        className={`w-full text-xs px-3 py-1.5 rounded border transition-colors ${
          deleteConfirm
            ? "border-red-400 bg-red-500/10 text-red-400 hover:bg-red-500/20"
            : "border-line text-muted hover:border-red-400/50 hover:text-red-400"
        }`}
      >
        {deleteBusy ? "Deleting…" : deleteConfirm ? "Confirm delete?" : "Delete image"}
      </button>
      {deleteConfirm && !deleteBusy && (
        <button
          onClick={() => setDeleteConfirm(false)}
          className="w-full text-xs text-muted mt-1 hover:text-ink"
        >Cancel</button>
      )}
    </div>
  ) : null;

  // Anyone except the client can resolve. Resolving means "post-prod has
  // addressed this in the next version" — workflow signal, not editing.
  const canResolve = role !== "client_reviewer";

  const commentsList = (
    <div className="space-y-1.5">
      {comments.length === 0 && !pending ? (
        <p className="text-xs text-muted">
          Pick the pin or rect tool, then click on the image to start.
        </p>
      ) : null}
      {comments.map((c, i) => {
        const isActive = activeCommentId === c.id;
        const isResolved = !!c.resolvedAt;
        return (
          // div (not button) — we render a nested checkbox for resolve, and
          // HTML forbids button-in-button. Hover-only interaction is fine
          // without role="button" since the marker is the click target.
          <div
            key={c.id}
            onMouseEnter={() => setActiveCommentId(c.id)}
            onMouseLeave={() => setActiveCommentId((cur) => (cur === c.id ? null : cur))}
            className={cn(
              "p-3 transition-colors block border border-l-[3px]",
              // Resolved cards drop the surface look entirely — they sit on
              // the page background dimmed, so the eye reads them as "filed
              // away" rather than "active feedback".
              isResolved
                ? "border-line-soft border-l-line-soft bg-bg/60 text-muted-soft"
                : "surface",
              !isResolved && isActive
                ? "border-l-accent border-accent/20 bg-accent-soft/60"
                : !isResolved
                  ? "border-l-transparent"
                  : ""
            )}
          >
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-0.5 h-5 min-w-5 px-1 text-[10px] font-semibold inline-flex items-center justify-center",
                  isResolved
                    ? "bg-line text-muted-soft"
                    : "bg-ink text-bg"
                )}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm leading-snug",
                    isResolved && "line-through decoration-1 decoration-muted-soft text-muted"
                  )}
                >
                  {c.body}
                </p>
                <p
                  className={cn(
                    "text-[10px] mt-1 flex items-center gap-2",
                    isResolved ? "text-muted-soft" : "text-muted"
                  )}
                >
                  <span>{c.author.name ?? c.author.email}</span>
                  {c.visibility === "internal" ? (
                    <span className="px-1 py-0.5 bg-line/60 text-[9px] uppercase tracking-wide">
                      internal
                    </span>
                  ) : null}
                  {isResolved ? (
                    <span className="px-1 py-0.5 bg-status-approved-soft text-status-approved text-[9px] uppercase tracking-wide font-medium">
                      done
                    </span>
                  ) : null}
                </p>
              </div>
              {canResolve ? (
                <ResolveToggle
                  resolved={isResolved}
                  onChange={(next) => toggleResolved(c.id, next)}
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ─── Layouts ─────────────────────────────────────────────────────────────

  // Compare mode: dual stages, no annotation tools, no decision actions.
  // Pure visual reference. Both stages share the same zoom/pan transform.
  if (compare) {
    const cmpPreviewUrl = `/api/storage/${compare.previewPath}`;
    const otherAnnotations = compare.annotations
      .map((a) => {
        try {
          return { ...a, parsed: JSON.parse(a.geom) };
        } catch {
          return null;
        }
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    function stageFor(
      label: string,
      url: string,
      w: number,
      h: number,
      annotations: typeof otherAnnotations | null,
      isActive: boolean
    ) {
      return (
        <div className="relative bg-[#0c0c0c] overflow-hidden flex items-center justify-center w-full h-full">
          <div
            className="relative"
            style={{
              aspectRatio: `${w} / ${h}`,
              maxWidth: "100%",
              maxHeight: "100%",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              transition: panning ? "none" : "transform 120ms ease-out",
              willChange: "transform",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="block w-full h-full"
              style={{ objectFit: "fill" }}
              draggable={false}
            />
            {/* Lightweight read-only annotation overlay — outlines only, no
                interactive markers. */}
            {annotations ? (
              <svg
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full pointer-events-none"
              >
                {annotations.map((a) => {
                  if (a.shape === "rect") {
                    const g = a.parsed as { x: number; y: number; w: number; h: number };
                    return (
                      <g key={a.id}>
                        <rect x={g.x} y={g.y} width={g.w} height={g.h} fill="none" stroke="rgba(250,250,247,0.9)" strokeWidth="0.006" vectorEffect="non-scaling-stroke" />
                        <rect x={g.x} y={g.y} width={g.w} height={g.h} fill="rgba(220,38,38,0.08)" stroke="#DC2626" strokeWidth="0.003" vectorEffect="non-scaling-stroke" />
                      </g>
                    );
                  }
                  if (a.shape === "pin") {
                    const g = a.parsed as { x: number; y: number };
                    return (
                      <circle key={a.id} cx={g.x} cy={g.y} r={0.014} fill="#111" stroke="#fafaf7" strokeWidth="0.003" vectorEffect="non-scaling-stroke" />
                    );
                  }
                  // freehand
                  if (a.shape === "freehand") {
                    const pts = (a.parsed as { points: { x: number; y: number }[] }).points;
                    if (!pts || pts.length < 2) return null;
                    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                    return (
                      <g key={a.id}>
                        <path d={d} fill="none" stroke="rgba(250,250,247,0.9)" strokeWidth={0.007} strokeLinecap="round" strokeLinejoin="round" />
                        <path d={d} fill="none" stroke="#DC2626" strokeWidth={0.0035} strokeLinecap="round" strokeLinejoin="round" />
                      </g>
                    );
                  }
                  return null;
                })}
              </svg>
            ) : null}
          </div>
          <div
            className={cn(
              "absolute top-2 left-2 z-10 px-2 h-6 rounded-md text-[11px] font-medium inline-flex items-center gap-1.5",
              isActive ? "bg-ink text-bg" : "bg-bg/90 text-ink border border-line"
            )}
          >
            V{label}
            {isActive ? (
              <span className="text-[9px] opacity-80 uppercase tracking-wide">
                current
              </span>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="mb-4 flex items-center justify-between text-xs text-muted flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Link href={galleryHref} className="hover:text-ink transition-colors">
              ← {galleryName}
            </Link>
            <span>·</span>
            <span>{image.displayName ?? image.slotName}</span>
            <span>·</span>
            <span className="font-medium text-ink">
              Comparing V{compare.versionNumber} ↔ V{image.versionNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={compare.exitHref}
              className="inline-flex h-8 px-3 items-center rounded-md text-xs border border-line hover:border-ink/30 transition-colors"
            >
              Exit compare
            </Link>
          </div>
        </div>

        <div
          ref={stageRef}
          onWheel={onStageWheel}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerUp}
          onPointerCancel={onStagePointerUp}
          className="grid grid-cols-2 gap-3 relative"
          style={{ cursor: stageCursor ?? undefined }}
        >
          <div className="aspect-[4/5]" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
            {stageFor(
              String(compare.versionNumber),
              cmpPreviewUrl,
              compare.width,
              compare.height,
              otherAnnotations,
              false
            )}
          </div>
          <div className="aspect-[4/5]" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
            {/* For the active version use the real AnnotationLayer for richer
                rendering. But hide markers via no comments → keep read-only
                reference styling. */}
            {stageFor(
              String(image.versionNumber),
              previewUrl,
              image.width,
              image.height,
              annotations.map((a) => {
                try {
                  return { ...a, parsed: JSON.parse(a.geom) };
                } catch {
                  return { ...a, parsed: {} };
                }
              }),
              true
            )}
          </div>

          {/* Floating zoom controls (synced across both stages) */}
          <div
            data-stop-pan
            className="absolute bottom-3 right-3 z-20 surface bg-surface/95 backdrop-blur p-1 inline-flex items-center gap-0.5 text-xs"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => zoomBy(1 / 1.25)}
              disabled={zoom <= ZOOM_MIN + 0.001}
              className="h-7 w-7 inline-flex items-center justify-center rounded-sm hover:bg-line/40 disabled:opacity-30"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 8h10" />
              </svg>
            </button>
            <button
              type="button"
              onClick={resetZoom}
              disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
              className="h-7 px-2 min-w-[3.25rem] rounded-sm hover:bg-line/40 disabled:opacity-50 tabular-nums font-medium"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => zoomBy(1.25)}
              disabled={zoom >= ZOOM_MAX - 0.001}
              className="h-7 w-7 inline-flex items-center justify-center rounded-sm hover:bg-line/40 disabled:opacity-30"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 8h10M8 3v10" />
              </svg>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-muted mt-3 text-center">
          Cmd/Ctrl + scroll to zoom · drag to pan · both stages stay synced.
        </p>
      </main>
    );
  }

  return (
    <>
      {fullscreen ? (
        // ── Fullscreen: image left, right rail with everything ─────────────
        <>
          <div className="flex-1 min-w-0 relative">
            {/* Tool palette floating top-left */}
            <div className="absolute top-4 left-4 z-10">{toolPalette()}</div>

            {/* Breadcrumb floating top-center */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-xs text-bg/80 flex items-center gap-3 bg-black/30 backdrop-blur rounded-md px-3 h-8">
              <span>{galleryName}</span>
              <span>·</span>
              <span>
                {position.index + 1} / {position.total}
              </span>
              <span>·</span>
              <span>{image.displayName ?? image.slotName}</span>
            </div>

            <div className="absolute inset-0 p-4">{stage}</div>
          </div>

          {/* Right rail */}
          <aside className="w-[380px] flex-shrink-0 bg-bg border-l hairline flex flex-col">
            <div className="p-5 border-b hairline">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted flex items-center gap-2 mb-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    {image.subjectKey ?? "Image"}
                  </p>
                  <h1 className="font-display text-xl font-medium tracking-tight leading-tight truncate">
                    {image.displayName ?? image.slotName}
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={exitFullscreen}
                  className="press inline-flex h-8 px-3 items-center text-[11px] border border-line hover:border-ink/30 transition-colors flex-shrink-0"
                  title="Exit fullscreen (Esc)"
                >
                  Exit ⛶
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <StatusChip status={image.status as ImageStatus} size="sm" />
                <span className="text-[11px] text-muted tabular-nums">
                  V{image.versionNumber} · {image.width}×{image.height}
                </span>
              </div>
            </div>

            {versionSwitcher ? (
              <div className="p-5 border-b hairline">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-3">
                  Versions
                </p>
                {versionSwitcher}
              </div>
            ) : null}

            {viewTabs ? (
              <div className="p-5 border-b hairline">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-3">
                  Views
                </p>
                {viewTabs}
              </div>
            ) : null}

            {historyBanner ? <div className="px-5 pt-4">{historyBanner}</div> : null}

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
              <CommentsHeader comments={comments} />
              {commentsList}
            </div>

            <div className="p-5 border-t hairline space-y-4">
              {statusActions}
              {deleteAction}
              <ShortcutLegend />
            </div>
          </aside>
        </>
      ) : (
        // ── Compact ────────────────────────────────────────────────────────
        <main className="mx-auto max-w-7xl px-6 py-6">
          <div className="mb-4 flex items-center justify-between text-xs text-muted">
            <div className="flex items-center gap-3">
              <Link href={galleryHref} className="hover:text-ink transition-colors">
                ← {galleryName}
              </Link>
              <span>·</span>
              <span>
                {position.index + 1} / {position.total}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <NavLink href={prevHref} dir="prev" />
              <NavLink href={nextHref} dir="next" />
              <button
                type="button"
                onClick={enterFullscreen}
                className="inline-flex h-8 px-3 items-center rounded-md text-xs border border-line hover:border-ink/30 transition-colors"
                title="Fullscreen (F)"
              >
                ⛶ Fullscreen
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            <section>
              <div className="mb-3">{toolPalette()}</div>
              <div
                className="relative"
                style={{ aspectRatio: `${image.width} / ${image.height}`, maxHeight: "calc(100vh - 200px)" }}
              >
                {stage}
              </div>
            </section>

            <aside className="space-y-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted flex items-center gap-2 mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {image.subjectKey ?? "Image"}
                </p>
                <h1 className="font-display text-2xl font-medium tracking-tight leading-tight">
                  {image.displayName ?? image.slotName}
                </h1>
                <p className="text-xs text-muted-soft mt-1.5 truncate" title={image.filenameOriginal}>
                  {image.filenameOriginal}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <StatusChip status={image.status as ImageStatus} size="sm" />
                <span className="text-xs text-muted tabular-nums">
                  V{image.versionNumber} · {image.width}×{image.height}
                </span>
              </div>

              {versionSwitcher ? (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Versions</p>
                  {versionSwitcher}
                </div>
              ) : null}

              {viewTabs ? (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Views</p>
                  {viewTabs}
                </div>
              ) : null}

              {historyBanner}

              {statusActions}
              {deleteAction}

              <div>
                <CommentsHeader comments={comments} className="mb-3" />
                {commentsList}
              </div>

              <ShortcutLegend />
            </aside>
          </div>
        </main>
      )}
    </>
  );
}

// Section header: "Comments (N)" with an inline "X done" count once any
// comment has been resolved. Keeps the header quiet when there's nothing
// to communicate beyond the total.
function CommentsHeader({
  comments,
  className,
}: {
  comments: Comment[];
  className?: string;
}) {
  const done = comments.filter((c) => c.resolvedAt).length;
  return (
    <div
      className={cn(
        "flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted",
        className
      )}
    >
      <span>Comments ({comments.length})</span>
      {done > 0 ? (
        <span className="inline-flex items-center gap-1.5 text-status-approved normal-case tracking-normal">
          <span className="h-1.5 w-1.5 rounded-full bg-status-approved" />
          {done} done
        </span>
      ) : null}
    </div>
  );
}

// Square checkbox-style "Done" toggle for comments. Post-prod / admin uses
// this to mark feedback addressed in the next version. Clicking does NOT
// expand the comment or move the active highlight — it's a workflow signal.
function ResolveToggle({
  resolved,
  onChange,
}: {
  resolved: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(!resolved);
      }}
      onMouseEnter={(e) => e.stopPropagation()}
      aria-pressed={resolved}
      title={resolved ? "Mark as not done" : "Mark as done"}
      className={cn(
        "h-6 w-6 border inline-flex items-center justify-center flex-shrink-0 transition-colors press",
        resolved
          ? "bg-status-approved border-status-approved text-white"
          : "bg-surface border-line text-muted hover:border-status-approved/60 hover:text-status-approved"
      )}
    >
      {resolved ? (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8.5l3.5 3.5L13 5" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="h-3 w-3 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 8.5l3.5 3.5L13 5" />
        </svg>
      )}
    </button>
  );
}

// Compact two-row legend of keyboard shortcuts. Square mono-style chips
// match the rest of the sharp UI; one row per category so users can scan.
function ShortcutLegend() {
  const groups: { label: string; keys: string[] }[] = [
    { label: "Navigate", keys: ["←", "→"] },
    { label: "Tools", keys: ["V", "P", "R", "D"] },
    { label: "Zoom", keys: ["+", "−", "0"] },
    { label: "Fullscreen", keys: ["F"] },
  ];
  return (
    <div className="space-y-1.5">
      {groups.map((g) => (
        <div key={g.label} className="flex items-center gap-2 text-[10px]">
          <span className="text-muted-soft w-[68px] uppercase tracking-[0.15em]">
            {g.label}
          </span>
          <div className="flex items-center gap-1">
            {g.keys.map((k) => (
              <kbd
                key={k}
                className="px-1.5 h-5 min-w-5 inline-flex items-center justify-center border border-line text-[10px] font-medium tabular-nums text-muted bg-surface"
              >
                {k}
              </kbd>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DecisionPill({
  tone,
  active,
  busy,
  disabled,
  onClick,
  children,
}: {
  tone: "revision" | "approved";
  active: boolean;
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeBg =
    tone === "approved"
      ? "bg-status-approved text-white border-status-approved"
      : "bg-status-notes text-white border-status-notes";
  const inactiveBg = "border-line bg-surface text-ink hover:border-ink/30";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "press h-10 px-3 text-sm font-medium border transition-colors",
        "inline-flex items-center justify-center gap-2",
        "disabled:opacity-50 disabled:pointer-events-none",
        active ? activeBg : inactiveBg
      )}
    >
      {/* tiny dot + check pattern: dot becomes a checkmark when active */}
      <span
        className={cn(
          "inline-flex items-center justify-center transition-all",
          active ? "h-3.5 w-3.5" : "h-1.5 w-1.5 rounded-full"
        )}
        aria-hidden
      >
        {active ? (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
          >
            <path
              d="M3 8.5l3.5 3.5L13 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
        )}
      </span>
      <span>{children}</span>
      {busy ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current opacity-80 animate-pulse"
          aria-hidden
        />
      ) : null}
    </button>
  );
}

function ToolButton({
  active,
  onClick,
  label,
  kbd,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  kbd: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sm text-xs transition-colors",
        active ? "bg-ink text-bg" : "hover:bg-line/40 text-ink"
      )}
      title={`${label} (${kbd})`}
    >
      {label}
      <kbd className={cn("text-[9px] px-1 rounded", active ? "bg-bg/20" : "bg-line/60")}>{kbd}</kbd>
    </button>
  );
}

function NavLink({ href, dir }: { href: string | null; dir: "prev" | "next" }) {
  const label = dir === "prev" ? "← Prev" : "Next →";
  const base = "inline-flex h-8 px-3 items-center rounded-md text-xs border border-line";
  if (!href) return <span className={`${base} text-muted/60 cursor-not-allowed`}>{label}</span>;
  return (
    <Link href={href} className={`${base} hover:border-ink/30 transition-colors`}>
      {label}
    </Link>
  );
}
