import type { FunnelEdgeCondition, FunnelStatus, FunnelStepType } from "@/mock/types";
import type { Locale, Messages } from "@/i18n/LocaleContext";

export const EDITOR_STRINGS = {
  en: {
    notFound: "This funnel doesn't exist.",
    backToFunnels: "Back to funnels",
    clickToRename: "Click to rename",
    unsavedChanges: "Unsaved changes",
    preview: "Preview",
    pause: "Pause",
    resume: "Resume",
    publish: "Publish",
    cantPublish: "This funnel can’t be published yet:",
    steps: "Steps",
    selectHint: "Select a step on the canvas or in the list to edit it.",
    deleteStepTitle: "Delete this step?",
    deleteStepDescription: "\"{name}\" and every edge connected to it will be removed. Nothing is deleted until you save.",
    deleteStep: "Delete step",
    toastSaved: "Funnel saved.",
    toastFixProblems: "Fix the problems below before publishing.",
    toastPublished: "Funnel published.",
    toastPaused: "Funnel paused.",
    toastResumed: "Funnel resumed.",
    canvasLabel: "Funnel flow canvas",
  },
  ar: {
    notFound: "مسار البيع هذا غير موجود.",
    backToFunnels: "العودة إلى مسارات البيع",
    clickToRename: "انقر لإعادة التسمية",
    unsavedChanges: "تغييرات غير محفوظة",
    preview: "معاينة",
    pause: "إيقاف مؤقت",
    resume: "استئناف",
    publish: "نشر",
    cantPublish: "لا يمكن نشر مسار البيع هذا بعد:",
    steps: "الخطوات",
    selectHint: "اختر خطوة من اللوحة أو من القائمة لتعديلها.",
    deleteStepTitle: "حذف هذه الخطوة؟",
    deleteStepDescription: "ستتم إزالة «{name}» وكل الروابط المتصلة بها. لن يُحذف شيء قبل الحفظ.",
    deleteStep: "حذف الخطوة",
    toastSaved: "تم حفظ مسار البيع.",
    toastFixProblems: "أصلح المشكلات أدناه قبل النشر.",
    toastPublished: "تم نشر مسار البيع.",
    toastPaused: "تم إيقاف مسار البيع مؤقتًا.",
    toastResumed: "تم استئناف مسار البيع.",
    canvasLabel: "لوحة تدفق مسار البيع",
  },
} satisfies Messages;

export const LIST_STRINGS = {
  en: {
    addStep: "Add step",
    reorder: "Reorder {name}",
    deleteNamed: "Delete {name}",
  },
  ar: {
    addStep: "إضافة خطوة",
    reorder: "إعادة ترتيب {name}",
    deleteNamed: "حذف {name}",
  },
} satisfies Messages;

export const CANVAS_STRINGS = {
  en: {
    entry: "entry",
    abRunning: "A/B test running",
  },
  ar: {
    entry: "البداية",
    abRunning: "اختبار A/B قيد التشغيل",
  },
} satisfies Messages;

export const INSPECTOR_STRINGS = {
  en: {
    stepSettings: "Step settings",
    closeInspector: "Close inspector",
    name: "Name",
    type: "Type",
    offer: "Offer",
    product: "Product",
    pickProduct: "— Pick a product —",
    required: "Required before publishing.",
    offerPrice: "Offer price",
    abTest: "A/B test this step",
    abOn: "Traffic is split between variants.",
    abOff: "Compare two versions of this step.",
    manageExperiments: "Manage in Experiments",
    edges: "Edges",
    thankYouEnds: "The thank-you page ends the funnel.",
    noEdges: "No outgoing edges yet.",
    toStep: "To step",
    toStepOption: "→ {name}",
    removeEdge: "Remove edge",
    condition: "Condition",
    priority: "Priority",
  },
  ar: {
    stepSettings: "إعدادات الخطوة",
    closeInspector: "إغلاق لوحة الإعدادات",
    name: "الاسم",
    type: "النوع",
    offer: "العرض",
    product: "المنتج",
    pickProduct: "— اختر منتجًا —",
    required: "مطلوب قبل النشر.",
    offerPrice: "سعر العرض",
    abTest: "تشغيل اختبار A/B لهذه الخطوة",
    abOn: "يتم تقسيم الزيارات بين النسخ.",
    abOff: "قارن بين نسختين من هذه الخطوة.",
    manageExperiments: "الإدارة من صفحة التجارب",
    edges: "الروابط",
    thankYouEnds: "صفحة الشكر هي نهاية مسار البيع.",
    noEdges: "لا توجد روابط خارجة بعد.",
    toStep: "إلى الخطوة",
    toStepOption: "← {name}",
    removeEdge: "إزالة الرابط",
    condition: "الشرط",
    priority: "الأولوية",
  },
} satisfies Messages;

export const VALIDATION_STRINGS = {
  en: {
    noLanding: "Add exactly one landing page as the entry step.",
    manyLanding: "Only one landing page is allowed (found {n}).",
    danglingEdge: "An edge points to a step that no longer exists ({from} → {to}).",
    unreachable: "\"{name}\" can't be reached from the landing page.",
    needsOffer: "\"{name}\" ({type}) needs an offer product.",
    noOutgoing: "\"{name}\" has no outgoing edge — visitors would get stuck.",
  },
  ar: {
    noLanding: "أضف صفحة هبوط واحدة فقط كخطوة البداية.",
    manyLanding: "مسموح بصفحة هبوط واحدة فقط (يوجد {n}).",
    danglingEdge: "يوجد رابط يشير إلى خطوة لم تعد موجودة ({from} ← {to}).",
    unreachable: "لا يمكن الوصول إلى «{name}» من صفحة الهبوط.",
    needsOffer: "«{name}» ({type}) تحتاج إلى منتج للعرض.",
    noOutgoing: "«{name}» ليس لها رابط خارج — سيتوقف الزائر عندها.",
  },
} satisfies Messages;

export const STEP_TYPE_LABELS: Record<Locale, Record<FunnelStepType, string>> = {
  en: {
    landing: "Landing page",
    checkout: "Checkout",
    order_bump: "Order bump",
    upsell: "Upsell",
    downsell: "Downsell",
    thank_you: "Thank you",
  },
  ar: {
    landing: "صفحة الهبوط",
    checkout: "صفحة الدفع",
    order_bump: "عرض إضافي عند الدفع",
    upsell: "عرض بعد الشراء",
    downsell: "عرض بديل",
    thank_you: "صفحة الشكر",
  },
};

/** Default display name for a freshly added step (becomes editable user data). */
export const STEP_DEFAULT_NAMES: Record<Locale, Record<FunnelStepType, string>> = {
  en: {
    landing: "Landing page",
    checkout: "Checkout",
    order_bump: "Order bump",
    upsell: "Upsell",
    downsell: "Downsell",
    thank_you: "Thank you",
  },
  ar: {
    landing: "صفحة الهبوط",
    checkout: "الدفع",
    order_bump: "عرض إضافي عند الدفع",
    upsell: "عرض بعد الشراء",
    downsell: "عرض بديل",
    thank_you: "شكراً لطلبك",
  },
};

export const CONDITION_LABELS: Record<Locale, Record<FunnelEdgeCondition, string>> = {
  en: {
    always: "Always",
    completed_checkout: "Completed checkout",
    accepted_offer: "Accepted",
    declined_offer: "Declined",
  },
  ar: {
    always: "دائمًا",
    completed_checkout: "أكمل الدفع",
    accepted_offer: "قبِل العرض",
    declined_offer: "رفض العرض",
  },
};

export const STATUS_LABELS: Record<Locale, Record<FunnelStatus, string>> = {
  en: { draft: "Draft", published: "Published", paused: "Paused" },
  ar: { draft: "مسودة", published: "منشور", paused: "متوقف مؤقتًا" },
};
