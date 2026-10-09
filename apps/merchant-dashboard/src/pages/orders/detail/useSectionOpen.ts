import { useCallback, useState } from "react";
import type { Order, OrderStage } from "@store-builder/api-client";

/**
 * The folding sections the page opens and closes itself: the three the
 * order's stage decides, and the two a chip in the hero leads to. (The others
 * just remember what the merchant did, for the tab.)
 */
export type OrderSectionId = "confirmation" | "shipments" | "payments" | "customer" | "gift";

/** Their element ids — the first three are the in-page anchors that already existed (#order-shipments…). */
export const ORDER_SECTION_ELEMENT: Record<OrderSectionId, string> = {
  confirmation: "order-confirmation",
  shipments: "order-shipments",
  payments: "order-payments",
  customer: "order-customer",
  gift: "order-gift",
};

/** From "ready to ship" until it is delivered, the shipments are where the work is. */
const SHIPPING_WORK_STAGES: ReadonlySet<OrderStage> = new Set<OrderStage>(["ready_to_ship", "shipped", "out_for_delivery", "delivery_failed"]);

/** The order's flags that the Shipments / Payments cards explain with an alert: a folded section would hide it. */
export const SHIPMENT_FLAG = "carrier_cancel_unconfirmed";
export const PAYMENT_FLAGS: ReadonlySet<string> = new Set([
  "duplicate_payment",
  "paid_after_expiry",
  "paid_after_cancel",
  "paid_after_cod_switch",
  "payment_amount_mismatch",
  "test_payment",
]);

/** Which of them starts open for this order, before the merchant touches anything. */
export function orderSectionDefaults(order: Order, confirmationOpen: boolean): Record<OrderSectionId, boolean> {
  const flags = order.riskFlags ?? [];
  return {
    // Open only while the order is still to be confirmed.
    confirmation: confirmationOpen,
    shipments: (order.stage !== undefined && SHIPPING_WORK_STAGES.has(order.stage)) || flags.includes(SHIPMENT_FLAG),
    payments: order.stage === "awaiting_payment" || flags.some((flag) => PAYMENT_FLAGS.has(flag)),
    // Folded until asked for: their one-line summary (and the hero's chip) says what is inside.
    customer: false,
    gift: false,
  };
}

/**
 * Open / closed for the sections the page drives, and the way the hero — its
 * next-step button, its chips — takes the merchant to one of them. No hash in
 * the address is used for that: the list's scroll memory reads every hash
 * change as a step back in history.
 *
 * What the merchant opens or folds by hand holds for this order at this
 * stage; when the order moves on, the stage's own default applies again (a
 * section folded while waiting for the call opens by itself once the order
 * is ready to ship).
 */
export function useSectionOpen(order: Order, confirmationOpen: boolean) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const scope = `${order.id}:${order.stage ?? ""}`;
  const defaults = orderSectionDefaults(order, confirmationOpen);

  const isOpen = (id: OrderSectionId): boolean => overrides[`${scope}:${id}`] ?? defaults[id];

  const setOpen = useCallback(
    (id: OrderSectionId, open: boolean) => setOverrides((prev) => ({ ...prev, [`${scope}:${id}`]: open })),
    [scope]
  );

  /** Opens the section, brings it under the top bar and, when asked, puts the keyboard in its form. */
  const reveal = useCallback(
    (id: OrderSectionId, focusForm = false) => {
      setOpen(id, true);
      // Two frames: the section has to be drawn open before it can be scrolled to and focused.
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => {
          const section = document.getElementById(ORDER_SECTION_ELEMENT[id]);
          if (!section) return;
          const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
          section.scrollIntoView({ behavior: calm ? "instant" : "smooth", block: "start" });
          if (!focusForm) return;
          const field =
            // The new-shipment form starts with its "how" choice.
            section.querySelector<HTMLElement>('.zimos-accordion-body fieldset input[type="radio"]:not(:disabled)') ??
            section.querySelector<HTMLElement>(
              ".zimos-accordion-body :is(a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled))"
            );
          field?.focus({ preventScroll: true });
        })
      );
    },
    [setOpen]
  );

  return { isOpen, setOpen, reveal };
}

export type OrderSectionControl = ReturnType<typeof useSectionOpen>;
