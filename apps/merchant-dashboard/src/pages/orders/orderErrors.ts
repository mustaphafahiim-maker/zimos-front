import { useCallback } from "react";
import { ApiError } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useErrorMessage } from "@/lib/errorMessages";

/**
 * Error wording for the orders screens' own API codes (status changes, notes,
 * tags, bulk actions…). Anything it does not know falls through to the shared
 * `useErrorMessage`.
 */
const STRINGS = {
  en: {
    INVALID_STATUS_TRANSITION: "This order can't be moved to that status from where it is now.",
    STATUS_UNCHANGED: "The order is already in that status.",
    ORDER_NOT_CANCELLED: "This order isn't cancelled.",
    ORDER_CANCELLED: "This order is cancelled.",
    ORDER_NOT_COD: "Only cash-on-delivery orders are confirmed by phone.",
    ORDER_ALREADY_CONFIRMED: "This order is already confirmed.",
    ORDER_NOT_CONFIRMED: "Confirm this order before shipping it.",
    ORDER_NOT_PAID: "This prepaid order must be paid before it ships.",
    ORDER_ALREADY_SHIPPED: "This order has already shipped and can't be changed.",
    INSUFFICIENT_STOCK: "There isn't enough stock left for this order.",
    // Handoff 274 — the words of lib/errorMessages.ts, repeated here so one order's row of a bulk answer says them too.
    ORDER_TENDER_RETURNED: "The points, store credit or gift card went back to the customer when this was cancelled — place a new order",
    // Handoff 229 — an order on account that would take the customer over their credit limit.
    CREDIT_LIMIT_EXCEEDED: "This order is more than the credit this customer has left. Raise their limit, record a payment, or choose another payment method.",
  },
  ar: {
    INVALID_STATUS_TRANSITION: "لا يمكن نقل هذا الأوردر إلى هذه الحالة من حالته الحالية.",
    STATUS_UNCHANGED: "الأوردر في هذه الحالة بالفعل.",
    ORDER_NOT_CANCELLED: "هذا الأوردر غير ملغي.",
    ORDER_CANCELLED: "هذا الأوردر ملغي.",
    ORDER_NOT_COD: "التأكيد بالهاتف لأوردرات الدفع عند الاستلام فقط.",
    ORDER_ALREADY_CONFIRMED: "هذا الأوردر مؤكد بالفعل.",
    ORDER_NOT_CONFIRMED: "أكّد الأوردر أولًا قبل شحنه.",
    ORDER_NOT_PAID: "يجب دفع هذا الأوردر قبل شحنه.",
    ORDER_ALREADY_SHIPPED: "الأوردر ده اتشحن ومينفعش يتغيّر.",
    INSUFFICIENT_STOCK: "مفيش مخزون كافٍ لهذا الأوردر.",
    ORDER_TENDER_RETURNED: "النقاط / الرصيد / كارت الهدية رجعوا للعميل لما الطلب اتلغى — اعمل طلب جديد",
    CREDIT_LIMIT_EXCEEDED: "الأوردر أكبر من الرصيد المتاح للعميل ده. زوّد حد الائتمان، أو سجّل دفعة، أو اختار طريقة دفع تانية.",
  },
} satisfies Messages;

type Code = keyof (typeof STRINGS)["en"];

export function useOrderErrorMessage() {
  const t = useT(STRINGS);
  const fallback = useErrorMessage();
  return useCallback(
    (err: unknown): string => {
      // An ApiError, or one order's { code, message } out of a bulk answer.
      const plain =
        !(err instanceof ApiError) && err && typeof err === "object" && "code" in err
          ? (err as { code?: string; message?: string })
          : null;
      const code = err instanceof ApiError ? (err.code as string | undefined) : plain?.code;
      if (code && code in t) return t[code as Code];
      if (plain) return plain.message || code || fallback(err);
      return fallback(err);
    },
    [t, fallback]
  );
}
