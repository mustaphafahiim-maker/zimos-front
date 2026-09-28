import { useEffect } from "react";

/**
 * The store themes' heading faces, for the type specimen in each theme's
 * thumbnail (pages/website/editor/ThemeSketch.tsx). Bundled from @fontsource
 * — served from the dashboard's own origin like the Inter it already ships —
 * so a thumbnail never depends on a font CDN, the same rule the storefront
 * follows for the themes themselves (apps/storefront/src/app/themeFonts.ts).
 *
 * Only the one weight each specimen uses, and only the Latin and Arabic
 * subsets. Imported on demand: nothing is fetched until a theme picker is on
 * screen, and a browser only downloads a file once text in it is drawn.
 */

let loading: Promise<void> | null = null;

export function loadThemeFonts(): Promise<void> {
  loading ??= Promise.all([
    import("@fontsource/cormorant-garamond/latin-500.css"),
    import("@fontsource/markazi-text/arabic-500.css"),
    import("@fontsource/archivo/latin-800.css"),
    import("@fontsource/cairo/arabic-800.css"),
    import("@fontsource/alexandria/latin-500.css"),
    import("@fontsource/alexandria/arabic-500.css"),
    import("@fontsource/lora/latin-700.css"),
    import("@fontsource/noto-naskh-arabic/arabic-700.css"),
    import("@fontsource/baloo-bhaijaan-2/latin-700.css"),
    import("@fontsource/baloo-bhaijaan-2/arabic-700.css"),
    import("@fontsource/space-grotesk/latin-600.css"),
    import("@fontsource/readex-pro/arabic-600.css"),
  ]).then(
    () => undefined,
    () => {
      // A specimen falls back to the stack's generic face; nothing else depends on it.
      loading = null;
    }
  );
  return loading;
}

/** Starts loading the specimen faces when a theme picker mounts. */
export function useThemeFonts() {
  useEffect(() => {
    void loadThemeFonts();
  }, []);
}
