"use client";

import * as Popover from "@radix-ui/react-popover";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFullscreen } from "./fullscreen-shell";
import type { PendingDraft, Role } from "./types";

type Props = {
  pending: PendingDraft;
  number: number;
  role: Role;
  busy: boolean;
  onSave: (body: string, visibility: "client" | "internal") => Promise<void>;
  onCancel: () => void;
};

// Renders an in-flight annotation (pin or rect outline) at its normalized
// position, with a Popover anchored to it for the comment input. Auto-focus,
// Enter to save, Esc to cancel. Clicking outside the popover also cancels
// (the parent calls onCancel via onOpenChange).
export function PendingPopover({ pending, number, role, busy, onSave, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"client" | "internal">(
    role === "client_reviewer" ? "client" : "internal"
  );
  const { portalContainer } = useFullscreen();

  useEffect(() => {
    // Focus shortly after mount so Radix can finish positioning.
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, []);

  // Where to anchor:
  //   pin       → dot center
  //   rect      → top-center of the box
  //   freehand  → first sampled point (where the user started drawing)
  const anchor =
    pending.kind === "pin"
      ? { x: pending.geom.x, y: pending.geom.y }
      : pending.kind === "rect"
        ? { x: pending.geom.x + pending.geom.w / 2, y: pending.geom.y }
        : { x: pending.geom.points[0].x, y: pending.geom.points[0].y };

  async function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    await onSave(trimmed, visibility);
  }

  return (
    <>
      {/* Visual feedback for the pending mark — drawn above other markers */}
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full pointer-events-none"
      >
        {pending.kind === "pin" ? (
          <circle
            cx={pending.geom.x}
            cy={pending.geom.y}
            r={0.024}
            fill="rgba(17,17,17,0.15)"
            vectorEffect="non-scaling-stroke"
          >
            <animate
              attributeName="r"
              values="0.024;0.034;0.024"
              dur="1.4s"
              repeatCount="indefinite"
            />
          </circle>
        ) : pending.kind === "rect" ? (
          <g>
            <rect
              x={pending.geom.x}
              y={pending.geom.y}
              width={pending.geom.w}
              height={pending.geom.h}
              fill="none"
              stroke="rgba(250,250,247,0.9)"
              strokeWidth="0.006"
              strokeDasharray="0.012 0.008"
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={pending.geom.x}
              y={pending.geom.y}
              width={pending.geom.w}
              height={pending.geom.h}
              fill="rgba(220,38,38,0.15)"
              stroke="#DC2626"
              strokeWidth="0.0035"
              strokeDasharray="0.012 0.008"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ) : (
          // freehand — no vectorEffect (Chrome bug with curves; see annotation-layer.tsx)
          <g>
            <path
              d={pointsToPath(pending.geom.points)}
              fill="none"
              stroke="rgba(250,250,247,0.9)"
              strokeWidth={0.007}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="0.012 0.008"
            />
            <path
              d={pointsToPath(pending.geom.points)}
              fill="none"
              stroke="#DC2626"
              strokeWidth={0.0035}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="0.012 0.008"
            />
          </g>
        )}
      </svg>

      {/* Marker + popover anchor */}
      <Popover.Root
        defaultOpen
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`Pending annotation #${number}`}
            style={{
              position: "absolute",
              left: `${anchor.x * 100}%`,
              top: `${anchor.y * 100}%`,
              transform: "translate(-50%, -50%)",
              pointerEvents: "auto",
            }}
            className="z-20 h-7 w-7 rounded-full inline-flex items-center justify-center text-[11px] font-semibold bg-ink text-bg ring-2 ring-bg/95 shadow-[0_2px_10px_rgba(0,0,0,0.4)]"
          >
            {number}
          </button>
        </Popover.Trigger>
        <Popover.Portal container={portalContainer ?? undefined}>
          <Popover.Content
            side="top"
            align="center"
            sideOffset={12}
            collisionPadding={16}
            className="z-[60] w-[320px] surface p-4 bg-surface backdrop-blur animate-fade-in"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onEscapeKeyDown={onCancel}
          >
            <p className="text-[10px] uppercase tracking-wide text-muted mb-2">
              New{" "}
              {pending.kind === "pin"
                ? "pin"
                : pending.kind === "rect"
                  ? "region"
                  : "sketch"}{" "}
              · #{number}
            </p>
            <Input
              ref={inputRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe what needs to change…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                } else if (e.key === "Escape") {
                  onCancel();
                }
              }}
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              {role !== "client_reviewer" ? (
                <div className="flex items-center gap-3 text-[11px] text-muted">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="vis-pending"
                      checked={visibility === "client"}
                      onChange={() => setVisibility("client")}
                    />
                    Client
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="vis-pending"
                      checked={visibility === "internal"}
                      onChange={() => setVisibility("internal")}
                    />
                    Internal
                  </label>
                </div>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => submit()}
                  disabled={busy || !body.trim()}
                >
                  {busy ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
            <Popover.Arrow className="fill-surface" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}

function pointsToPath(points: { x: number; y: number }[]) {
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
