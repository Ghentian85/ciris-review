"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

type Ctx = {
  fullscreen: boolean;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  // The DOM node Radix portals must mount into so they remain visible inside
  // the fullscreen tree. Null until the layout has mounted.
  portalContainer: HTMLElement | null;
};

const FullscreenContext = createContext<Ctx | null>(null);

export function useFullscreen() {
  const c = useContext(FullscreenContext);
  if (!c) throw new Error("useFullscreen must be used inside <FullscreenShell>");
  return c;
}

// Hosts the rootRef element that becomes the fullscreen target. Lives in a
// layout file so it stays mounted across navigations between sibling images —
// otherwise Next.js would unmount it on every router.push and the browser
// would exit fullscreen immediately.
export function FullscreenShell({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalContainer(rootRef.current);
    function sync() {
      setFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  async function enterFullscreen() {
    if (!rootRef.current) return;
    try {
      await rootRef.current.requestFullscreen({ navigationUI: "hide" });
    } catch (err) {
      console.error("Fullscreen request failed:", err);
    }
  }

  async function exitFullscreen() {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <FullscreenContext.Provider
      value={{ fullscreen, enterFullscreen, exitFullscreen, portalContainer }}
    >
      <div
        ref={rootRef}
        className={fullscreen ? "fixed inset-0 z-50 bg-[#0a0a0a] flex" : ""}
      >
        {children}
      </div>
    </FullscreenContext.Provider>
  );
}
