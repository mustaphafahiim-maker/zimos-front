import type { Locale } from "../config";

export interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  steps: string[];
}

export interface HelpCategory {
  id: "getting-started" | "orders-cod" | "shipping" | "payments" | "funnels" | "account-billing";
  title: string;
  description: string;
  articles: HelpArticle[];
}

export interface HelpPageCopy {
  metaTitle: string;
  metaDescription: string;
  kicker: string;
  heading: string;
  intro: string;
  categoriesLabel: string;
  stepsLabel: string;
  contactHeading: string;
  contactBody: string;
  contactCta: string;
  categories: HelpCategory[];
}

export const helpPage: Record<Locale, HelpPageCopy> = {
  en: {
    metaTitle: "Help center",
    metaDescription: "Short how-to guides for getting started with ZIMOS, confirming COD orders, shipping, payments, funnels and your account.",
    kicker: "Help center",
    heading: "How can we help?",
    intro: "Short, step-by-step guides for the most common tasks in ZIMOS. Menu names in your dashboard may differ slightly as the product evolves.",
    categoriesLabel: "Help categories",
    stepsLabel: "Steps",
    contactHeading: "Still need help?",
    contactBody: "Send us a message and our team will get back to you.",
    contactCta: "Contact support",
    categories: [
      {
        id: "getting-started",
        title: "Getting started",
        description: "Create your account and publish your first store.",
        articles: [
          {
            id: "create-store",
            title: "Create your store",
            summary: "Go from a new account to a published store.",
            steps: [
              "Create a free account from the Start free button.",
              "Follow the onboarding wizard to add your store name and language.",
              "Pick a template and add your first product.",
              "Preview the store, then publish it on your ZIMOS subdomain.",
            ],
          },
          {
            id: "connect-domain",
            title: "Connect your own domain",
            summary: "Use a domain you already own.",
            steps: [
              "Open your store settings and find the domain section.",
              "Enter the domain you own.",
              "Add the DNS records shown to your domain provider.",
              "Wait for the connection to be verified.",
            ],
          },
        ],
      },
      {
        id: "orders-cod",
        title: "Orders & COD",
        description: "Confirm cash-on-delivery orders before they ship.",
        articles: [
          {
            id: "confirm-whatsapp",
            title: "Confirm orders on WhatsApp",
            summary: "Let customers confirm or cancel by replying to a message.",
            steps: [
              "Connect WhatsApp from your integrations settings.",
              "Turn on automated confirmation messages.",
              "New orders receive a message asking the customer to reply to confirm or cancel.",
              "Confirmed orders move on to shipping; cancelled ones are closed.",
            ],
          },
          {
            id: "call-queue",
            title: "Use the call-center queue",
            summary: "Give your confirmation team one shared list to work through.",
            steps: [
              "Invite teammates and give them the confirmation role.",
              "Agents open the confirmation queue and call each new order.",
              "Record the outcome of each call on the order.",
            ],
          },
          {
            id: "flagged-orders",
            title: "Review flagged orders",
            summary: "Check orders marked as duplicate or suspicious.",
            steps: [
              "Open orders that carry a fraud or duplicate flag.",
              "Check the order details and the customer's order history.",
              "Confirm or cancel the order before it moves to shipping.",
            ],
          },
        ],
      },
      {
        id: "shipping",
        title: "Shipping",
        description: "Send confirmed orders to your carrier and follow them.",
        articles: [
          {
            id: "connect-carrier",
            title: "Connect a shipping carrier",
            summary: "Link a carrier available to your account.",
            steps: [
              "Open the shipping section of your settings.",
              "Choose a carrier from the available list for your country.",
              "Enter the account details provided by the carrier.",
            ],
          },
          {
            id: "track-settle",
            title: "Track shipments and settlements",
            summary: "Follow delivery and reconcile collected cash.",
            steps: [
              "Each confirmed order receives a tracking code.",
              "Follow shipment status from the order page.",
              "Compare collected cash against delivered orders in settlements.",
            ],
          },
        ],
      },
      {
        id: "payments",
        title: "Payments",
        description: "Accept cash on delivery and online payments.",
        articles: [
          {
            id: "online-payments",
            title: "Add online payments",
            summary: "Offer online payment alongside cash on delivery.",
            steps: [
              "Open the payments section of your settings.",
              "Choose a supported provider, such as Paymob or InstaPay, where available to your business.",
              "Enter the credentials from your provider account.",
              "Choose which payment methods appear at checkout.",
            ],
          },
        ],
      },
      {
        id: "funnels",
        title: "Funnels",
        description: "Build sales flows with offers and upsells.",
        articles: [
          {
            id: "build-funnel",
            title: "Build a funnel",
            summary: "Create a landing page, checkout and post-purchase offers.",
            steps: [
              "Create a new funnel and choose the product.",
              "Start from a smart template for the landing page and edit each section.",
              "Add an order bump to the checkout.",
              "Add an upsell, and optionally a downsell for customers who decline.",
              "Publish the funnel and use its link in your ads.",
            ],
          },
          {
            id: "read-profit",
            title: "Read profit per campaign",
            summary: "See which campaigns pay back on delivered orders.",
            steps: [
              "Connect your ad accounts from integrations.",
              "Open analytics to see cost per delivered order and real ROAS.",
              "Use the break-even view to decide which campaigns to scale or stop.",
            ],
          },
        ],
      },
      {
        id: "account-billing",
        title: "Account & billing",
        description: "Manage your team, stores, plan and data.",
        articles: [
          {
            id: "team-roles",
            title: "Invite teammates and set roles",
            summary: "Give each person only the access they need.",
            steps: [
              "Open team settings and invite a teammate by email.",
              "Choose a role for them.",
              "Change or remove access at any time.",
            ],
          },
          {
            id: "export-data",
            title: "Export your data",
            summary: "Download your orders, customers and products.",
            steps: [
              "Open the orders, customers or products list.",
              "Use the export action.",
              "Download the generated file.",
            ],
          },
          {
            id: "plan-billing",
            title: "Plans and billing",
            summary: "What to expect during early access.",
            steps: [
              "ZIMOS is free to start during early access, with no card required.",
              "Public pricing will be announced before any fees take effect.",
              "For plan questions, contact our team from the contact page.",
            ],
          },
        ],
      },
    ],
  },
  ar: {
    metaTitle: "مركز المساعدة",
    metaDescription: "أدلة قصيرة للبدء مع ZIMOS، وتأكيد طلبات الدفع عند الاستلام، والشحن، والمدفوعات، ومسارات البيع، وإدارة حسابك.",
    kicker: "مركز المساعدة",
    heading: "كيف يمكننا مساعدتك؟",
    intro: "أدلة قصيرة خطوة بخطوة لأكثر المهام شيوعًا في ZIMOS. قد تختلف أسماء القوائم في لوحة التحكم قليلًا مع تطور المنتج.",
    categoriesLabel: "أقسام المساعدة",
    stepsLabel: "الخطوات",
    contactHeading: "ما زلت تحتاج إلى مساعدة؟",
    contactBody: "أرسل لنا رسالة وسيتواصل معك فريقنا.",
    contactCta: "تواصل مع الدعم",
    categories: [
      {
        id: "getting-started",
        title: "البدء",
        description: "أنشئ حسابك وانشر متجرك الأول.",
        articles: [
          {
            id: "create-store",
            title: "أنشئ متجرك",
            summary: "من حساب جديد إلى متجر منشور.",
            steps: [
              "أنشئ حسابًا مجانيًا من زر «ابدأ مجانًا».",
              "اتبع معالج الإعداد لإضافة اسم المتجر ولغته.",
              "اختر قالبًا وأضف أول منتج.",
              "عاين المتجر ثم انشره على نطاقك الفرعي من ZIMOS.",
            ],
          },
          {
            id: "connect-domain",
            title: "اربط نطاقك الخاص",
            summary: "استخدم نطاقًا تملكه بالفعل.",
            steps: [
              "افتح إعدادات المتجر وانتقل إلى قسم النطاق.",
              "أدخل النطاق الذي تملكه.",
              "أضف سجلات DNS الظاهرة لدى مزوّد النطاق.",
              "انتظر حتى يتم التحقق من الربط.",
            ],
          },
        ],
      },
      {
        id: "orders-cod",
        title: "الطلبات والدفع عند الاستلام",
        description: "أكّد طلبات الدفع عند الاستلام قبل شحنها.",
        articles: [
          {
            id: "confirm-whatsapp",
            title: "تأكيد الطلبات عبر واتساب",
            summary: "دع العميل يؤكد أو يلغي بالرد على رسالة.",
            steps: [
              "اربط واتساب من إعدادات التكاملات.",
              "فعّل رسائل التأكيد التلقائية.",
              "تصل إلى الطلبات الجديدة رسالة تطلب من العميل الرد للتأكيد أو الإلغاء.",
              "تنتقل الطلبات المؤكدة إلى الشحن، وتُغلق الطلبات الملغاة.",
            ],
          },
          {
            id: "call-queue",
            title: "استخدام قائمة الكول سنتر",
            summary: "امنح فريق التأكيد قائمة مشتركة واحدة للعمل عليها.",
            steps: [
              "ادعُ أعضاء الفريق وامنحهم دور التأكيد.",
              "يفتح الموظفون قائمة التأكيد ويتصلون بكل طلب جديد.",
              "تُسجَّل نتيجة كل مكالمة على الطلب.",
            ],
          },
          {
            id: "flagged-orders",
            title: "مراجعة الطلبات المُنبَّه عليها",
            summary: "افحص الطلبات المصنفة كمكررة أو مشبوهة.",
            steps: [
              "افتح الطلبات التي تحمل تنبيه احتيال أو تكرار.",
              "راجع تفاصيل الطلب وسجل طلبات العميل.",
              "أكّد الطلب أو ألغِه قبل انتقاله إلى الشحن.",
            ],
          },
        ],
      },
      {
        id: "shipping",
        title: "الشحن",
        description: "أرسل الطلبات المؤكدة إلى شركة الشحن وتابعها.",
        articles: [
          {
            id: "connect-carrier",
            title: "ربط شركة شحن",
            summary: "اربط شركة شحن متاحة لحسابك.",
            steps: [
              "افتح قسم الشحن في الإعدادات.",
              "اختر شركة من القائمة المتاحة لدولتك.",
              "أدخل بيانات الحساب التي تقدمها شركة الشحن.",
            ],
          },
          {
            id: "track-settle",
            title: "متابعة الشحنات والتسويات",
            summary: "تابع التوصيل وطابق المبالغ المُحصَّلة.",
            steps: [
              "يحصل كل طلب مؤكد على كود تتبع.",
              "تابع حالة الشحنة من صفحة الطلب.",
              "طابق المبالغ المُحصَّلة مع الطلبات المُسلَّمة في قسم التسويات.",
            ],
          },
        ],
      },
      {
        id: "payments",
        title: "المدفوعات",
        description: "اقبل الدفع عند الاستلام والدفع الإلكتروني.",
        articles: [
          {
            id: "online-payments",
            title: "إضافة الدفع الإلكتروني",
            summary: "قدّم الدفع الإلكتروني إلى جانب الدفع عند الاستلام.",
            steps: [
              "افتح قسم المدفوعات في الإعدادات.",
              "اختر مزوّدًا مدعومًا مثل Paymob أو InstaPay متى كان متاحًا لنشاطك.",
              "أدخل بيانات الاعتماد من حسابك لدى المزوّد.",
              "حدد وسائل الدفع التي تظهر في صفحة الدفع.",
            ],
          },
        ],
      },
      {
        id: "funnels",
        title: "مسارات البيع",
        description: "ابنِ مسارات بيع بعروض إضافية.",
        articles: [
          {
            id: "build-funnel",
            title: "بناء مسار بيع",
            summary: "أنشئ صفحة هبوط وصفحة دفع وعروضًا بعد الشراء.",
            steps: [
              "أنشئ مسار بيع جديدًا واختر المنتج.",
              "ابدأ صفحة الهبوط من قالب ذكي وعدّل كل قسم.",
              "أضف عرضًا إضافيًا إلى صفحة الدفع.",
              "أضف بيعًا إضافيًا، وعرضًا بديلًا اختياريًا لمن يرفض.",
              "انشر المسار واستخدم رابطه في إعلاناتك.",
            ],
          },
          {
            id: "read-profit",
            title: "قراءة الربح لكل حملة",
            summary: "اعرف الحملات التي تغطي تكلفتها على أساس الطلبات المُسلَّمة.",
            steps: [
              "اربط حساباتك الإعلانية من التكاملات.",
              "افتح التحليلات لرؤية تكلفة الطلب المُسلَّم والعائد الحقيقي.",
              "استخدم نقطة التعادل لتقرر أي الحملات توسّعها أو توقفها.",
            ],
          },
        ],
      },
      {
        id: "account-billing",
        title: "الحساب والفوترة",
        description: "أدر فريقك ومتاجرك وباقتك وبياناتك.",
        articles: [
          {
            id: "team-roles",
            title: "دعوة أعضاء الفريق وتحديد الأدوار",
            summary: "امنح كل شخص الصلاحيات التي يحتاجها فقط.",
            steps: [
              "افتح إعدادات الفريق وادعُ عضوًا عبر البريد الإلكتروني.",
              "اختر دوره.",
              "غيّر الصلاحيات أو أزلها في أي وقت.",
            ],
          },
          {
            id: "export-data",
            title: "تصدير بياناتك",
            summary: "نزّل طلباتك وعملاءك ومنتجاتك.",
            steps: [
              "افتح قائمة الطلبات أو العملاء أو المنتجات.",
              "استخدم أمر التصدير.",
              "نزّل الملف الناتج.",
            ],
          },
          {
            id: "plan-billing",
            title: "الباقات والفوترة",
            summary: "ما يمكن توقعه خلال مرحلة الوصول المبكر.",
            steps: [
              "يمكن البدء مع ZIMOS مجانًا خلال الوصول المبكر دون بطاقة.",
              "سيتم إعلان الأسعار الرسمية قبل تطبيق أي رسوم.",
              "لأسئلة الباقات، تواصل مع فريقنا من صفحة التواصل.",
            ],
          },
        ],
      },
    ],
  },
};
