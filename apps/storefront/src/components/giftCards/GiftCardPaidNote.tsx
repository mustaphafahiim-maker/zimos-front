"use client";

import { useMemo } from "react";
import { card } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";
import { useIsClient } from "@/lib/useIsClient";
import { giftCardOrderOf } from "./giftCardOrders";

/**
 * The thank-you page's gift-card line: «اتدفع بكارت هدية
 * ••••X9UK: 250 ج.م.» and what is left to pay on delivery — or that the card
 * could not be used. Nothing for an order placed without a card.
 */
export function GiftCardPaidNote({ workspaceId, orderId }: { workspaceId: string; orderId: string }) {
  const { t, money } = useStore();
  const copy = t.giftCards;
  const isClient = useIsClient();
  const paid = useMemo(() => (isClient ? giftCardOrderOf(workspaceId, orderId) : null), [isClient, workspaceId, orderId]);
  if (!paid) return null;

  const due = Math.max(0, paid.total - paid.amount);
  return (
    <section className={`${card} mt-6 p-5 sm:p-6`} aria-label={copy.title}>
      {paid.amount > 0 ? (
        <>
          <p className="text-sm font-semibold text-success">{copy.paidWith(paid.last4, money(paid.amount, paid.currency))}</p>
          {due > 0 ? (
            <p className="mt-2 flex justify-between gap-3 text-base font-bold text-ink">
              <span>{copy.payOnDelivery}</span>
              <span>{money(due, paid.currency)}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink">{copy.paidInFull}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-ink">{copy.notTaken}</p>
      )}
    </section>
  );
}
