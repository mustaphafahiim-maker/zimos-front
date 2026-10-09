"use client";

import { useMemo } from "react";
import { paymentTenderHolds, type ShopperPaymentStatus } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { useIsClient } from "@/lib/useIsClient";
import { tenderOrderOf } from "./tenderOrders";
import { useTenderCopy } from "./tenderCopy";

/**
 * The payment page's lines about a gift card, points and store credit held for
 * an unpaid online order (handoff 201, 203, 204; the status's `giftCardHeld`,
 * `pointsHeld`, `storeCreditHeld` and `amountDue`):
 *
 *   awaiting payment — «من كارت الهدية: 50 ج.م» for each part held, and what
 *                      the gateway is asked for, «هتدفع دلوقتي: 200 ج.م».
 *   expired / cancelled — the holds went back: «رجعنا رصيد كارت الهدية», for
 *                      the parts this device saw held when the order was placed.
 *   cash on delivery — after a switch, with a part already paid: what is left
 *                      for the courier.
 *
 * Nothing for an order placed without any of the three.
 */
export function PaymentHeldLines({ workspaceId, status }: { workspaceId: string; status: ShopperPaymentStatus }) {
  const { money } = useStore();
  const copy = useTenderCopy();
  const isClient = useIsClient();
  const placed = useMemo(() => (isClient ? tenderOrderOf(workspaceId, status.orderId) : null), [isClient, workspaceId, status.orderId]);
  const amount = (n: number) => money(n, status.currency);

  if (status.status === "expired" || status.status === "cancelled") {
    // Only what was held for the gateway comes back by itself; a part already paid is refunded by the store.
    if (!placed || !placed.online) return null;
    const lines = [
      placed.giftCard?.applied ? copy.returnedGiftCard : null,
      placed.points?.applied ? copy.returnedPoints : null,
      placed.credit?.applied ? copy.returnedCredit : null,
    ].filter((line): line is string => Boolean(line));
    if (lines.length === 0) return null;
    return (
      <ul className="space-y-1 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    );
  }

  const held = paymentTenderHolds(status);
  if (status.status === "cod") {
    // Switched to cash on delivery: the held parts paid theirs now, the courier collects the rest.
    if (status.amountPaid <= 0) return null;
    return held.amountDue === 0 ? (
      <p className="rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">{copy.paidWhole}</p>
    ) : (
      <p className="flex justify-between gap-3 rounded-xl bg-primary-soft px-4 py-3 text-base font-bold text-ink">
        <span>{copy.payOnDelivery}</span>
        <span>{amount(held.amountDue)}</span>
      </p>
    );
  }

  if (status.status !== "awaiting_payment") return null;
  if (held.giftCardHeld + held.pointsHeld + held.storeCreditHeld <= 0) return null;
  return (
    <div className="space-y-1.5 rounded-xl bg-primary-soft px-4 py-3 text-sm text-ink">
      {held.giftCardHeld > 0 && <p>{copy.fromGiftCard(amount(held.giftCardHeld))}</p>}
      {held.pointsHeld > 0 && <p>{copy.fromPoints(amount(held.pointsHeld))}</p>}
      {held.storeCreditHeld > 0 && <p>{copy.fromCredit(amount(held.storeCreditHeld))}</p>}
      <p className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold">
        <span>{copy.toPay}</span>
        <span>{amount(held.amountDue)}</span>
      </p>
    </div>
  );
}
