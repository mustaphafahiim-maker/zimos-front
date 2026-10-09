import {
  checkoutHardeningCode,
  checkoutHardeningDepositRequired,
  checkoutHardeningFunnelRefusal,
  checkoutHardeningRefusedQuantity,
  checkoutHardeningTermsRefused,
} from "@store-builder/api-client";
import { parseLocale, type Locale } from "./i18n";

/**
 * The checkout's newer refusals in the shopper's words (frontend-handoff 348,
 * 353, 355, 362, 374) — the API words them in English only. For the banner of
 * every order form (lib/placeOrder `orderErrorMessage`): the checkout page,
 * the product page's own form and a funnel's checkout all say the same.
 */
export const CHECKOUT_REFUSAL_TEXT = {
  en: {
    codesSpent: "Too many codes requested — try again a bit later",
    tooMany: "Too many tries, please try again in a minute",
    moreUnits: (n: number) => (n > 0 ? `Add ${n} more item(s) to use this code` : "Add more items to use this code"),
    freeShippingCode: "This code gives you free shipping",
    free: "Free",
    funnelGone: "This offer is not available right now",
    funnelItem: "This product is not part of this offer. Go back to the offer page and order from there",
    funnelBack: "Back to the offer page",
    terms: "Please accept the terms to place your order",
    deposit: "This order needs a deposit by transfer before cash on delivery",
    orderAgain: "Press \"Place order\" again and we'll send you a new code",
    otpTooMany: "Too many tries — try again in a minute",
  },
  ar: {
    codesSpent: "طلبت أكواد كتير — جرّب بعد شوية",
    tooMany: "محاولات كتير، جرّب تاني بعد دقيقة",
    moreUnits: (n: number) => (n > 0 ? `زوّد ${new Intl.NumberFormat("ar-EG").format(n)} قطعة كمان عشان تستخدم الكود ده` : "زوّد قطع كمان عشان تستخدم الكود ده"),
    freeShippingCode: "الشحن مجاني بالكود ده",
    free: "مجاني",
    funnelGone: "العرض ده مش متاح دلوقتي",
    funnelItem: "المنتج ده مش من العرض ده. ارجع لصفحة العرض واطلب من هناك",
    funnelBack: "ارجع لصفحة العرض",
    terms: "لازم توافق على الشروط علشان تكمل الطلب",
    deposit: "الطلب ده محتاج عربون بالتحويل قبل الدفع عند الاستلام",
    orderAgain: "اضغط \"اطلب\" تاني عشان نبعتلك كود جديد",
    otpTooMany: "محاولات كتير — جرّب بعد دقيقة",
  },
};

export type CheckoutRefusalText = (typeof CHECKOUT_REFUSAL_TEXT)["en"];

/** The page's language: the one asked for, else <html lang> (set from the store's), else Arabic. French reads English. */
export function checkoutRefusalText(locale?: Locale): CheckoutRefusalText {
  const lang: Locale = locale ?? (typeof document !== "undefined" ? parseLocale(document.documentElement.lang) : null) ?? "ar";
  return lang === "ar" ? CHECKOUT_REFUSAL_TEXT.ar : CHECKOUT_REFUSAL_TEXT.en;
}

/** One of these refusals as a sentence; null for any other error. */
export function checkoutRefusal(err: unknown, locale?: Locale): string | null {
  const text = checkoutRefusalText(locale);
  const code = checkoutHardeningCode(err);
  // The code step's budget is spent: no code was sent and no code step opens (348).
  if (code === "OTP_RATE_LIMITED") return text.codesSpent;
  // Over 20 refused checkouts a minute from this address (362).
  if (code === "RATE_LIMITED") return text.tooMany;
  const quantity = checkoutHardeningRefusedQuantity(err);
  if (quantity) return text.moreUnits(quantity.remainingUnits);
  const funnel = checkoutHardeningFunnelRefusal(err);
  if (funnel) return funnel === "gone" ? text.funnelGone : text.funnelItem;
  if (checkoutHardeningDepositRequired(err)) return text.deposit;
  if (checkoutHardeningTermsRefused(err)) return text.terms;
  return null;
}
