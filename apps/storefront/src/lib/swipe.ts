/**
 * The pointer-drag-as-swipe math behind `ProductGallery`'s swipe-to-advance,
 * factored out so the product card's image carousel can step through photos
 * the same way instead of reimplementing the threshold and the
 * mostly-vertical-drag guard.
 */

/** A drag shorter than this is a tap, not a swipe. */
export const SWIPE_PX = 45;

/**
 * `null` when the drag was too short to count, or travelled more vertically
 * than horizontally (the page being scrolled, not a swipe) — otherwise the
 * step to take: `forward` for a drag towards the reading end, `-forward` for
 * the other way. `forward` is `-1` in an RTL store, where "next" sits to the
 * left.
 */
export function swipeStep(
  start: { x: number; y: number },
  end: { x: number; y: number },
  forward: number
): number | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) <= SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return null;
  return dx < 0 ? forward : -forward;
}
