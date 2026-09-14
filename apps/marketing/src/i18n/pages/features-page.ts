import type { Locale } from "../config";

export type FeatureAreaId =
  | "store-builder"
  | "funnels"
  | "confirmation"
  | "fraud"
  | "shipping"
  | "analytics"
  | "automations"
  | "teams"
  | "landing-generator";

export interface FeatureArea {
  id: FeatureAreaId;
  kicker: string;
  title: string;
  body: string;
  points: string[];
  /** Accessible description of the illustration, and its generic UI labels. */
  visual: { aria: string; labels: string[] };
}

export interface FeaturesPageCopy {
  metaTitle: string;
  metaDescription: string;
  kicker: string;
  heading: string;
  intro: string;
  jumpTo: string;
  areas: FeatureArea[];
}

export const featuresPage: Record<Locale, FeaturesPageCopy> = {
  en: {
    metaTitle: "Features",
    metaDescription:
      "Store builder, funnels, call-center and WhatsApp confirmation, fraud protection, shipping and COD settlements, profit analytics, automations and team roles — in ZIMOS.",
    kicker: "Features",
    heading: "Everything you need to sell with cash on delivery",
    intro:
      "Each part of ZIMOS handles one step of the order journey — and they are connected, so an order moves from checkout to settlement without re-entry.",
    jumpTo: "Jump to a capability",
    areas: [
      {
        id: "store-builder",
        kicker: "Build",
        title: "Store builder",
        body: "Start from a ready template, add your products and brand, and publish a fast storefront in Arabic or English.",
        points: [
          "Templates designed for single-product and catalog stores.",
          "Arabic (right-to-left) and English storefronts.",
          "Start on a ZIMOS subdomain and connect your own domain when ready.",
        ],
        visual: {
          aria: "Illustration of a storefront editor with a template preview and a sections panel.",
          labels: ["Sections", "Header", "Products", "Footer", "Publish"],
        },
      },
      {
        id: "funnels",
        kicker: "Sell",
        title: "Funnels & offers",
        body: "Turn a product page into a complete sales flow with offers before and after checkout.",
        points: [
          "Landing pages and a checkout built for cash on delivery.",
          "Order bumps at checkout and one-click upsells after purchase.",
          "A downsell path when the first offer is declined.",
        ],
        visual: {
          aria: "Illustration of funnel steps from landing page to checkout, upsell and thank-you page.",
          labels: ["Landing page", "Checkout", "Upsell", "Thank-you page", "Order bump"],
        },
      },
      {
        id: "confirmation",
        kicker: "Confirm",
        title: "Call center & WhatsApp confirmation",
        body: "Put every new order through a confirmation step before it reaches a carrier.",
        points: [
          "A shared queue for confirmation agents, with the outcome of each call on the order.",
          "Automated WhatsApp messages — customers reply to confirm or cancel.",
          "Only confirmed orders move on to shipping.",
        ],
        visual: {
          aria: "Illustration of a confirmation queue next to a WhatsApp message asking the customer to confirm.",
          labels: ["Confirmation queue", "Calling", "Confirmed", "Reply 1 to confirm, 2 to cancel", "Order"],
        },
      },
      {
        id: "fraud",
        kicker: "Protect",
        title: "Fraud & fake-order protection",
        body: "Spot orders that are likely to be refused before you pay to ship them.",
        points: [
          "Flags for duplicate orders.",
          "Flags for suspicious details and customers who refused before.",
          "Review flagged orders before they move to shipping.",
        ],
        visual: {
          aria: "Illustration of an order list where some orders carry warning flags for review.",
          labels: ["Needs review", "Duplicate order", "Refused before", "Looks fine"],
        },
      },
      {
        id: "shipping",
        kicker: "Ship",
        title: "Shipping carriers & COD settlements",
        body: "Send confirmed orders to your carrier, follow each shipment, and reconcile the cash that was collected.",
        points: [
          "Connect local carriers available to your account.",
          "A tracking code for every confirmed order.",
          "Match collected cash against delivered orders.",
        ],
        visual: {
          aria: "Illustration of a shipment timeline and a settlement summary with collected and pending states.",
          labels: ["Shipment", "Picked up", "In transit", "Delivered", "Settlement", "Collected", "Pending"],
        },
      },
      {
        id: "analytics",
        kicker: "Grow",
        title: "Profit & ad analytics",
        body: "Judge campaigns on delivered and collected orders, not on placed ones.",
        points: [
          "Cost per delivered order, per campaign and per product.",
          "Real ROAS based on collected cash.",
          "A break-even view for each campaign.",
        ],
        visual: {
          aria: "Illustration of an analytics card with campaign rows and empty metric placeholders.",
          labels: ["Campaigns", "Cost per delivered order", "Real ROAS", "Break-even", "Illustrative"],
        },
      },
      {
        id: "automations",
        kicker: "Automate",
        title: "Automations",
        body: "Let routine follow-up happen on its own as orders change status.",
        points: [
          "Send a message when an order reaches a status.",
          "Change statuses and assign orders to teammates automatically.",
          "Fewer manual steps between checkout and delivery.",
        ],
        visual: {
          aria: "Illustration of an automation rule: when an order is confirmed, send a message and assign it.",
          labels: ["When", "Order is confirmed", "Then", "Send WhatsApp message", "Assign to shipping team"],
        },
      },
      {
        id: "teams",
        kicker: "Scale",
        title: "Multi-store & team roles",
        body: "Run several stores from one account and give each teammate only the access their work needs.",
        points: [
          "Switch between stores from one login.",
          "Roles such as confirmation agents who only see the order queue.",
          "Invite and remove teammates at any time.",
        ],
        visual: {
          aria: "Illustration of a store switcher and a team list with roles.",
          labels: ["Stores", "Team", "Owner", "Confirmation agent", "Media buyer"],
        },
      },
      {
        id: "landing-generator",
        kicker: "Launch",
        title: "Landing page generator",
        body: "Create a product landing page faster with smart templates: pick a layout and ZIMOS places your product details into it. You review and edit every section before publishing.",
        points: [
          "Layouts suited to cash-on-delivery offers.",
          "Your product name, images and price are filled in for you.",
          "Everything stays editable — nothing publishes without your review.",
        ],
        visual: {
          aria: "Illustration of a template picker and a generated landing page draft with editable sections.",
          labels: ["Choose a template", "Draft", "Headline", "Product images", "Order form", "Edit"],
        },
      },
    ],
  },
  ar: {
    metaTitle: "المزايا",
    metaDescription:
      "منشئ المتاجر، ومسارات البيع، وتأكيد الطلبات عبر الكول سنتر وواتساب، والحماية من الاحتيال، والشحن وتسويات التحصيل، وتحليلات الأرباح، والأتمتة وأدوار الفريق — في ZIMOS.",
    kicker: "المزايا",
    heading: "كل ما تحتاجه للبيع بالدفع عند الاستلام",
    intro:
      "كل جزء في ZIMOS يتولى خطوة من رحلة الطلب، وجميعها مترابطة؛ لينتقل الطلب من الدفع إلى التسوية دون إعادة إدخال.",
    jumpTo: "انتقل إلى إمكانية",
    areas: [
      {
        id: "store-builder",
        kicker: "ابنِ",
        title: "منشئ المتاجر",
        body: "ابدأ من قالب جاهز، وأضف منتجاتك وهويتك، وانشر متجرًا سريعًا بالعربية أو الإنجليزية.",
        points: [
          "قوالب مصممة لمتاجر المنتج الواحد ومتاجر الكتالوج.",
          "متاجر بالعربية (من اليمين لليسار) والإنجليزية.",
          "ابدأ على نطاق فرعي من ZIMOS واربط نطاقك الخاص عندما تكون مستعدًا.",
        ],
        visual: {
          aria: "رسم توضيحي لمحرر متجر مع معاينة قالب ولوحة أقسام.",
          labels: ["الأقسام", "الترويسة", "المنتجات", "التذييل", "نشر"],
        },
      },
      {
        id: "funnels",
        kicker: "بِع",
        title: "مسارات البيع والعروض",
        body: "حوّل صفحة المنتج إلى مسار بيع كامل مع عروض قبل الدفع وبعده.",
        points: [
          "صفحات هبوط وصفحة دفع مصممة للدفع عند الاستلام.",
          "عروض إضافية في صفحة الدفع وبيع إضافي بنقرة بعد الشراء.",
          "عرض بديل عند رفض العرض الأول.",
        ],
        visual: {
          aria: "رسم توضيحي لخطوات مسار البيع من صفحة الهبوط إلى الدفع ثم البيع الإضافي وصفحة الشكر.",
          labels: ["صفحة الهبوط", "الدفع", "بيع إضافي", "صفحة الشكر", "عرض إضافي"],
        },
      },
      {
        id: "confirmation",
        kicker: "أكّد",
        title: "الكول سنتر والتأكيد عبر واتساب",
        body: "مرّر كل طلب جديد بخطوة تأكيد قبل أن يصل إلى شركة الشحن.",
        points: [
          "قائمة مشتركة لموظفي التأكيد مع تسجيل نتيجة كل مكالمة على الطلب.",
          "رسائل واتساب تلقائية يرد عليها العميل للتأكيد أو الإلغاء.",
          "الطلبات المؤكدة فقط تنتقل إلى الشحن.",
        ],
        visual: {
          aria: "رسم توضيحي لقائمة تأكيد بجانب رسالة واتساب تطلب من العميل التأكيد.",
          labels: ["قائمة التأكيد", "جارٍ الاتصال", "تم التأكيد", "أرسل 1 للتأكيد أو 2 للإلغاء", "طلب"],
        },
      },
      {
        id: "fraud",
        kicker: "احمِ",
        title: "الحماية من الاحتيال والطلبات الوهمية",
        body: "اكتشف الطلبات المرجّح رفضها قبل أن تدفع تكلفة شحنها.",
        points: [
          "تنبيهات للطلبات المكررة.",
          "تنبيهات للبيانات المشبوهة والعملاء الذين رفضوا طلبات سابقة.",
          "راجع الطلبات المُنبَّه عليها قبل انتقالها إلى الشحن.",
        ],
        visual: {
          aria: "رسم توضيحي لقائمة طلبات يحمل بعضها علامات تنبيه للمراجعة.",
          labels: ["تحتاج مراجعة", "طلب مكرر", "رفض سابقًا", "سليم"],
        },
      },
      {
        id: "shipping",
        kicker: "اشحن",
        title: "شركات الشحن وتسويات التحصيل",
        body: "أرسل الطلبات المؤكدة إلى شركة الشحن، وتابع كل شحنة، وطابق المبالغ المُحصَّلة.",
        points: [
          "اربط شركات الشحن المحلية المتاحة لحسابك.",
          "كود تتبع لكل طلب مؤكد.",
          "مطابقة المبالغ المُحصَّلة مع الطلبات المُسلَّمة.",
        ],
        visual: {
          aria: "رسم توضيحي لمراحل شحنة وملخص تسوية بحالتي تم التحصيل وقيد الانتظار.",
          labels: ["الشحنة", "تم الاستلام", "في الطريق", "تم التسليم", "التسوية", "تم التحصيل", "قيد الانتظار"],
        },
      },
      {
        id: "analytics",
        kicker: "انمُ",
        title: "تحليلات الأرباح والإعلانات",
        body: "قيّم حملاتك على أساس الطلبات المُسلَّمة والمُحصَّلة، لا الطلبات المُسجَّلة فقط.",
        points: [
          "تكلفة الطلب المُسلَّم لكل حملة ولكل منتج.",
          "عائد حقيقي على الإنفاق الإعلاني مبني على المبالغ المُحصَّلة.",
          "نقطة التعادل لكل حملة.",
        ],
        visual: {
          aria: "رسم توضيحي لبطاقة تحليلات بصفوف حملات وخانات مؤشرات فارغة.",
          labels: ["الحملات", "تكلفة الطلب المُسلَّم", "العائد الحقيقي", "نقطة التعادل", "توضيحي"],
        },
      },
      {
        id: "automations",
        kicker: "أتمِت",
        title: "الأتمتة",
        body: "دع المتابعة الروتينية تتم تلقائيًا مع تغيّر حالة الطلبات.",
        points: [
          "أرسل رسالة عند وصول الطلب إلى حالة معينة.",
          "غيّر الحالات ووزّع الطلبات على أعضاء الفريق تلقائيًا.",
          "خطوات يدوية أقل بين الدفع والتسليم.",
        ],
        visual: {
          aria: "رسم توضيحي لقاعدة أتمتة: عند تأكيد الطلب، أرسل رسالة وأسنده.",
          labels: ["عندما", "يتم تأكيد الطلب", "إذن", "أرسل رسالة واتساب", "أسند إلى فريق الشحن"],
        },
      },
      {
        id: "teams",
        kicker: "توسّع",
        title: "تعدد المتاجر وأدوار الفريق",
        body: "أدر عدة متاجر من حساب واحد، وامنح كل عضو في الفريق الصلاحيات التي يحتاجها عمله فقط.",
        points: [
          "التنقل بين المتاجر بتسجيل دخول واحد.",
          "أدوار مثل موظف التأكيد الذي يرى قائمة الطلبات فقط.",
          "دعوة أعضاء الفريق أو إزالتهم في أي وقت.",
        ],
        visual: {
          aria: "رسم توضيحي لمبدّل المتاجر وقائمة فريق بالأدوار.",
          labels: ["المتاجر", "الفريق", "المالك", "موظف تأكيد", "مسؤول إعلانات"],
        },
      },
      {
        id: "landing-generator",
        kicker: "أطلق",
        title: "مولّد صفحات الهبوط",
        body: "أنشئ صفحة هبوط لمنتجك أسرع باستخدام قوالب ذكية: اختر التصميم وتضع ZIMOS بيانات منتجك فيه، ثم تراجع كل قسم وتعدّله قبل النشر.",
        points: [
          "تصميمات مناسبة لعروض الدفع عند الاستلام.",
          "يُملأ اسم المنتج وصوره وسعره تلقائيًا.",
          "كل شيء قابل للتعديل، ولا يُنشر شيء دون مراجعتك.",
        ],
        visual: {
          aria: "رسم توضيحي لاختيار قالب ومسودة صفحة هبوط بأقسام قابلة للتعديل.",
          labels: ["اختر قالبًا", "مسودة", "العنوان", "صور المنتج", "نموذج الطلب", "تعديل"],
        },
      },
    ],
  },
};
