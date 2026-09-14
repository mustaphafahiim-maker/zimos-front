import type { Locale } from "../config";

export interface AboutPageCopy {
  metaTitle: string;
  metaDescription: string;
  kicker: string;
  heading: string;
  intro: string;
  mission: { kicker: string; heading: string; body: string[] };
  approach: { kicker: string; heading: string; items: { title: string; body: string }[] };
  scope: { kicker: string; heading: string; body: string; linkLabel: string };
}

export const aboutPage: Record<Locale, AboutPageCopy> = {
  en: {
    metaTitle: "About",
    metaDescription:
      "ZIMOS builds commerce infrastructure for merchants in Egypt and the Arab world — built around cash on delivery, Arabic first, and real profit.",
    kicker: "About ZIMOS",
    heading: "Commerce infrastructure for the way the region sells",
    intro:
      "ZIMOS gives merchants in Egypt and the Arab world one platform to build their store, confirm and ship cash-on-delivery orders, and understand what they really earn.",
    mission: {
      kicker: "Mission",
      heading: "Remove the limits between a good product and a growing business",
      body: [
        "Selling online in the region rarely ends at checkout. Orders need confirming, carriers need booking, cash needs reconciling, and ad spend needs to be judged against what was actually delivered.",
        "Most tools were designed for card payments and other markets. Our mission is to make the whole cash-on-delivery journey work in one place, so merchants spend their time on products and customers instead of spreadsheets.",
      ],
    },
    approach: {
      kicker: "Our approach",
      heading: "How we build ZIMOS",
      items: [
        {
          title: "Built around cash on delivery",
          body: "Confirmation, shipping and settlements are core parts of the product, not add-ons.",
        },
        {
          title: "Arabic first, fully bilingual",
          body: "The dashboard and storefronts work in Arabic (right-to-left) and English from the start.",
        },
        {
          title: "Real numbers, honestly shown",
          body: "Profit is calculated on delivered and collected orders, so decisions rest on what really happened.",
        },
        {
          title: "Your data stays yours",
          body: "Merchants can export their orders, customers and products at any time.",
        },
      ],
    },
    scope: {
      kicker: "What we build",
      heading: "One platform, from first order to steady growth",
      body: "Store and funnel building, call-center and WhatsApp confirmation, fraud protection, shipping and settlements, profit analytics, automations and team roles — connected so each order moves without re-entry.",
      linkLabel: "Explore the features",
    },
  },
  ar: {
    metaTitle: "من نحن",
    metaDescription:
      "تبني ZIMOS بنية تجارة للتجار في مصر والعالم العربي — مصممة حول الدفع عند الاستلام، وبالعربية أولًا، ومع ربح حقيقي واضح.",
    kicker: "عن ZIMOS",
    heading: "بنية تجارة مصممة لطريقة البيع في المنطقة",
    intro:
      "تمنح ZIMOS التجار في مصر والعالم العربي منصة واحدة لبناء متاجرهم، وتأكيد طلبات الدفع عند الاستلام وشحنها، ومعرفة أرباحهم الحقيقية.",
    mission: {
      kicker: "رسالتنا",
      heading: "إزالة الحدود بين منتج جيد ونشاط تجاري ينمو",
      body: [
        "البيع الإلكتروني في المنطقة لا ينتهي عند إتمام الطلب؛ فالطلبات تحتاج إلى تأكيد، والشحنات تحتاج إلى حجز، والتحصيل يحتاج إلى مطابقة، والإنفاق الإعلاني يحتاج إلى تقييم على أساس ما تم تسليمه فعلًا.",
        "صُممت معظم الأدوات للدفع بالبطاقات ولأسواق أخرى. ورسالتنا أن تعمل رحلة الدفع عند الاستلام كاملة في مكان واحد، ليقضي التاجر وقته مع منتجاته وعملائه بدلًا من جداول البيانات.",
      ],
    },
    approach: {
      kicker: "نهجنا",
      heading: "كيف نبني ZIMOS",
      items: [
        {
          title: "مبنية حول الدفع عند الاستلام",
          body: "التأكيد والشحن والتسويات أجزاء أساسية من المنتج، وليست إضافات.",
        },
        {
          title: "العربية أولًا، وبلغتين بالكامل",
          body: "تعمل لوحة التحكم والمتاجر بالعربية (من اليمين لليسار) والإنجليزية منذ البداية.",
        },
        {
          title: "أرقام حقيقية بوضوح",
          body: "يُحسب الربح على الطلبات المُسلَّمة والمُحصَّلة، لتُبنى القرارات على ما حدث فعلًا.",
        },
        {
          title: "بياناتك تبقى ملكك",
          body: "يمكن للتاجر تصدير طلباته وعملائه ومنتجاته في أي وقت.",
        },
      ],
    },
    scope: {
      kicker: "ما نبنيه",
      heading: "منصة واحدة، من أول طلب إلى نمو مستقر",
      body: "بناء المتاجر ومسارات البيع، وتأكيد الطلبات عبر الكول سنتر وواتساب، والحماية من الاحتيال، والشحن والتسويات، وتحليلات الأرباح، والأتمتة وأدوار الفريق — مترابطة لينتقل كل طلب دون إعادة إدخال.",
      linkLabel: "استكشف المزايا",
    },
  },
};
