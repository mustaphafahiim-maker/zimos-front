export type RendererLocale = "ar" | "en";

/** Every piece of UI text the renderer itself prints (not merchant content). */
export interface RendererStrings {
  imagePlaceholder: string;
  videoPlaceholder: string;
  video: string;
  embedded: string;
  noVideo: string;
  openInMaps: string;
  link: string;
  item: (n: number) => string;
  rating: (n: number) => string;
  formName: string;
  formPhone: string;
  formMessage: string;
  formSend: string;
  formPreview: string;
  countdownDays: string;
  countdownHours: string;
  countdownMinutes: string;
  countdownSeconds: string;
  /** Editor-only hints for blocks that render nothing on the live store until filled. */
  editorEmptyTestimonial: string;
  editorEmptyCountdown: string;
  editorEmptyButtonLink: string;
  editorEmptyBlock: (type: string) => string;
  commerceUnavailable: string;
}

export const RENDERER_STRINGS: Record<RendererLocale, RendererStrings> = {
  ar: {
    imagePlaceholder: "مكان الصورة — ارفع صورتك من المحرر",
    videoPlaceholder: "مكان الفيديو — حط رابط الفيديو من المحرر",
    video: "فيديو",
    embedded: "محتوى مضمّن",
    noVideo: "المتصفح مش قادر يشغّل الفيديو ده.",
    openInMaps: "افتح في الخريطة",
    link: "رابط",
    item: (n) => `عنصر ${n}`,
    rating: (n) => `${n} من 5`,
    formName: "الاسم",
    formPhone: "رقم الموبايل",
    formMessage: "رسالتك",
    formSend: "إرسال",
    formPreview: "النموذج ده للعرض فقط — الرسائل مش بتتسجل حاليًا.",
    countdownDays: "يوم",
    countdownHours: "ساعة",
    countdownMinutes: "دقيقة",
    countdownSeconds: "ثانية",
    editorEmptyTestimonial: "اكتب هنا رأي عميل حقيقي — مش هيظهر في المتجر لحد ما تكتبه",
    editorEmptyCountdown: "حدد تاريخ ووقت انتهاء العرض الحقيقي — العداد مش هيظهر من غيره",
    editorEmptyButtonLink: "الزرار ده محتاج رابط علشان يظهر في المتجر",
    editorEmptyBlock: (type) => `البلوك (${type}) فاضي — املاه علشان يظهر`,
    commerceUnavailable: "المنتجات هتظهر هنا في المتجر",
  },
  en: {
    imagePlaceholder: "Image placeholder — upload your image in the editor",
    videoPlaceholder: "Video placeholder — add a video link in the editor",
    video: "Video",
    embedded: "Embedded content",
    noVideo: "Your browser can't play this video.",
    openInMaps: "Open in maps",
    link: "Link",
    item: (n) => `Item ${n}`,
    rating: (n) => `${n} out of 5`,
    formName: "Name",
    formPhone: "Phone",
    formMessage: "Message",
    formSend: "Send",
    formPreview: "This form is a preview — submissions aren't collected yet.",
    countdownDays: "Days",
    countdownHours: "Hours",
    countdownMinutes: "Min",
    countdownSeconds: "Sec",
    editorEmptyTestimonial: "Write a real customer quote here — it stays hidden on the store until you do",
    editorEmptyCountdown: "Set the real offer end date & time — the timer is hidden without it",
    editorEmptyButtonLink: "This button needs a link to show on the store",
    editorEmptyBlock: (type) => `Empty ${type} block — fill it in to show it`,
    commerceUnavailable: "Products will appear here on the store",
  },
};

export function rendererStrings(locale: RendererLocale, overrides?: Partial<RendererStrings>): RendererStrings {
  return { ...RENDERER_STRINGS[locale === "en" ? "en" : "ar"], ...(overrides ?? {}) };
}
