"use client";

import { useEffect, useState, type RefObject } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { useStore } from "@/lib/StoreContext";
import { CrossIcon } from "../Icons";
import { btnPrimary, focusRing } from "../ui";
import { FlashOnChange, busyProps } from "./LiveAmount";

/** The order's error, shown above the bar where the shopper's thumb is. */
export interface StickyBarAlert {
  message: string;
  /** The words of the "take me there" hint beside it. */
  showLabel: string;
  dismissLabel: string;
  /** Tapping the message: go to the first problem. */
  onShow: () => void;
  onDismiss: () => void;
}

/**
 * The phone checkout's bottom bar (UX plan S13, audit U-57): the total and
 * the order button stay in reach while the shopper fills in the form, which
 * on a phone sits above the summary and its button. Below `lg` only — wide
 * screens keep the sticky summary column. Rendered inside the checkout
 * <form>, so its button submits the very same form (validation, scrolling to
 * the first error and all).
 *
 * It steps aside while the page's own order button is on screen (never two
 * buttons at once) and while the on-screen keyboard is up, and the page keeps
 * room for it under its last line and when a field scrolls into view
 * (globals.css, `[data-checkout-bar]`), so it never covers what is being typed.
 *
 * `alert`: the order's error rides on top of the bar — the page's own error
 * line is under the summary, far below the fields on a phone. It leaves with
 * the bar (the page's line is then on screen itself).
 */
export function CheckoutStickyBar({
  anchor,
  totalLabel,
  total,
  buttonLabel,
  disabled,
  busy = false,
  alert = null,
}: {
  /** The page's own order button: while it is on screen the bar is not needed. */
  anchor: RefObject<HTMLElement | null>;
  totalLabel: string;
  /** The total as the summary shows it (the quote the API returned; nothing is computed here). */
  total: string;
  buttonLabel: string;
  disabled: boolean;
  /** The total is the last one shown while a new shipping quote is fetched. */
  busy?: boolean;
  alert?: StickyBarAlert | null;
}) {
  const { t } = useStore();
  const [anchorVisible, setAnchorVisible] = useState(false);
  const [keyboard, setKeyboard] = useState(false);

  useEffect(() => {
    const el = anchor.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setAnchorVisible(entry.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [anchor]);

  useEffect(() => {
    const vv = typeof window === "undefined" ? null : window.visualViewport;
    if (!vv) return;
    // The keyboard shrinks the visual viewport without zooming it (a pinch zoom scales it instead).
    const update = () => setKeyboard(vv.height * vv.scale < window.innerHeight * 0.75);
    update();
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, []);

  const hidden = anchorVisible || keyboard;
  const amount = busyProps(busy);

  return (
    <div
      data-checkout-bar=""
      role="region"
      aria-label={t.checkoutBar.label}
      inert={hidden}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-raised/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur transition-transform duration-200 motion-reduce:transition-none lg:hidden ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
    >
      {alert && (
        <div role="alert" className="mx-auto mb-2 flex max-w-xl items-stretch rounded-xl bg-danger-soft text-danger">
          <button
            type="button"
            onClick={alert.onShow}
            className={`flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-start text-sm font-medium ${focusRing}`}
          >
            <WarningCircleIcon size={20} weight="fill" className="shrink-0" aria-hidden="true" />
            <span className="line-clamp-2 min-w-0 flex-1">{alert.message}</span>
            <span className="shrink-0 text-xs font-semibold underline underline-offset-2">{alert.showLabel}</span>
          </button>
          <button
            type="button"
            onClick={alert.onDismiss}
            aria-label={alert.dismissLabel}
            className={`inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center self-center rounded-xl ${focusRing}`}
          >
            <CrossIcon size={18} />
          </button>
        </div>
      )}
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div aria-busy={amount["aria-busy"]} className={`min-w-0 shrink-0 ${amount.className}`}>
          <p className="text-xs text-ink-soft">{totalLabel}</p>
          <p className="truncate text-base font-bold text-ink">
            <FlashOnChange signal={total}>{total}</FlashOnChange>
          </p>
        </div>
        <button type="submit" disabled={disabled} className={`${btnPrimary} min-w-0 flex-1`}>
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Brings a message the shopper must read into view — the order's error under
 * the summary sits far below the form on a phone, where the bar's button was
 * tapped. Field errors move focus to the field instead.
 */
export function scrollIntoViewSoon(id: string) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  });
}
