import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const KEY = "zimos.scroll.v1";
const MAX_ENTRIES = 60;

function read(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function write(map: Record<string, number>) {
  try {
    const keys = Object.keys(map);
    if (keys.length > MAX_ENTRIES) for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete map[k];
    sessionStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* private mode — non-fatal */
  }
}

/**
 * Going back lands on the same scroll position:
 * the window's scroll is remembered per history entry while the page is used,
 * and put back on a POP navigation once the page has had a frame to draw its
 * cached list. A new page (PUSH / REPLACE) starts at the top, unless it has a
 * hash to scroll to. Mounted once, in the dashboard layout.
 */
export function useScrollRestoration(): void {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    let frame = 0;
    const save = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const map = read();
        map[window.history.state?.key ?? location.key] = window.scrollY;
        write(map);
      });
    };
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", save);
      window.removeEventListener("pagehide", save);
    };
    // The key is read from history at save time, so the listener is attached once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (navigationType === "POP") {
      const y = read()[location.key];
      if (typeof y === "number") {
        // Two frames: one for the cached list to render, one for its height to settle.
        const id = window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }))
        );
        return () => window.cancelAnimationFrame(id);
      }
      return;
    }
    if (location.hash) return;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location.key, location.hash, navigationType]);
}
