import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Whether a box is at least `minWidth` pixels wide, kept up to date as it
 * resizes. The variants are a grid where there is room for six columns and
 * cards where there is not — and that depends on the column the section sits
 * in (beside the section index, in a narrow window), not on the screen alone.
 *
 * Until the box has been measured the answer is `fallback` (the screen's own
 * width is a good first guess); where nothing can observe sizes it stays that.
 */
export function useWideEnough<T extends HTMLElement>(minWidth: number, fallback: boolean): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [wide, setWide] = useState(fallback);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver !== "function") return undefined;
    const read = (width: number) => setWide(width >= minWidth);
    // A hidden box (a folded section) measures zero: keep the last answer until it is shown.
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) read(width);
    });
    observer.observe(node);
    const now = node.getBoundingClientRect().width;
    if (now > 0) read(now);
    return () => observer.disconnect();
  }, [minWidth]);

  return [ref, wide];
}
