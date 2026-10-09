import { useEffect, useState } from "react";

/**
 * Whether a media query matches now, kept current as the window changes.
 * False where `matchMedia` is missing (an old webview, a test).
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia?.(query).matches === true);
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/**
 * The lists of Returns and Protection are cards until the page column is wide
 * enough for a sheet of rows with five columns. Beside the 248px side menu that
 * is a 1152px window: under it a row is a `ListRowCard`, from it up a line of
 * the sheet (./DeskList.tsx).
 */
export function useIsCompact(): boolean {
  return useMediaQuery("(max-width: 71.99rem)");
}

/** Below Tailwind's md: the dock is up, and a header keeps to its title. */
export function useIsPhone(): boolean {
  return useMediaQuery("(max-width: 47.99rem)");
}
