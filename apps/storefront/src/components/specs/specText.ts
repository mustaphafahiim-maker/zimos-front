import type { SpecKeyName } from "@store-builder/api-client";
import type { Locale } from "@/lib/i18n";

/**
 * The shopper's wording for product specifications and comparison
 * (frontend-handoff 231): the product page's table and «قارن», the compare
 * page, and the specification filters of the product listing. Read with
 * `pickText(SPEC_TEXT, locale)`.
 */
export const SPEC_TEXT = {
  en: {
    title: "Specifications",
    compare: "Compare",
    added: "In your comparison",
    remove: "Remove",
    removeName: (name: string) => `Remove ${name} from the comparison`,
    full: (max: string) => `You can compare up to ${max} products. Remove one to add this.`,
    trayTitle: "Comparing",
    openCompare: (count: string) => `Compare now (${count})`,
    needTwo: "Add one more product to compare.",
    // the compare page
    pageTitle: "Compare products",
    emptyTitle: "Nothing to compare yet",
    emptyBody: "Open a product and choose “Compare”. You can line up to four products side by side.",
    oneBody: "One product is in your comparison. Add at least one more from its page.",
    browse: "Browse products",
    differencesOnly: "Show differences only",
    noSpecs: "These products have no specifications to compare.",
    allSame: "These products have the same specifications.",
    price: "Price",
    spec: "Specification",
    none: "—",
    addToCart: "Add to cart",
    viewProduct: "View product",
    clear: "Clear the comparison",
    loading: "Loading the comparison…",
    failed: "We couldn't load the comparison. Check your connection and try again.",
    retry: "Try again",
    gone: "A product in your comparison is no longer sold. The list was updated.",
    // the listing's filters
    filterTitle: "Filter by specification",
    filterCount: (n: string) => `${n} chosen`,
    resultsTitle: "Products matching your choice",
    resultsCount: (n: string) => `${n} products`,
    clearFilters: "Clear the specification filters",
    noMatches: "No product has these specifications.",
    more: "Show more",
    loadingMore: "Loading…",
    filterFailed: "We couldn't load the products. Try again.",
  },
  ar: {
    title: "المواصفات",
    compare: "قارن",
    added: "في المقارنة",
    remove: "شيل",
    removeName: (name: string) => `شيل ${name} من المقارنة`,
    full: (max: string) => `تقدر تقارن لحد ${max} منتجات. شيل واحد علشان تضيف ده.`,
    trayTitle: "بتقارن",
    openCompare: (count: string) => `قارن دلوقتي (${count})`,
    needTwo: "ضيف منتج كمان علشان تقارن.",
    pageTitle: "قارن المنتجات",
    emptyTitle: "لسه مفيش حاجة تتقارن",
    emptyBody: "افتح منتج واختار «قارن». تقدر تحط لحد أربع منتجات جنب بعض.",
    oneBody: "فيه منتج واحد في المقارنة. ضيف واحد كمان على الأقل من صفحته.",
    browse: "تصفح المنتجات",
    differencesOnly: "اعرض الاختلافات بس",
    noSpecs: "المنتجات دي ملهاش مواصفات تتقارن.",
    allSame: "المنتجات دي مواصفاتها واحدة.",
    price: "السعر",
    spec: "المواصفة",
    none: "—",
    addToCart: "أضف للسلة",
    viewProduct: "شوف المنتج",
    clear: "امسح المقارنة",
    loading: "بنحمّل المقارنة…",
    failed: "معرفناش نحمّل المقارنة. اتأكد من النت وجرّب تاني.",
    retry: "جرّب تاني",
    gone: "منتج في المقارنة مبقاش بيتباع. القايمة اتحدّثت.",
    filterTitle: "فلتر بالمواصفات",
    filterCount: (n: string) => `اخترت ${n}`,
    resultsTitle: "المنتجات اللي بالمواصفات دي",
    resultsCount: (n: string) => `${n} منتج`,
    clearFilters: "امسح فلاتر المواصفات",
    noMatches: "مفيش منتج بالمواصفات دي.",
    more: "اعرض أكتر",
    loadingMore: "بنحمّل…",
    filterFailed: "معرفناش نحمّل المنتجات. جرّب تاني.",
  },
};

export type SpecText = (typeof SPEC_TEXT)["en"];

/** A specification's name in the shopper's language, else in the other one the store wrote. */
export function specName(name: SpecKeyName | null | undefined, locale: Locale): string {
  const ar = name?.ar?.trim() ?? "";
  const en = name?.en?.trim() ?? "";
  return locale === "ar" ? ar || en : en || ar;
}

/** "128 GB": a value with its unit. */
export function specValue(value: string, unit: string | null | undefined): string {
  return unit ? `${value} ${unit}` : value;
}
