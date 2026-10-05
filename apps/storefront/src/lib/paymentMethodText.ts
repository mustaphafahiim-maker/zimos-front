"use client";

import { useStore } from "./StoreContext";

/**
 * Names for the ways to pay that the store dictionary does not have yet:
 * valU installments and kiosk cash (Aman / Masary), through the store's
 * gateway (backend payments/methodNames.js).
 */
const TEXT = {
  ar: {
    valu: "تقسيط valU",
    valuHint: "قسّط المبلغ مع valU — هتكمل على صفحة الدفع الآمنة.",
    kiosk: "الدفع في أقرب كشك",
    kioskHint: "هتاخد رقم مرجعي وتدفع كاش في أمان أو مصاري خلال يومين.",
  },
  en: {
    valu: "valU installments",
    valuHint: "Split the amount with valU — you finish on the secure payment page.",
    kiosk: "Pay at a kiosk",
    kioskHint: "You get a reference number and pay cash at Aman or Masary within two days.",
  },
};

export function usePaymentMethodText() {
  const { locale } = useStore();
  return TEXT[locale as keyof typeof TEXT] ?? TEXT.ar;
}
