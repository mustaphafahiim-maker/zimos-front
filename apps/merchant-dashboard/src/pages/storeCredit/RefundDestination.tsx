import { useId, useMemo, useState } from "react";
import { IconAward, IconCoins } from "@/components/icons";
import {
  isApiErrorCode,
  ordersRefundWithNotify,
  storeCreditRefundOrder,
  type Order,
  type Payment,
  type PaymentTimeline,
  type Refund,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { formatMoney } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { fmt, getLocale, useT } from "@/i18n/LocaleContext";
import { GIFT_CARDS_ENABLED, LOYALTY_ENABLED, STORE_CREDIT_ENABLED } from "@/lib/features";
import { LOYALTY_STRINGS } from "@/pages/loyalty/loyaltyStrings";
import { STORE_CREDIT_STRINGS } from "./storeCreditStrings";

/**
 * Where a refund goes (with the tender payments of 201 and 203):
 *
 *   money   — the order's normal refund: the gateway, or cash the merchant hands back.
 *   credit  — onto the customer's store credit (POST /store-credit/orders/:id/refund).
 *   tender  — back to what paid that part: a gift card, loyalty points or store credit,
 *             by naming that payment in the normal refund (`paymentId`). A refund that
 *             names no payment is never taken from one of these.
 */
export type RefundDestination =
  | { kind: "money"; key: "money" }
  | { kind: "credit"; key: "credit"; max: number }
  | { kind: "tender"; key: string; provider: StoreTender; paymentId: string; max: number; payment: Payment };

type StoreTender = "gift_card" | "loyalty" | "store_credit";
/** Each only while its feature is switched on (lib/features): off, the refund dialog is the one it always was. */
const STORE_TENDERS: readonly string[] = [
  ...(GIFT_CARDS_ENABLED ? ["gift_card"] : []),
  ...(LOYALTY_ENABLED ? ["loyalty"] : []),
  ...(STORE_CREDIT_ENABLED ? ["store_credit"] : []),
];

/** A part of an order paid with loyalty points or store credit (the gift card has its own name, GiftCardPaymentName). */
export function isStoreTenderPayment(payment: Pick<Payment, "providerCode">): boolean {
  return (LOYALTY_ENABLED && payment.providerCode === "loyalty") || (STORE_CREDIT_ENABLED && payment.providerCode === "store_credit");
}

/** The points a `loyalty` payment spent: the server writes `maskedDisplay` as "1000 points" (English, so only the number is read). */
function pointsOf(payment: Pick<Payment, "maskedDisplay">): number | null {
  const match = /^(\d+)\s+points?$/.exec(payment.maskedDisplay ?? "");
  return match ? Number(match[1]) : null;
}

/** The order page's name for a points or store-credit payment: «نقط ولاء (١٬٠٠٠ نقطة)», «رصيد المتجر». */
export function StoreTenderPaymentName({ payment }: { payment: Pick<Payment, "providerCode" | "maskedDisplay"> }) {
  const t = useT(STORE_CREDIT_STRINGS);
  const loyalty = useT(LOYALTY_STRINGS);
  if (payment.providerCode !== "loyalty") return <>{t.paymentCredit}</>;
  const points = pointsOf(payment);
  return (
    <>
      {t.paymentPoints}
      {points !== null && ` (${pluralOf(loyalty, "points", points)})`}
    </>
  );
}

/** Stands where a gateway's logo would, in the same 2:1 box as ProviderLogo's small size. */
export function StoreTenderPaymentIcon({ payment }: { payment: Pick<Payment, "providerCode"> }) {
  const Icon = payment.providerCode === "loyalty" ? IconAward : IconCoins;
  return (
    <span aria-hidden className="inline-flex h-7 w-14 shrink-0 items-center justify-center rounded-[0.5rem] border border-line bg-paper text-ink-soft">
      <Icon className="size-4" />
    </span>
  );
}

const CREDIT_REASON_PREFIX = "Store credit: ";
/** The reasons the server writes itself when a cancelled order gives its tender back (English in the API). */
const SYSTEM_REASONS: Record<string, { en: string; ar: string }> = {
  "Order cancelled: gift card balance returned": { en: "Order cancelled: gift card balance returned", ar: "أُلغي الطلب: أُعيد رصيد بطاقة الهدية" },
  "Order cancelled: points returned": { en: "Order cancelled: points returned", ar: "أُلغي الطلب: أُعيدت النقاط إلى العميل" },
  "Order cancelled: store credit returned": { en: "Order cancelled: store credit returned", ar: "أُلغي الطلب: أُعيد الرصيد إلى العميل" },
};

/**
 * A refund's reason as the order page shows it. A refund to store credit is
 * saved as "Store credit: <reason>": the mark is said in the dashboard's
 * language, the merchant's own words stay as typed.
 */
export function refundReasonText(reason: string): string {
  const ar = getLocale() === "ar";
  if (reason.startsWith(CREDIT_REASON_PREFIX)) return `${ar ? "رصيد في المتجر" : "Store credit"}: ${reason.slice(CREDIT_REASON_PREFIX.length)}`;
  const known = SYSTEM_REASONS[reason];
  return known ? (ar ? known.ar : known.en) : reason;
}

/** What is left to give back on one payment: its amount less the refunds already drawn on it. */
function leftOn(payment: Payment, refunds: Refund[]): number {
  const used = refunds
    .filter((r) => r.paymentId === payment.id && (r.status === "processed" || r.status === "pending"))
    .reduce((sum, r) => sum + Number(r.amount), 0);
  return Math.max(0, Number(payment.amount) - used);
}

export interface RefundDestinationState {
  options: RefundDestination[];
  chosen: RefundDestination;
  choose: (key: string) => void;
  /** True for the order's normal refund: the dialog sends it as it always did. */
  isMoney: boolean;
  /** The most this destination takes, minor units; null for money (the dialog's own rule). */
  max: number | null;
  /** Whether "notify the customer" applies (a refund to store credit sends nothing). */
  notifiable: boolean;
  /** A refund to store credit is saved with its reason: the API refuses it without one. */
  reasonRequired: boolean;
  /** Why the refund cannot be sent as it stands, or null. */
  problem: (reason: string) => string | null;
  /** Sends a refund that is not the normal one. */
  send: (
    body: { amount: number; reason: string; notifyCustomer: boolean },
    refundOnce?: (body: { amount: number; reason?: string; paymentId?: string; notifyCustomer?: boolean }) => Promise<Refund>
  ) => Promise<Refund>;
  groupName: string;
}

/**
 * The refund dialog's destination: the choices this order allows and the one
 * picked. Money is always there and picked first; store credit needs a
 * customer, the store's own currency and something paid; a gift card, points
 * or credit payment shows while part of it can still go back.
 */
export function useRefundDestination(order: Order, timeline: PaymentTimeline): RefundDestinationState {
  const t = useT(STORE_CREDIT_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const storeCurrency = currentWorkspace?.defaultCurrency ?? null;
  const groupName = useId();
  const [key, setKey] = useState("money");

  const options = useMemo<RefundDestination[]>(() => {
    const out: RefundDestination[] = [{ kind: "money", key: "money" }];
    // Paid and not refunded yet: the server's own limit for a refund to credit.
    const creditMax = Math.max(0, timeline.amountPaid - timeline.amountRefunded - timeline.pendingRefunds);
    if (STORE_CREDIT_ENABLED && order.customerId && creditMax > 0 && (!storeCurrency || storeCurrency === order.currency)) {
      out.push({ kind: "credit", key: "credit", max: creditMax });
    }
    for (const payment of timeline.attempts) {
      if (!STORE_TENDERS.includes(payment.providerCode)) continue;
      if (payment.status !== "captured" && payment.status !== "partially_refunded") continue;
      const left = leftOn(payment, timeline.refunds);
      if (left > 0) out.push({ kind: "tender", key: payment.id, provider: payment.providerCode as StoreTender, paymentId: payment.id, max: left, payment });
    }
    return out;
  }, [order.customerId, order.currency, storeCurrency, timeline]);

  const chosen = options.find((o) => o.key === key) ?? options[0];

  return {
    options,
    chosen,
    choose: setKey,
    isMoney: chosen.kind === "money",
    max: chosen.kind === "money" ? null : chosen.max,
    notifiable: chosen.kind !== "credit",
    reasonRequired: chosen.kind === "credit",
    // The API wants the reason of a refund to store credit (it is kept in the customer's credit history).
    problem: (reason) => (chosen.kind === "credit" && !reason.trim() ? t.reasonRequired : null),
    send: async ({ amount, reason, notifyCustomer }, refundOnce) => {
      if (chosen.kind === "tender") {
        return (refundOnce ?? ((body) => ordersRefundWithNotify(apiClient, workspaceId, order.id, body)))({
          amount,
          notifyCustomer,
          paymentId: chosen.paymentId,
          ...(reason ? { reason } : {}),
        });
      }
      const out = await storeCreditRefundOrder(apiClient, workspaceId, order.id, { amount, reason }).catch((err: unknown) => {
        // The two refusals only this refund has, in the merchant's words (the dialog shows an Error's own message).
        if (isApiErrorCode(err, "ORDER_HAS_NO_CUSTOMER")) throw new Error(t.noCustomer);
        if (isApiErrorCode(err, "STORE_CREDIT_CURRENCY")) throw new Error(t.otherCurrency);
        throw err;
      });
      const now = new Date().toISOString();
      // The dialog reads a refund row: the answer's four fields, the rest as the server saved them.
      return {
        id: out.refund.id,
        orderId: order.id,
        workspaceId,
        paymentId: null,
        amount: out.refund.amount,
        reason: out.refund.reason,
        status: out.refund.status,
        source: "merchant",
        providerRefundReference: null,
        failureReason: null,
        failureCode: null,
        processedAt: now,
        creditNoteId: null,
        processedByUserId: null,
        createdAt: now,
        updatedAt: now,
      };
    },
    groupName,
  };
}

/**
 * «الترجيع يروح فين؟» at the top of the refund dialog. Shown only when the
 * order has somewhere besides money to refund to. `onPick` hands the dialog
 * the new destination's limit (null: its own) so the amount follows it.
 */
export function RefundDestinationField({
  state,
  viaGateway,
  currency,
  onPick,
}: {
  state: RefundDestinationState;
  /** The order's money refund goes through a gateway (words the money option's hint). */
  viaGateway: boolean;
  currency: string;
  onPick: (max: number | null) => void;
}) {
  const t = useT(STORE_CREDIT_STRINGS);
  if (state.options.length < 2) return null;
  const money = (n: number) => formatMoney(n, currency);

  const text = (option: RefundDestination): { label: string; hint: string } => {
    if (option.kind === "money") return { label: t.toMoney, hint: viaGateway ? t.toMoneyHintGateway : t.toMoneyHintManual };
    if (option.kind === "credit") return { label: t.toCredit, hint: fmt(t.toCreditHint, { max: money(option.max) }) };
    if (option.provider === "gift_card") {
      const last4 = /([A-Z0-9]{4})\s*$/.exec(option.payment.maskedDisplay ?? "")?.[1];
      return {
        label: last4 ? fmt(t.toGiftCard, { card: `•••• ${last4}` }) : t.toGiftCardPlain,
        hint: fmt(t.toGiftCardHint, { max: money(option.max) }),
      };
    }
    if (option.provider === "loyalty") return { label: t.toPoints, hint: fmt(t.toPointsHint, { max: money(option.max) }) };
    return { label: t.toCreditPayment, hint: fmt(t.toCreditPaymentHint, { max: money(option.max) }) };
  };

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink">{t.destination}</legend>
      <div className="space-y-2">
        {state.options.map((option) => {
          const { label, hint } = text(option);
          return (
            <label
              key={option.key}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm text-ink ring-1 ring-line has-[:checked]:bg-primary-soft has-[:checked]:ring-primary"
            >
              <input
                type="radio"
                name={state.groupName}
                className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={state.chosen.key === option.key}
                onChange={() => {
                  state.choose(option.key);
                  onPick(option.kind === "money" ? null : option.max);
                }}
              />
              <span className="min-w-0">
                <span className="block font-medium">
                  <bdi>{label}</bdi>
                </span>
                <span className="block text-xs text-ink-soft">{hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
