import type { Locale } from "@/lib/i18n";
import type { XsGridCopy } from "./XsProductGrid";

/** The words the template bands draw themselves (arrows, empty bands, the product grid's controls), in the store's language. */
export const xsCopy = (locale: Locale) =>
  locale === "ar"
    ? { prev: "السابق", next: "التالي", noSlides: "أضف صورة واحدة على الأقل للسلايدر.", noBanners: "أضف بانر واحد على الأقل.", noProducts: "لا توجد منتجات في هذه المجموعة بعد.", view: "نظرة سريعة", all: "كل المنتجات", search: "بحث", searchPlaceholder: "ابحث عن منتج", loadMore: "تحميل المزيد", tabs: "الأقسام", open: "عرض المنتج", close: "إغلاق" }
    : { prev: "Previous", next: "Next", noSlides: "Add at least one picture to the slider.", noBanners: "Add at least one banner.", noProducts: "No products in this collection yet.", view: "Quick View", all: "All Products", search: "Search", searchPlaceholder: "Search", loadMore: "Load More", tabs: "Categories", open: "View product", close: "Close" };

/** The product grid's own words with nothing of the merchant's: the store's pages (components/xs/XsShopGrid). */
export function xsGridCopy(locale: Locale): XsGridCopy {
  const t = xsCopy(locale);
  return { search: t.search, searchPlaceholder: t.searchPlaceholder, loadMore: t.loadMore, view: t.view, empty: t.noProducts, tabs: t.tabs, open: t.open, close: t.close, prev: t.prev, next: t.next };
}
