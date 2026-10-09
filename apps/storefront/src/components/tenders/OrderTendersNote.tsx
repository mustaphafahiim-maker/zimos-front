"use client";

import { useMemo } from "react";
import { GiftCardPaidNote } from "@/components/giftCards/GiftCardPaidNote";
import { card } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";
import { useIsClient } from "@/lib/useIsClient";
import { tenderOrderOf } from "./tenderOrders";
import { useTenderCopy } from "./tenderCopy";

/** A part that could not be used although there was something for it to pay. */
const failed = (part: { applied: boolean; reason?: string } | undefined) => Boolean(part && !part.applied && part.reason !== "nothing_due");

/**
 * The thank-you page's line about what a gift card, loyalty points and store
 * credit paid (handoff 201, 203, 204), from the checkout's own answer kept on
 * this device: each part, then what is left for the courier — or «كارت
 * الهدية دفع الطلب كله» when nothing is. An order placed before this page
 * knew points and credit falls back to the gift card's own note (189).
 */
export function OrderTendersNote({ workspaceId, orderId }: { workspaceId: string; orderId: string }) {
  const { money } = useStore();
  const copy = useTenderCopy();
  const isClient = useIsClient();
  const paid = useMemo(() => (isClient ? tenderOrderOf(workspaceId, orderId) : null), [isClient, workspaceId, orderId]);
  if (!paid) return <GiftCardPaidNote workspaceId={workspaceId} orderId={orderId} />;

  const amount = (n: number) => money(n, paid.currency);
  const giftCard = paid.giftCard?.applied ? paid.giftCard : null;
  const credit = paid.credit?.applied ? paid.credit : null;
  const points = paid.points?.applied ? paid.points : null;
  const taken = (giftCard?.amount ?? 0) + (credit?.amount ?? 0) + (points?.amount ?? 0);
  const due = Math.max(0, paid.total - taken);
  const problems = [
    failed(paid.giftCard) ? copy.notTakenGiftCard : null,
    failed(paid.points) ? copy.notTakenPoints : null,
    failed(paid.credit) ? copy.notTakenCredit : null,
  ].filter((line): line is string => Boolean(line));
  if (taken === 0 && problems.length === 0) return null;

  const onlyGiftCard = Boolean(giftCard) && !credit && !points;
  return (
    <section className={`${card} mt-6 p-5 sm:p-6`} aria-labelledby="order-tenders-title">
      <h2 id="order-tenders-title" className="text-sm font-semibold text-ink">
        {copy.paidTitle}
      </h2>
      {taken > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm font-medium text-success">
          {giftCard && <li>{copy.paidGiftCard(giftCard.last4, amount(giftCard.amount))}</li>}
          {credit && <li>{copy.paidCredit(amount(credit.amount))}</li>}
          {points && <li>{copy.paidPoints(points.points, amount(points.amount))}</li>}
        </ul>
      )}
      {taken > 0 &&
        (paid.paidInStore || (!paid.online && due === 0) ? (
          <p className="mt-3 text-base font-bold text-ink">{onlyGiftCard ? copy.paidWholeByGiftCard : copy.paidWhole}</p>
        ) : !paid.online ? (
          <p className="mt-3 flex justify-between gap-3 text-base font-bold text-ink">
            <span>{copy.restOnDelivery}</span>
            <span>{amount(due)}</span>
          </p>
        ) : null)}
      {problems.map((line) => (
        <p key={line} className="mt-2 text-sm text-ink">
          {line}
        </p>
      ))}
      {(points?.balance !== undefined || credit?.balance !== undefined) && (
        <p className="mt-3 text-xs text-ink-soft">
          {[points?.balance !== undefined ? copy.pointsLeft(points.balance) : null, credit?.balance !== undefined ? copy.creditLeft(amount(credit.balance)) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </section>
  );
}
