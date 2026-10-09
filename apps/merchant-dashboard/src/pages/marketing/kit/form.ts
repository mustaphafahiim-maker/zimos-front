import { revealInBody } from "@/pages/orders/create/reveal";

/**
 * After a submit that found problems: brings the first field marked invalid
 * into view and puts the caret in it, so the merchant lands on what to fix
 * instead of hunting for it. Call it right after setting the errors — it waits
 * for React to draw them. Inside a sheet only the sheet's body scrolls.
 */
export function focusFirstInvalid(root: HTMLElement | null): void {
  if (!root) return;
  window.requestAnimationFrame(() => {
    const field = root.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!field) return;
    if (field.closest('[data-slot="sheet-body"]')) {
      revealInBody(field, "center");
    } else {
      const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
      field.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    }
    field.focus({ preventScroll: true });
  });
}
