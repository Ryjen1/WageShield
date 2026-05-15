"use client";

import { useEffect } from "react";

/**
 * Tracks the mouse and updates `--x` / `--y` CSS custom properties on the
 * spotlight overlay so the radial gradient follows the cursor. Purely
 * decorative; respects prefers-reduced-motion via the CSS (`display:none`
 * in @media block).
 */
export function CursorSpotlight() {
  useEffect(() => {
    const el = document.getElementById("cursor-spotlight");
    if (!el) return;
    let rafId: number | null = null;
    let pendingX = 0;
    let pendingY = 0;

    const onMove = (e: MouseEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          el.style.setProperty("--x", `${pendingX}px`);
          el.style.setProperty("--y", `${pendingY}px`);
          rafId = null;
        });
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return <div id="cursor-spotlight" className="cursor-spotlight" aria-hidden />;
}
