import type { Messages } from "@/i18n/LocaleContext";

/**
 * The words of a funnel step's page editor that are its own: the slim step
 * bar, the phone's bottom bar, the empty page and the hint about the offer's
 * product. Everything the editor shares with the store editor (the inspector,
 * the library, the section list, undo / redo, the device switch) keeps the
 * store editor's words.
 */
export const STEP_PAGE_STRINGS = {
  en: {
    bar: "This step's page",
    backToMap: "Map",
    backToMapHint: "Back to the funnel map",
    previousStep: "Previous step: {name}",
    nextStep: "Next step: {name}",
    firstStep: "This is the first step",
    lastStep: "This is the last step",
    stepPicker: "Switch step: {name}",
    menuPageSettings: "Page settings (name, SEO, scripts)",
    dockSettings: "Settings",
    idleTitle: "Edit where you look",
    idleHint: "Tap anything on the page to edit it. Changes are saved with the funnel.",
    emptyTitle: "This page is empty",
    emptyBody: "A step needs something on its page before the funnel can be published.",
    startReady: "Start with a ready page",
    readyApplied: "Ready page added — make it yours.",
    productHint: "This step's offer is on “{product}”. Product blocks with no product picked show your newest product.",
    productUse: "Show “{product}”",
    productBar: "This step's product",
  },
  ar: {
    bar: "صفحة الخطوة دي",
    backToMap: "الخريطة",
    backToMapHint: "ارجع لخريطة الفانل",
    previousStep: "الخطوة اللي قبلها: {name}",
    nextStep: "الخطوة اللي بعدها: {name}",
    firstStep: "دي أول خطوة",
    lastStep: "دي آخر خطوة",
    stepPicker: "غيّر الخطوة: {name}",
    menuPageSettings: "إعدادات الصفحة (الاسم، SEO، الأكواد)",
    dockSettings: "الإعدادات",
    idleTitle: "عدّل وانت شايف",
    idleHint: "اضغط على أي حاجة في الصفحة عشان تعدّلها. التعديلات بتتحفظ مع الفانل.",
    emptyTitle: "الصفحة دي فاضية",
    emptyBody: "الخطوة لازم يبقى في صفحتها حاجة قبل ما الفانل يتنشر.",
    startReady: "ابدأ بصفحة جاهزة",
    readyApplied: "اتضافت صفحة جاهزة — عدّلها على ذوقك.",
    productHint: "عرض الخطوة دي على «{product}». بلوكات المنتج اللي ما اخترتلهاش منتج بتعرض أحدث منتج عندك.",
    productUse: "اعرض «{product}»",
    productBar: "منتج الخطوة دي",
  },
} satisfies Messages;
