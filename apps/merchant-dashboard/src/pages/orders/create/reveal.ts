/**
 * Brings something into view by scrolling the sheet's own body, and nothing
 * else. `scrollIntoView` would also move every ancestor that can scroll — the
 * screen-sized frame around a sheet among them, which would drag the whole
 * sheet up the screen.
 *
 *  - `nearest`  the least movement that shows it whole (its top wins when it is taller than the body);
 *  - `center`   in the middle of the body: a field with a message under it.
 */
export function revealInBody(element: HTMLElement, where: "nearest" | "center"): void {
  const body = element.closest<HTMLElement>('[data-slot="sheet-body"]');
  if (!body) return;
  const target = element.getBoundingClientRect();
  const frame = body.getBoundingClientRect();
  let delta = 0;
  if (where === "center") {
    delta = target.top + target.height / 2 - (frame.top + frame.height / 2);
  } else {
    const air = 12;
    if (target.bottom > frame.bottom - air) delta = target.bottom - (frame.bottom - air);
    if (target.top - delta < frame.top + air) delta = target.top - (frame.top + air);
  }
  if (Math.abs(delta) < 1) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  body.scrollBy({ top: delta, behavior: reduced ? "auto" : "smooth" });
}
