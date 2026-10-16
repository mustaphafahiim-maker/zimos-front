/**
 * Brings a form field to the middle of the screen, then focuses it.
 *
 * A bare `focus()` scrolls only as far as the field's nearest edge (Safari),
 * which on a phone leaves it under the sticky header; centring it keeps the
 * field and the message under it in view. The scroll glides unless the
 * shopper asked for reduced motion, and the focus itself doesn't scroll again.
 */
export function focusField(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const calm = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView?.({ block: "center", behavior: calm ? "auto" : "smooth" });
  el.focus({ preventScroll: true });
}
