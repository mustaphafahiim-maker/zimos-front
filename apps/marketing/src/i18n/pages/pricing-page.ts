import type { Locale } from "../config";

/** Whether a capability is part of a plan. `tbd` = not decided / not published yet. */
export type Availability = "yes" | "no" | "tbd";

export interface ComparisonGroup {
  id: string;
  title: Record<Locale, string>;
  /** `values` follow the plan order in the dictionary: starter, growth, scale. */
  rows: { label: Record<Locale, string>; values: [Availability, Availability, Availability] }[];
}

/**
 * Derived from the plan feature lists in the dictionary ("Everything in
 * Starter/Growth" carries forward). Anything not stated there is `tbd` —
 * never guessed.
 */
export const COMPARISON: ComparisonGroup[] = [
  {
    id: "store",
    title: { en: "Store builder", ar: "منشئ المتاجر" },
    rows: [
      { label: { en: "Store builder & templates", ar: "منشئ المتاجر والقوالب" }, values: ["yes", "yes", "yes"] },
      { label: { en: "Arabic and English storefronts", ar: "متاجر بالعربية والإنجليزية" }, values: ["yes", "yes", "yes"] },
      { label: { en: "Export orders, customers and products", ar: "تصدير الطلبات والعملاء والمنتجات" }, values: ["yes", "yes", "yes"] },
      { label: { en: "Connect your own domain", ar: "ربط نطاقك الخاص" }, values: ["tbd", "tbd", "tbd"] },
    ],
  },
  {
    id: "funnels",
    title: { en: "Funnels & offers", ar: "مسارات البيع والعروض" },
    rows: [
      { label: { en: "Checkout built for cash on delivery", ar: "صفحة دفع مصممة للدفع عند الاستلام" }, values: ["yes", "yes", "yes"] },
      { label: { en: "Funnels and landing pages", ar: "مسارات البيع وصفحات الهبوط" }, values: ["no", "yes", "yes"] },
      { label: { en: "Order bumps & one-click upsells", ar: "العروض الإضافية والبيع الإضافي بنقرة" }, values: ["no", "yes", "yes"] },
      { label: { en: "Landing page generator (smart templates)", ar: "مولّد صفحات الهبوط (قوالب ذكية)" }, values: ["tbd", "tbd", "tbd"] },
    ],
  },
  {
    id: "cod",
    title: { en: "COD operations", ar: "عمليات الدفع عند الاستلام" },
    rows: [
      { label: { en: "WhatsApp order confirmation", ar: "تأكيد الطلبات عبر واتساب" }, values: ["yes", "yes", "yes"] },
      { label: { en: "Call-center confirmation queue", ar: "قائمة تأكيد لفريق الكول سنتر" }, values: ["no", "yes", "yes"] },
      { label: { en: "Fraud & fake-order protection", ar: "الحماية من الاحتيال والطلبات الوهمية" }, values: ["no", "yes", "yes"] },
      { label: { en: "Automations", ar: "الأتمتة" }, values: ["no", "no", "yes"] },
    ],
  },
  {
    id: "shipping",
    title: { en: "Shipping & settlements", ar: "الشحن والتسويات" },
    rows: [
      { label: { en: "Shipping carrier connections", ar: "الربط مع شركات الشحن" }, values: ["tbd", "tbd", "tbd"] },
      { label: { en: "Tracking codes for confirmed orders", ar: "أكواد تتبع للطلبات المؤكدة" }, values: ["tbd", "tbd", "tbd"] },
      { label: { en: "COD settlement reconciliation", ar: "مطابقة تسويات التحصيل" }, values: ["tbd", "tbd", "tbd"] },
    ],
  },
  {
    id: "analytics",
    title: { en: "Analytics & ads", ar: "التحليلات والإعلانات" },
    rows: [
      { label: { en: "Media buying & profit analytics", ar: "تحليلات الإعلانات والأرباح" }, values: ["no", "yes", "yes"] },
      { label: { en: "Cost per delivered order & real ROAS", ar: "تكلفة الطلب المُسلَّم والعائد الحقيقي على الإعلان" }, values: ["no", "yes", "yes"] },
    ],
  },
  {
    id: "team",
    title: { en: "Team & security", ar: "الفريق والأمان" },
    rows: [
      { label: { en: "Multiple stores in one account", ar: "عدة متاجر في حساب واحد" }, values: ["no", "no", "yes"] },
      { label: { en: "Team roles & permissions", ar: "أدوار الفريق والصلاحيات" }, values: ["no", "no", "yes"] },
      { label: { en: "Help with onboarding and migration", ar: "مساعدة في الإعداد ونقل المتجر" }, values: ["no", "no", "yes"] },
    ],
  },
];

/** Indices into `dict.faq.items` shown on the pricing page. */
export const PRICING_FAQ_INDICES = [7, 3, 5, 6] as const;

export interface PricingPageCopy {
  metaTitle: string;
  metaDescription: string;
  plansHeading: string;
  compare: {
    kicker: string;
    heading: string;
    intro: string;
    caption: string;
    featureColumn: string;
    yes: string;
    no: string;
    tbd: string;
    note: string;
  };
  faqHeading: string;
  faqIntro: string;
}

export const pricingPage: Record<Locale, PricingPageCopy> = {
  en: {
    metaTitle: "Pricing",
    metaDescription:
      "ZIMOS plans for merchants launching their first store, brands running daily campaigns, and teams running several stores. Free during early access.",
    plansHeading: "Choose where to start",
    compare: {
      kicker: "Compare plans",
      heading: "What each plan includes",
      intro: "A side-by-side view of the capabilities in each plan, grouped by area.",
      caption: "Plan comparison by capability area",
      featureColumn: "Capability",
      yes: "Included",
      no: "Not included",
      tbd: "To be confirmed",
      note: "“To be confirmed” means plan availability has not been announced yet. Plan contents may change before public pricing is published.",
    },
    faqHeading: "Pricing questions",
    faqIntro: "More answers are in the help center, or contact our team.",
  },
  ar: {
    metaTitle: "الأسعار",
    metaDescription:
      "باقات ZIMOS للتجار الذين يطلقون متجرهم الأول، وللعلامات التي تدير حملات يومية، وللفرق التي تدير عدة متاجر. مجانًا خلال مرحلة الوصول المبكر.",
    plansHeading: "اختر نقطة البداية",
    compare: {
      kicker: "مقارنة الباقات",
      heading: "ما تتضمنه كل باقة",
      intro: "مقارنة جنبًا إلى جنب لإمكانات كل باقة، مقسّمة حسب المجال.",
      caption: "مقارنة الباقات حسب مجال الإمكانات",
      featureColumn: "الإمكانية",
      yes: "متضمَّنة",
      no: "غير متضمَّنة",
      tbd: "سيتم تأكيدها",
      note: "«سيتم تأكيدها» تعني أن توفرها في الباقات لم يُعلَن بعد. وقد يتغير محتوى الباقات قبل إعلان الأسعار الرسمية.",
    },
    faqHeading: "أسئلة عن الأسعار",
    faqIntro: "تجد إجابات أخرى في مركز المساعدة، أو تواصل مع فريقنا.",
  },
};
