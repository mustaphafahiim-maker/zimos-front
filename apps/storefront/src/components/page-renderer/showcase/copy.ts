import type { Locale } from "@/lib/i18n";

/**
 * The few words the showcase sections say on their own — control names for
 * screen readers, the discount pill, and the hint an empty block shows in the
 * website editor. Everything a shopper reads as content is the merchant's.
 */
const en = {
  previous: "Previous",
  next: "Next",
  slide: "Slide",
  page: "Part",
  slider: "Featured",
  videos: "Browse the videos",
  soundOn: "Turn sound on",
  soundOff: "Turn sound off",
  viewProduct: "View product",
  discount: (pct: number) => `${pct}% off`,
  emptySlides: "Add a picture to the first slide to see the slider here.",
  emptyTiles: "Add your categories — a picture, a name and where it links to.",
  emptyTrust: "Add the reasons a shopper can trust you.",
  emptyNeeds: "Add the needs a shopper picks from, and the product that answers each.",
  emptyVideos: "Add a video to see the shelf here.",
  emptyBanner: "Add a picture to see the banner here.",
};

const ar: typeof en = {
  previous: "السابق",
  next: "التالي",
  slide: "شريحة",
  page: "الجزء",
  slider: "العروض الرئيسية",
  videos: "التنقل بين الفيديوهات",
  soundOn: "تشغيل الصوت",
  soundOff: "كتم الصوت",
  viewProduct: "عرض المنتج",
  discount: (pct: number) => `خصم ${pct}٪`,
  emptySlides: "أضف صورة لأول شريحة عشان السلايدر يظهر هنا.",
  emptyTiles: "أضف أقسامك — صورة واسم والرابط اللي يفتحه.",
  emptyTrust: "أضف الأسباب اللي تخلّي العميل يثق فيك.",
  emptyNeeds: "أضف الاحتياجات اللي العميل يختار منها، والمنتج المناسب لكل واحد.",
  emptyVideos: "أضف فيديو عشان الرف يظهر هنا.",
  emptyBanner: "أضف صورة عشان البانر يظهر هنا.",
};

export type ShowcaseCopy = typeof en;

export function showcaseCopy(locale: Locale): ShowcaseCopy {
  return locale === "ar" ? ar : en;
}
