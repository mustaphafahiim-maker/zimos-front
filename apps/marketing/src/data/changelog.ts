import type { Locale } from "@/i18n/config";

/**
 * Product changelog — newest first. Dates and versions are placeholders until
 * the owner fills in real release dates; do not invent them.
 */
export interface ChangelogEntry {
  id: string;
  date: string;
  tag: Record<Locale, string>;
  title: Record<Locale, string>;
  body: Record<Locale, string>;
  points: Record<Locale, string[]>;
}

const DATE = "[Release date]";

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "landing-page-generator",
    date: DATE,
    tag: { en: "Builder", ar: "المنشئ" },
    title: { en: "Landing page generator", ar: "مولّد صفحات الهبوط" },
    body: {
      en: "Create a product landing page faster by starting from smart templates that are filled with your product details.",
      ar: "أنشئ صفحة هبوط لمنتجك بسرعة أكبر بالبدء من قوالب ذكية تُملأ ببيانات منتجك.",
    },
    points: {
      en: [
        "Pick a template layout suited to cash-on-delivery offers.",
        "Your product name, images and price are placed into the template.",
        "Every section stays editable before you publish.",
      ],
      ar: [
        "اختر تصميم قالب مناسبًا لعروض الدفع عند الاستلام.",
        "يُوضع اسم المنتج وصوره وسعره داخل القالب.",
        "كل قسم يبقى قابلًا للتعديل قبل النشر.",
      ],
    },
  },
  {
    id: "onboarding-wizard",
    date: DATE,
    tag: { en: "Onboarding", ar: "البدء" },
    title: { en: "Onboarding wizard", ar: "معالج الإعداد" },
    body: {
      en: "A guided setup that walks new merchants through the first steps of launching a store.",
      ar: "إعداد موجَّه يرافق التاجر الجديد في الخطوات الأولى لإطلاق متجره.",
    },
    points: {
      en: ["Set up store details and language.", "Add a first product.", "Choose a template and publish."],
      ar: ["إعداد بيانات المتجر ولغته.", "إضافة أول منتج.", "اختيار قالب ونشر المتجر."],
    },
  },
  {
    id: "funnels",
    date: DATE,
    tag: { en: "Sales", ar: "المبيعات" },
    title: { en: "Funnels, order bumps & upsells", ar: "مسارات البيع والعروض الإضافية" },
    body: {
      en: "Turn a product page into a full sales flow with a checkout built for cash on delivery.",
      ar: "حوّل صفحة المنتج إلى مسار بيع كامل مع صفحة دفع مصممة للدفع عند الاستلام.",
    },
    points: {
      en: [
        "Order bumps at checkout.",
        "One-click upsells after purchase.",
        "A downsell path when the first offer is declined.",
      ],
      ar: ["عروض إضافية في صفحة الدفع.", "بيع إضافي بنقرة بعد الشراء.", "عرض بديل عند رفض العرض الأول."],
    },
  },
  {
    id: "call-center",
    date: DATE,
    tag: { en: "Operations", ar: "العمليات" },
    title: { en: "Call center & WhatsApp confirmation", ar: "الكول سنتر والتأكيد عبر واتساب" },
    body: {
      en: "Confirm cash-on-delivery orders before they ship, by phone or by WhatsApp.",
      ar: "أكّد طلبات الدفع عند الاستلام قبل شحنها، بالهاتف أو عبر واتساب.",
    },
    points: {
      en: [
        "A shared queue for confirmation agents, with call outcomes recorded on each order.",
        "Automated WhatsApp messages where customers reply to confirm or cancel.",
      ],
      ar: [
        "قائمة مشتركة لموظفي التأكيد مع تسجيل نتيجة كل مكالمة على الطلب.",
        "رسائل واتساب تلقائية يرد عليها العميل للتأكيد أو الإلغاء.",
      ],
    },
  },
  {
    id: "arabic-dashboard",
    date: DATE,
    tag: { en: "Dashboard", ar: "لوحة التحكم" },
    title: { en: "Arabic dashboard", ar: "لوحة تحكم بالعربية" },
    body: {
      en: "The merchant dashboard is available in Arabic with a full right-to-left layout, alongside English.",
      ar: "أصبحت لوحة تحكم التاجر متاحة بالعربية بتخطيط كامل من اليمين لليسار، إلى جانب الإنجليزية.",
    },
    points: {
      en: ["Switch language at any time.", "Right-to-left layout across the dashboard."],
      ar: ["تغيير اللغة في أي وقت.", "تخطيط من اليمين لليسار في لوحة التحكم كاملة."],
    },
  },
  {
    id: "rebrand",
    date: DATE,
    tag: { en: "Brand", ar: "الهوية" },
    title: { en: "Introducing ZIMOS", ar: "إطلاق هوية ZIMOS" },
    body: {
      en: "A new name and visual identity across the website, dashboard and storefronts: ZIMOS — Commerce Without Limits.",
      ar: "اسم وهوية بصرية جديدة في الموقع ولوحة التحكم والمتاجر: ZIMOS — تجارة بلا حدود.",
    },
    points: {
      en: ["New logo, colors and typography.", "Consistent design across every app."],
      ar: ["شعار وألوان وخطوط جديدة.", "تصميم موحّد في جميع التطبيقات."],
    },
  },
];
