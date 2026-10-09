"use client";

import { ON_ACCOUNT_METHOD } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { useStore } from "@/lib/StoreContext";
import { useBusinessCopy } from "./businessCopy";
import { ON_ACCOUNT_PATH } from "./paths";

/**
 * The thank-you page's part of paying later on account (handoff 229). An
 * on-account order is not paid on delivery, so the order summary's «الدفع عند
 * الاستلام» badge and the page's words say what it is instead: «دفع آجل»,
 * nothing to pay at the door, and when it is due.
 *
 * Both read the order as this device saved it at checkout (lib/commerce
 * `snapshotFromOrder` keeps the order's payment method and due date).
 */

/** What the saved order says about how it is paid. */
interface PaidHow {
  paymentMethod?: string | null;
  paymentDueAt?: string | null;
}

export function isOnAccountSnapshot(snapshot: PaidHow | null | undefined): boolean {
  return snapshot?.paymentMethod === ON_ACCOUNT_METHOD;
}

/** The summary's badge: «دفع آجل» for an on-account order, the page's own «الدفع عند الاستلام» for every other. */
export function ThankYouPaymentLabel({ snapshot, fallback }: { snapshot: PaidHow; fallback: string }) {
  const copy = useBusinessCopy();
  return <>{isOnAccountSnapshot(snapshot) ? copy.onAccountBadge : fallback}</>;
}

/** Under the summary's totals: nothing to pay at the door, the due date, and the way to the account's balance. */
export function OnAccountPlacedNote({ snapshot }: { snapshot: PaidHow }) {
  const { intlLocale } = useStore();
  const copy = useBusinessCopy();
  if (!isOnAccountSnapshot(snapshot)) return null;
  const due = snapshot.paymentDueAt ? new Date(snapshot.paymentDueAt) : null;
  const date = due && !Number.isNaN(due.getTime()) ? new Intl.DateTimeFormat(intlLocale, { dateStyle: "long" }).format(due) : null;
  return (
    <p className="mt-3 rounded-xl bg-primary-soft px-3 py-2 text-sm text-ink">
      {copy.onAccountPlaced(date)}{" "}
      <StoreLink href={ON_ACCOUNT_PATH} className="font-medium text-primary underline-offset-4 hover:underline">
        {copy.seeBalance}
      </StoreLink>
    </p>
  );
}
