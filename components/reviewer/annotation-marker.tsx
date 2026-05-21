"use client";

import * as HoverCard from "@radix-ui/react-hover-card";
import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useFullscreen } from "./fullscreen-shell";
import type { Annotation, Comment, Role } from "./types";

type Props = {
  annotation: Annotation;
  comment: Comment | null;
  number: number;
  // Whether the comment thread side panel should highlight this annotation
  isActive: boolean;
  onActivate: (commentId: string | null) => void;
  // Edit / delete callbacks (return the updated comment)
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onReply: (parentId: string, body: string) => Promise<void>;
  role: Role;
};

// Renders the visible marker (pin dot or rect badge) absolutely positioned over
// the image. Hovering shows a Radix HoverCard "peek"; clicking opens a Popover
// with the full controls (edit / delete). The SVG outline for rect is rendered
// separately by AnnotationLayer — this component just handles the interactive
// marker and its floating UI.
export function AnnotationMarker({
  annotation,
  comment,
  number,
  isActive,
  onActivate,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onReply,
  role,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const { portalContainer } = useFullscreen();

  // Anchor point depends on shape:
  //   pin       → the dot location
  //   rect      → just outside the top-left corner so the badge sits on the edge
  //   freehand  → the first sampled point of the path
  let geom: { x: number; y: number } | null = null;
  try {
    const parsed = JSON.parse(annotation.geom);
    if (annotation.shape === "pin") {
      geom = { x: parsed.x, y: parsed.y };
    } else if (annotation.shape === "rect") {
      geom = { x: parsed.x + 0.014, y: parsed.y + 0.014 };
    } else if (annotation.shape === "freehand") {
      const first = Array.isArray(parsed.points) ? parsed.points[0] : null;
      if (first) geom = { x: first.x, y: first.y };
    }
  } catch {
    return null;
  }
  if (!geom) return null;

  // All marker badges share the same ink colour — the visual distinction
  // between annotation kinds lives in the SVG outline (red for rect/freehand,
  // none for pin). Coloured numbered badges fought with the dark text on white
  // popovers, so we keep the chip identity consistent everywhere.
  const markerStyle: React.CSSProperties = {
    position: "absolute",
    left: `${geom.x * 100}%`,
    top: `${geom.y * 100}%`,
    transform: "translate(-50%, -50%)",
  };

  async function startEdit() {
    if (!comment) return;
    setDraft(comment.body);
    setEditing(true);
  }

  async function saveEdit() {
    if (!comment) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await onEdit(comment.id, trimmed);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function submitReply() {
    if (!comment) return;
    const trimmed = replyDraft.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await onReply(comment.id, trimmed);
      setReplyDraft("");
      setReplyOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!comment) return;
    setBusy(true);
    try {
      await onDelete(comment.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <HoverCard.Root openDelay={120} closeDelay={80}>
      <Popover.Root
        onOpenChange={(open) => {
          if (open) onActivate(comment?.id ?? null);
          else setEditing(false);
        }}
      >
        <HoverCard.Trigger asChild>
          <Popover.Trigger asChild>
            <button
              type="button"
              style={markerStyle}
              aria-label={`Annotation #${number}`}
              onMouseEnter={() => onActivate(comment?.id ?? null)}
              className={cn(
                "z-10 outline-none transition-all duration-150 select-none",
                "h-7 w-7 rounded-full inline-flex items-center justify-center text-[11px] font-semibold",
                "ring-2 ring-bg/95 shadow-[0_2px_8px_rgba(0,0,0,0.35)]",
                "bg-ink text-bg",
                // Explicit pointer-events:auto: the wrapper around us is
                // pointer-events:none so empty-area clicks reach the SVG, but
                // the button itself MUST be clickable. Browsers don't honor
                // the inherited "auto" default when an ancestor is "none".
                "pointer-events-auto",
                isActive ? "scale-110" : "hover:scale-110 focus-visible:scale-110"
              )}
            >
              {number}
            </button>
          </Popover.Trigger>
        </HoverCard.Trigger>

        {/* Hover peek — shows comment body + author at a glance */}
        {comment ? (
          <HoverCard.Portal container={portalContainer ?? undefined}>
            <HoverCard.Content
              side="top"
              align="center"
              sideOffset={10}
              className="z-50 max-w-[280px] surface px-3 py-2.5 bg-surface/98 backdrop-blur animate-fade-in pointer-events-none"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 h-5 min-w-5 px-1 rounded-full bg-ink text-bg text-[10px] font-semibold inline-flex items-center justify-center flex-shrink-0">
                  {number}
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{comment.body}</p>
                  <p className="text-[10px] text-muted mt-1.5 flex items-center gap-1.5">
                    <span>{comment.author.name ?? comment.author.email}</span>
                    {comment.visibility === "internal" ? (
                      <span className="px-1 py-0.5 rounded bg-line/70 text-[9px] uppercase tracking-wide">
                        internal
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              <HoverCard.Arrow className="fill-surface" />
            </HoverCard.Content>
          </HoverCard.Portal>
        ) : null}

        {/* Click popover — full controls */}
        {comment ? (
          <Popover.Portal container={portalContainer ?? undefined}>
            <Popover.Content
              side="top"
              align="center"
              sideOffset={10}
              collisionPadding={16}
              className="z-50 w-[320px] surface p-4 bg-surface backdrop-blur animate-fade-in"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="flex items-start gap-2 mb-3">
                <span className="mt-0.5 h-5 min-w-5 px-1 rounded-full bg-ink text-bg text-[10px] font-semibold inline-flex items-center justify-center flex-shrink-0">
                  {number}
                </span>
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <Input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void saveEdit();
                        } else if (e.key === "Escape") {
                          setEditing(false);
                        }
                      }}
                    />
                  ) : (
                    <p className="text-sm leading-snug">{comment.body}</p>
                  )}
                  <p className="text-[10px] text-muted mt-1.5 flex items-center gap-1.5">
                    <span>{comment.author.name ?? comment.author.email}</span>
                    {comment.visibility === "internal" ? (
                      <span className="px-1 py-0.5 rounded bg-line/70 text-[9px] uppercase tracking-wide">
                        internal
                      </span>
                    ) : null}
                    <span>·</span>
                    <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                  </p>
                </div>
              </div>

              {/* Replies thread + reply form (only for top-level comments) */}
              {!editing && comment.replies && comment.replies.length > 0 ? (
                <div className="border-t hairline pt-3 mb-3 space-y-2">
                  {comment.replies.map((r) => (
                    <div key={r.id} className="pl-3 border-l-2 border-line/60">
                      <p className="text-sm leading-snug">{r.body}</p>
                      <p className="text-[10px] text-muted mt-1">
                        {r.author.name ?? r.author.email}
                        {" · "}
                        {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {!editing && replyOpen ? (
                <div className="border-t hairline pt-3 mb-3 space-y-2">
                  <Input
                    autoFocus
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    placeholder="Reply…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submitReply();
                      } else if (e.key === "Escape") {
                        setReplyOpen(false);
                        setReplyDraft("");
                      }
                    }}
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setReplyOpen(false);
                        setReplyDraft("");
                      }}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={submitReply}
                      disabled={busy || !replyDraft.trim()}
                    >
                      {busy ? "Sending…" : "Reply"}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-1.5 border-t hairline pt-3">
                {editing ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(false)}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={saveEdit} disabled={busy || !draft.trim()}>
                      {busy ? "Saving…" : "Save"}
                    </Button>
                  </>
                ) : (
                  <>
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDelete}
                        disabled={busy}
                        className="text-status-revision hover:bg-status-revision/10"
                      >
                        Delete
                      </Button>
                    ) : null}
                    {canEdit ? (
                      <Button type="button" variant="outline" size="sm" onClick={startEdit}>
                        Edit
                      </Button>
                    ) : null}
                    {!replyOpen ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReplyOpen(true)}
                      >
                        Reply
                      </Button>
                    ) : null}
                    <Popover.Close asChild>
                      <Button type="button" size="sm">
                        Close
                      </Button>
                    </Popover.Close>
                  </>
                )}
              </div>
              <Popover.Arrow className="fill-surface" />
            </Popover.Content>
          </Popover.Portal>
        ) : null}
      </Popover.Root>
    </HoverCard.Root>
  );
}
