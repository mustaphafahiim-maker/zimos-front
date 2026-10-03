import type { Locale } from "@/lib/i18n";

/**
 * Strings of the product page pieces lane 3 added (countdown, option
 * pickers, product content, buy-now). Kept beside the components instead of
 * in lib/i18n.ts, which every lane edits.
 */
const TEXT = {
  en: {
    offerEnds: "Offer ends in",
    days: "days",
    hours: "hrs",
    minutes: "min",
    seconds: "sec",
    choose: (name: string) => `Choose ${name}`,
    soldOut: "sold out",
    buyNow: "Buy now",
    buying: "One moment…",
    features: "Why you'll love it",
    testimonials: "What customers say",
    ratingOf: (n: number) => `${n} out of 5`,
  },
  ar: {
    offerEnds: "العرض ينتهي خلال",
    days: "يوم",
    hours: "ساعة",
    minutes: "دقيقة",
    seconds: "ثانية",
    choose: (name: string) => `اختر ${name}`,
    soldOut: "نفد",
    buyNow: "اشترِ الآن",
    buying: "لحظة واحدة…",
    features: "ليه هتحبه",
    testimonials: "آراء العملاء",
    ratingOf: (n: number) => `${n} من 5`,
  },
};

export type ProductPageText = (typeof TEXT)["en"];

export function productPageText(locale: Locale): ProductPageText {
  return TEXT[locale] ?? TEXT.ar;
}
