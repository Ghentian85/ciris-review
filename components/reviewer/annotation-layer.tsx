"use client";

import { useEffect, useRef, useState } from "react";
import { AnnotationMarker } from "./annotation-marker";
import type { Annotation, Comment, PendingDraft, Role, Tool } from "./types";

type Props = {
  annotations: Annotation[];
  comments: Comment[];
  pinNumberById: Record<string, number>;
  tool: Tool;
  activeCommentId: string | null;
  onActivate: (commentId: string | null) => void;
  onCommit: (draft: PendingDraft) => void;
  canEditComment: (commentId: string) => boolean;
  canDeleteComment: (commentId: string) => boolean;
  onEditComment: (commentId: string, body: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onReplyComment: (parentId: string, body: string) => Promise<void>;
  role: Role;
};

// Squared distance threshold so we can compare without a sqrt every pointermove.
// 0.003 ≈ 3px on a 1000px-wide image — small enough that gentle drags still
// accumulate points, large enough that we don't store hundreds of samples.
const FREEHAND_SAMPLE_DISTANCE_SQ = 0.003 * 0.003;
const FREEHAND_MIN_POINTS = 2;

// Red used for rect + freehand annotations (#DC2626 = Tailwind red-600).
// Pinned point markers stay ink-colored — they're single-point references and
// don't need to compete visually with the area annotations.
const ACCENT = "#DC2626";

export function AnnotationLayer({
  annotations,
  comments,
  pinNumberById,
  tool,
  activeCommentId,
  onActivate,
  onCommit,
  canEditComment,
  canDeleteComment,
  onEditComment,
  onDeleteComment,
  onReplyComment,
  role,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragNow, setDragNow] = useState<{ x: number; y: number } | null>(null);

  // Freehand point buffer lives in a ref so rapid pointermoves don't lose
  // samples to stale closures. We force a re-render via a state object that
  // gets replaced with a fresh reference on every tick.
  const drawingRef = useRef<{ x: number; y: number }[] | null>(null);
  const [, setRenderTick] = useState({});
  function tickRender() {
    setRenderTick({});
  }

  function clientToLocal(e: React.PointerEvent | PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (tool === "cursor") return;
    const local = clientToLocal(e);
    if (!local) return;
    if (tool === "pin") {
      onCommit({ kind: "pin", geom: local });
      return;
    }
    // Capture on the element that owns the handler (the SVG), not e.target —
    // pointer events may bubble from a child even though we set pointer-events
    // none on every inner shape.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers reject capture mid-gesture; gesture still works without it.
    }
    if (tool === "rect") {
      setDragStart(local);
      setDragNow(local);
    } else if (tool === "draw") {
      drawingRef.current = [local];
      tickRender();
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const local = clientToLocal(e);
    if (!local) return;
    if (tool === "rect" && dragStart) {
      setDragNow(local);
    } else if (tool === "draw" && drawingRef.current) {
      const arr = drawingRef.current;
      const last = arr[arr.length - 1];
      const dx = local.x - last.x;
      const dy = local.y - last.y;
      if (dx * dx + dy * dy < FREEHAND_SAMPLE_DISTANCE_SQ) return;
      arr.push(local);
      tickRender();
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (tool === "rect" && dragStart) {
      const local = clientToLocal(e) ?? dragNow ?? dragStart;
      const x = Math.min(dragStart.x, local.x);
      const y = Math.min(dragStart.y, local.y);
      const w = Math.abs(local.x - dragStart.x);
      const h = Math.abs(local.y - dragStart.y);
      setDragStart(null);
      setDragNow(null);
      if (w < 0.005 || h < 0.005) return;
      onCommit({ kind: "rect", geom: { x, y, w, h } });
    } else if (tool === "draw" && drawingRef.current) {
      const arr = drawingRef.current;
      // Always snap the actual release point into the buffer so the path
      // ends exactly where the user let go — independent of sample threshold.
      const local = clientToLocal(e);
      if (local) {
        const last = arr[arr.length - 1];
        const dx = local.x - last.x;
        const dy = local.y - last.y;
        if (dx * dx + dy * dy > 0.0000001) arr.push(local);
      }
      const points = arr.slice();
      drawingRef.current = null;
      tickRender();
      if (points.length < FREEHAND_MIN_POINTS) return;
      onCommit({ kind: "freehand", geom: { points } });
    }
  }

  // Cancel in-progress shape on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (dragStart) {
        setDragStart(null);
        setDragNow(null);
      }
      if (drawingRef.current) {
        drawingRef.current = null;
        tickRender();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dragStart]);

  const dragRect =
    dragStart && dragNow
      ? {
          x: Math.min(dragStart.x, dragNow.x),
          y: Math.min(dragStart.y, dragNow.y),
          w: Math.abs(dragNow.x - dragStart.x),
          h: Math.abs(dragNow.y - dragStart.y),
        }
      : null;

  const cursorClass = tool === "cursor" ? "cursor-default" : "cursor-crosshair";
  const svgPointer = tool === "cursor" ? "none" : "auto";
  const commentById = new Map(comments.map((c) => [c.id, c]));
  const livePoints = drawingRef.current;

  return (
    <>
      <svg
        ref={svgRef}
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className={`absolute inset-0 h-full w-full ${cursorClass} select-none`}
        // touchAction: "none" tells the browser not to grab the gesture for
        // scrolling/zooming. Without it, on touchpads with momentum and on
        // touchscreens, pointermove can be hijacked away from the canvas.
        style={{ pointerEvents: svgPointer, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {annotations.map((a) => {
          const active = a.commentId === activeCommentId;
          if (a.shape === "rect") {
            let g: { x: number; y: number; w: number; h: number };
            try {
              g = JSON.parse(a.geom);
            } catch {
              return null;
            }
            return <RectOutline key={a.id} g={g} active={active} />;
          }
          if (a.shape === "freehand") {
            let g: { points: { x: number; y: number }[] };
            try {
              g = JSON.parse(a.geom);
            } catch {
              return null;
            }
            if (!g.points || g.points.length < 2) return null;
            return <FreehandOutline key={a.id} points={g.points} active={active} />;
          }
          return null;
        })}

        {/* Live drag preview for new rect */}
        {dragRect ? <RectOutline g={dragRect} active dashed /> : null}
        {/* Live draw preview — pulled directly from the ref */}
        {livePoints && livePoints.length > 1 ? (
          <FreehandOutline points={livePoints} active dashed />
        ) : null}
      </svg>

      {/* HTML markers overlay.
          CRITICAL: each marker wrapper covers the full image (absolute inset-0)
          so we *must* leave it pointer-events:none — otherwise every saved
          annotation puts an invisible click-shield over the whole image and
          new pointer events never reach the SVG underneath. The marker BUTTON
          inside the wrapper has its own default pointer-events:auto on a tiny
          7×7 footprint, so hovering/clicking the dot still works. */}
      <div className="absolute inset-0 h-full w-full pointer-events-none">
        {annotations.map((a) => {
          if (!a.commentId) return null;
          const number = pinNumberById[a.commentId];
          if (!number) return null;
          const comment = commentById.get(a.commentId) ?? null;
          return (
            <div key={a.id} className="absolute inset-0 pointer-events-none">
              <AnnotationMarker
                annotation={a}
                comment={comment}
                number={number}
                isActive={a.commentId === activeCommentId}
                onActivate={onActivate}
                canEdit={comment ? canEditComment(comment.id) : false}
                canDelete={comment ? canDeleteComment(comment.id) : false}
                onEdit={onEditComment}
                onDelete={onDeleteComment}
                onReply={onReplyComment}
                role={role}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Outline primitives ──────────────────────────────────────────────────────
// Dual-stroke: light halo (universal contrast on dark images) + red inner
// stroke (semantic "this is a critique mark").

function RectOutline({
  g,
  active,
  dashed,
}: {
  g: { x: number; y: number; w: number; h: number };
  active: boolean;
  dashed?: boolean;
}) {
  return (
    <g pointerEvents="none">
      <rect
        x={g.x}
        y={g.y}
        width={g.w}
        height={g.h}
        fill="none"
        stroke="rgba(250,250,247,0.9)"
        strokeWidth="0.006"
        strokeDasharray={dashed ? "0.012 0.008" : undefined}
        vectorEffect="non-scaling-stroke"
      />
      <rect
        x={g.x}
        y={g.y}
        width={g.w}
        height={g.h}
        fill={active ? "rgba(220,38,38,0.22)" : "rgba(220,38,38,0.10)"}
        stroke={ACCENT}
        strokeWidth="0.0035"
        strokeDasharray={dashed ? "0.012 0.008" : undefined}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

function FreehandOutline({
  points,
  active,
  dashed,
}: {
  points: { x: number; y: number }[];
  active: boolean;
  dashed?: boolean;
}) {
  const d = pointsToSmoothPath(points);
  // NOTE: vectorEffect="non-scaling-stroke" is intentionally NOT used here.
  // Chrome/Blink has a long-standing rendering bug where non-scaling-stroke on
  // <path> elements containing curve commands (Q/C/S/T) collapses the stroke
  // to zero width — works for <rect>/lines but not curves. With viewBox 0..1,
  // these widths in user units scale naturally with the rendered image size.
  return (
    <g pointerEvents="none">
      <path
        d={d}
        fill="none"
        stroke="rgba(250,250,247,0.9)"
        strokeWidth={0.007}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? "0.012 0.008" : undefined}
      />
      <path
        d={d}
        fill="none"
        stroke={ACCENT}
        strokeWidth={0.0035}
        strokeOpacity={active ? 1 : 0.95}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? "0.012 0.008" : undefined}
      />
    </g>
  );
}

function pointsToSmoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2)
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}
