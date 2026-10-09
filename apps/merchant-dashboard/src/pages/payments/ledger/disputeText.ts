import type { PaymentDispute, PaymentDisputeStatus } from "@store-builder/api-client";
import { fmt, getLocale, type Messages } from "@/i18n/LocaleContext";

/** The words of card disputes (handoff 377), shared by the disputes list and the order's payment card. */
export const DISPUTE_STRINGS = {
  en: {
    status_inquiry: "Inquiry",
    status_needs_response: "Needs your response",
    status_under_review: "Under review",
    status_won: "Won",
    status_lost: "Lost",
    status_closed: "Closed",
    reason_fraudulent: "Customer says they didn't make this payment",
    reason_product_not_received: "Customer says the order never arrived",
    reasonOther: "Other reason ({reason})",
    open: "This payment is disputed ({amount}) — respond by {evidenceDueBy}",
    openNoDate: "This payment is disputed ({amount})",
    respond: "Respond in {gateway}",
    won: "Dispute closed in your favour",
    closed: "Inquiry closed, nothing was taken",
    lost: "Dispute lost — the bank returned {amount} to the customer",
    chargeback: "Chargeback",
    refundedInGateway: "Refunded in {gateway}",
    // the disputes list
    tabTitle: "Payment disputes",
    filterLabel: "Filter disputes by status",
    filterOpen: "Open",
    filterAll: "All",
    colOrder: "Order",
    colStatus: "Status",
    colAmount: "Amount",
    colReason: "Reason",
    colGateway: "Gateway",
    colDue: "Respond by",
    colOpened: "Opened",
    openOrder: "Open order {number}",
    hint: "You answer a dispute (upload evidence) in the gateway's own dashboard. A disputed order is flagged so it isn't shipped by mistake.",
    emptyOpenTitle: "No open disputes",
    emptyOpenHint: "When a shopper disputes a card payment with their bank or PayPal, it shows here with the deadline to respond.",
    emptyTitle: "No disputes here",
    emptyHint: "No dispute has this status.",
    shipBlocked: "This card payment is disputed or was charged back — review the order before shipping it",
    shipAnyway: "Ship anyway",
  },
  ar: {
    status_inquiry: "استفسار",
    status_needs_response: "محتاج ردك",
    status_under_review: "تحت المراجعة",
    status_won: "كسبته",
    status_lost: "خسرته",
    status_closed: "اتقفل",
    reason_fraudulent: "العميل بيقول إنه ما عملش الدفعة",
    reason_product_not_received: "العميل بيقول إن الطلب ما وصلوش",
    reasonOther: "سبب تاني ({reason})",
    open: "فيه نزاع على الدفعة دي ({amount}) — آخر ميعاد للرد {evidenceDueBy}",
    openNoDate: "فيه نزاع على الدفعة دي ({amount})",
    respond: "رد من لوحة {gateway}",
    won: "النزاع اتقفل لصالحك",
    closed: "الاستفسار اتقفل من غير خصم",
    lost: "خسرت النزاع — البنك رجّع {amount} للعميل",
    chargeback: "رد بنكي (Chargeback)",
    refundedInGateway: "اترجع من لوحة {gateway}",
    tabTitle: "نزاعات على الدفع",
    filterLabel: "فلتر النزاعات بالحالة",
    filterOpen: "مفتوحة",
    filterAll: "الكل",
    colOrder: "الطلب",
    colStatus: "الحالة",
    colAmount: "المبلغ",
    colReason: "السبب",
    colGateway: "البوابة",
    colDue: "آخر ميعاد للرد",
    colOpened: "اتفتح",
    openOrder: "افتح الطلب {number}",
    hint: "الرد على النزاع (رفع الإثباتات) بيتم من لوحة البوابة نفسها. الطلب اللي عليه نزاع بيتعلّم عشان ما يتشحنش بالغلط.",
    emptyOpenTitle: "مفيش نزاعات مفتوحة",
    emptyOpenHint: "لما عميل يعترض على دفعة بالبطاقة عند البنك أو PayPal، هتظهر هنا ومعاها آخر ميعاد للرد.",
    emptyTitle: "مفيش نزاعات هنا",
    emptyHint: "مفيش نزاع بالحالة دي.",
    shipBlocked: "الدفع بالبطاقة عليه نزاع أو اترجع من البنك — راجع الطلب قبل ما تشحنه",
    shipAnyway: "اشحن برضه",
  },
} satisfies Messages;

export type DisputeStrings = (typeof DISPUTE_STRINGS)["en"];

export const DISPUTE_TONE: Record<PaymentDisputeStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  inquiry: "info",
  needs_response: "warning",
  under_review: "info",
  won: "success",
  lost: "danger",
  closed: "neutral",
};

export function disputeStatusText(t: DisputeStrings, status: string): string {
  const key = `status_${status}` as keyof DisputeStrings;
  return key in t ? t[key] : status;
}

/** The gateway's reason code in the merchant's words; an unknown code is shown as it came. */
export function disputeReasonText(t: DisputeStrings, reason: string | null): string {
  if (!reason) return "—";
  const code = reason.toLowerCase();
  if (code === "fraudulent" || code === "unauthorised" || code === "unauthorized") return t.reason_fraudulent;
  if (code === "product_not_received" || code === "merchandise_or_service_not_received") return t.reason_product_not_received;
  return fmt(t.reasonOther, { reason });
}

/** Where the merchant answers it: Stripe's page of this dispute (test keys have their own), PayPal's resolution centre. */
export function disputeRespondUrl(dispute: Pick<PaymentDispute, "providerCode" | "providerDisputeId">, testMode: boolean): string | null {
  if (dispute.providerCode === "paypal") return "https://www.paypal.com/resolutioncenter";
  if (dispute.providerCode === "stripe" && dispute.providerDisputeId) {
    return `https://dashboard.stripe.com/${testMode ? "test/" : ""}disputes/${encodeURIComponent(dispute.providerDisputeId)}`;
  }
  return null;
}

/** The order timeline's second line for an `order.payment_dispute` audit row: the status it moved to. Null for any other row. */
export function disputeTimelineDetail(action: string, after: unknown): string | null {
  if (action !== "order.payment_dispute" || !after || typeof after !== "object") return null;
  const status = (after as { status?: unknown }).status;
  return typeof status === "string" ? disputeStatusText(DISPUTE_STRINGS[getLocale()], status) : null;
}

export function isOpenDispute(status: string): boolean {
  return status === "inquiry" || status === "needs_response" || status === "under_review";
}
