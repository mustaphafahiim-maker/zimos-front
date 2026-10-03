/**
 * The arithmetic behind the start pane's adjustable split ("Page sections"
 * above, "Add a block" below — see ResizableSplit.tsx). Pure, so the clamping
 * rules are tested on their own.
 *
 * The split is stored as a ratio of the space the two panes share (the pane's
 * height minus the handle), not in pixels: a split the merchant set on a tall
 * monitor then still means "about half" on a laptop, and the pixel value is
 * only worked out, and clamped, at the height the pane actually has.
 */

/** Neither pane may be dragged smaller than this. */
export const SPLIT_MIN_PX = 120;
/** "Page sections" starts a little under half, so the library keeps the larger share. */
export const SPLIT_DEFAULT_RATIO = 0.48;
/** The drag handle's own height, which neither pane gets. */
export const SPLIT_HANDLE_PX = 10;
/** One arrow-key press; Shift moves four times as far. */
export const SPLIT_KEY_STEP_PX = 16;

/**
 * A top-pane height clamped so both panes keep at least `min` pixels. A pane
 * too short to give both their minimum is split evenly instead, so neither
 * one ever collapses to nothing.
 */
export function clampSplitPx(
  topPx: number,
  containerPx: number,
  handlePx = SPLIT_HANDLE_PX,
  min = SPLIT_MIN_PX
): number {
  const available = Math.max(0, containerPx - handlePx);
  if (available <= 2 * min) return available / 2;
  if (!Number.isFinite(topPx)) return available * SPLIT_DEFAULT_RATIO;
  return Math.min(available - min, Math.max(min, topPx));
}

/** The ratio a top-pane height stands for, after clamping. */
export function splitRatio(topPx: number, containerPx: number, handlePx = SPLIT_HANDLE_PX): number {
  const available = Math.max(0, containerPx - handlePx);
  if (available === 0) return SPLIT_DEFAULT_RATIO;
  return clampSplitPx(topPx, containerPx, handlePx) / available;
}

/** The top-pane height a ratio gives at this container height, clamped. */
export function splitPx(ratio: number, containerPx: number, handlePx = SPLIT_HANDLE_PX): number {
  const available = Math.max(0, containerPx - handlePx);
  return clampSplitPx(ratio * available, containerPx, handlePx);
}

/**
 * A stored ratio read back. Anything missing, malformed or absurd (a ratio
 * that would leave a pane with almost nothing on any screen) falls back to
 * the default rather than being trusted.
 */
export function readSplitRatio(raw: string | null | undefined): number {
  if (raw === null || raw === undefined || raw.trim() === "") return SPLIT_DEFAULT_RATIO;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0.05 || value > 0.95) return SPLIT_DEFAULT_RATIO;
  return value;
}

/**
 * The top-pane height after one key press on the handle, or null for a key
 * the handle doesn't use. Up makes "Page sections" shorter, Down taller —
 * the handle moves the way the arrow points. Home and End jump to either end.
 */
export function keyboardSplitPx(
  key: string,
  { shiftKey = false }: { shiftKey?: boolean },
  topPx: number,
  containerPx: number,
  handlePx = SPLIT_HANDLE_PX
): number | null {
  const step = SPLIT_KEY_STEP_PX * (shiftKey ? 4 : 1);
  switch (key) {
    case "ArrowUp":
      return clampSplitPx(topPx - step, containerPx, handlePx);
    case "ArrowDown":
      return clampSplitPx(topPx + step, containerPx, handlePx);
    case "Home":
      return clampSplitPx(0, containerPx, handlePx);
    case "End":
      return clampSplitPx(Number.MAX_SAFE_INTEGER, containerPx, handlePx);
    default:
      return null;
  }
}
