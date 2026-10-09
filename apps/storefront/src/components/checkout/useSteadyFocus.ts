"use client";

import { useEffect, type RefObject } from "react";

/** A tap somewhere else this recently means the shopper changed the page themselves: nothing is held then. */
const OWN_ACTION_MS = 700;
/** A move larger than this is a different layout (a rotated phone), not a block arriving. */
const MAX_MOVE_PX = 600;

/**
 * Keeps the field the shopper is in where it is on the screen.
 *
 * Parts of the checkout arrive after the page is up — the delivery-or-pickup
 * choice, the saved addresses, the address search — and an error line can
 * appear under the field just left. Each pushes the fields below it down,
 * and the one being typed in jumps under the thumb. This watches the form's
 * column: when its height changes while a field inside it has the focus, and
 * that field has moved, the page is scrolled by the same distance in the same
 * frame, so the field stays put.
 *
 * It only ever undoes a move of the focused field. It does nothing when the
 * shopper caused the change by tapping something else a moment ago (choosing
 * pickup, opening a block): then they want to see what appeared.
 */
export function useSteadyFocus(column: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = column.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    let field: HTMLElement | null = null;
    let top = 0;
    let pressed: { target: EventTarget | null; top: number; at: number } | null = null;

    const isField = (el: EventTarget | null): el is HTMLElement =>
      el instanceof HTMLElement && root.contains(el) && el.matches("input, select, textarea");

    const hold = (moved: number) => {
      if (Math.abs(moved) < 1 || Math.abs(moved) > MAX_MOVE_PX) return;
      window.scrollBy(0, moved);
    };

    const note = () => {
      if (field) top = field.getBoundingClientRect().top;
    };

    const onPointerDown = (e: PointerEvent) => {
      pressed = { target: e.target, top: isField(e.target) ? e.target.getBoundingClientRect().top : 0, at: Date.now() };
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!isField(e.target)) {
        field = null;
        return;
      }
      field = e.target;
      // Tapped a moment ago: where it was under the finger is where it stays (the field just left may have grown an error line).
      if (pressed && pressed.target === field && Date.now() - pressed.at < OWN_ACTION_MS) {
        hold(field.getBoundingClientRect().top - pressed.top);
      }
      note();
    };

    const onFocusOut = () => {
      field = null;
    };

    const observer = new ResizeObserver(() => {
      if (!field || document.activeElement !== field) return;
      const ownAction = pressed !== null && pressed.target !== field && Date.now() - pressed.at < OWN_ACTION_MS;
      if (!ownAction) hold(field.getBoundingClientRect().top - top);
      note();
    });

    observer.observe(root);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", note, { passive: true });
    return () => {
      observer.disconnect();
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", note);
    };
  }, [column]);
}
