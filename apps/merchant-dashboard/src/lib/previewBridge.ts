/**
 * The dashboard half of the message bridge between the website editor and its
 * live storefront preview. The storefront half is
 * apps/storefront/src/components/preview/PreviewBridge.tsx; the two apps share
 * no code, so the shapes are spelled out on both sides.
 *
 * Frame → editor (only ever accepted from the storefront origin, and only
 * from a frame this editor owns):
 *   { type: "zimos:preview-ready", sectionIds }   after every (re)load
 *   { type: "zimos:select-section", sectionId }   a section was clicked
 *   { type: "zimos:insert-section", index }       "add a section here"
 *
 * Editor → frame (posted to the storefront origin, never "*"):
 *   { type: "zimos:editor-state", selectedId, labels, strings, theme }
 *   { type: "zimos:scroll-to-section", sectionId }
 */

/** An unsaved store look, as the storefront's `readPreviewTheme` accepts it. */
export interface PreviewTheme {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  cornerRadius?: string;
  /** Undefined leaves the saved logo alone; null previews "no logo". */
  logoUrl?: string | null;
}

export type FrameMessage =
  | { type: "zimos:preview-ready"; sectionIds: string[] }
  | { type: "zimos:select-section"; sectionId: string }
  | { type: "zimos:insert-section"; index: number };

export interface EditorStateMessage {
  type: "zimos:editor-state";
  selectedId: string | null;
  labels: Record<string, string>;
  strings: { addAbove: string; addBelow: string };
  theme: PreviewTheme | null;
}

export interface ScrollToSectionMessage {
  type: "zimos:scroll-to-section";
  sectionId: string;
}

/** `scheme://host[:port]` of a URL, or null when it isn't one. */
export function originOf(url: string): string | null {
  try {
    const { origin } = new URL(url);
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

/** Ids are free-form strings server-side; this only rules out junk. */
function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

/**
 * Reads a `message` event as a frame message, or null when it must be
 * ignored: from any origin but the storefront's, from a window that isn't one
 * of the editor's own preview frames (when `frames` is given), or not one of
 * the three shapes above. Anything can post to the dashboard window, so every
 * field is checked rather than cast.
 */
export function readFrameMessage(
  event: Pick<MessageEvent, "origin" | "data"> & { source?: unknown },
  storefrontOrigin: string | null,
  frames?: ReadonlyArray<unknown>
): FrameMessage | null {
  if (!storefrontOrigin || event.origin !== storefrontOrigin) return null;
  if (frames && !frames.some((frame) => frame != null && frame === event.source)) return null;

  const data = event.data as Record<string, unknown> | null;
  if (!data || typeof data !== "object") return null;

  switch (data.type) {
    case "zimos:preview-ready":
      return {
        type: "zimos:preview-ready",
        sectionIds: Array.isArray(data.sectionIds) ? data.sectionIds.filter(isId) : [],
      };
    case "zimos:select-section":
      return isId(data.sectionId) ? { type: "zimos:select-section", sectionId: data.sectionId } : null;
    case "zimos:insert-section":
      return typeof data.index === "number" && Number.isInteger(data.index) && data.index >= 0
        ? { type: "zimos:insert-section", index: data.index }
        : null;
    default:
      return null;
  }
}
