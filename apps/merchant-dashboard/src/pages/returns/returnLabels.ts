import { useMemo } from "react";
import type { ReturnRequest, ReturnStatus } from "@store-builder/api-client";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { humanize } from "@/lib/format";
import { RETURN_REASON_TEXT } from "./ReturnExtras";

const STRINGS = {
  en: {
    statusRequested: "Awaiting your decision",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    statusReceived: "Received",
    statusRefunded: "Refunded",
    statusCancelled: "Cancelled",
    approve: "Approve",
    reject: "Reject",
    restock: "Receive and restock",
    noName: "Customer without a name",
    noOrder: "Order details unavailable",
  },
  ar: {
    statusRequested: "مستني قرارك",
    statusApproved: "مقبول",
    statusRejected: "مرفوض",
    statusReceived: "اتستلم",
    statusRefunded: "اتردّ تمنه",
    statusCancelled: "ملغي",
    approve: "وافق",
    reject: "ارفض",
    restock: "استلم ورجّع للمخزون",
    noName: "عميل من غير اسم",
    noOrder: "بيانات الأوردر مش متاحة",
  },
} satisfies Messages;

const STATUS_KEY = {
  requested: "statusRequested",
  approved: "statusApproved",
  rejected: "statusRejected",
  received: "statusReceived",
  refunded: "statusRefunded",
} satisfies Record<ReturnStatus, keyof typeof STRINGS.en>;

/** Every status a return can be in, in the order it moves through them. */
export const RETURN_STATUSES: readonly ReturnStatus[] = ["requested", "approved", "rejected", "received", "refunded"];

/**
 * The backend keeps one string: a reason code, or "code: the words typed with
 * it". Split it back apart so the code can be translated and the detail shown
 * verbatim, in whatever language it was typed.
 */
export function splitReason(reason: string): { code: string; detail: string | null } {
  const at = reason.indexOf(":");
  if (at === -1) return { code: reason.trim(), detail: null };
  return { code: reason.slice(0, at).trim(), detail: reason.slice(at + 1).trim() || null };
}

/** How many pieces a return sends back, over all its lines. */
export function returnPieces(ret: ReturnRequest): number {
  return ret.items.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * The backend moderates only a `requested` return and restocks only an
 * approved (or received) one that has not been restocked yet. These are the
 * only moves the dashboard offers: nothing here sets "received" or "refunded"
 * by hand.
 */
export function canModerate(ret: ReturnRequest): boolean {
  return ret.status === "requested";
}
export function canRestock(ret: ReturnRequest): boolean {
  return (ret.status === "approved" || ret.status === "received") && !ret.restockedAt;
}

/** The words for a status and for a reason code, in the language of the dashboard. */
export function useReturnLabels() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  return useMemo(
    () => ({
      // "cancelled" (handoff 396) is not in the ReturnStatus union yet.
      status: (status: ReturnStatus) => ((status as string) === "cancelled" ? t.statusCancelled : t[STATUS_KEY[status]]),
      /** The three moves the dashboard offers, said the same way on the row, in Quick Look and in the menu. */
      approve: t.approve,
      reject: t.reject,
      restock: t.restock,
      noName: t.noName,
      noOrder: t.noOrder,
      /** The same words the customer picked from on the store (ReturnExtras.RETURN_REASON_TEXT). */
      reason: (code: string) => (RETURN_REASON_TEXT[locale] as Record<string, string | undefined>)[code] ?? humanize(code),
    }),
    [t, locale]
  );
}
