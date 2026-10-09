import { resolveProductCms, type CatalogProduct, type Product, type Variant } from "@store-builder/api-client";
import { formatMoney, formatMoneyRange, parseMoney } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { fmt, getLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useCatalogLabels } from "../catalogLabels";
import { isVideoMedia } from "../components/ProductVideoSection";
import type { GroupKey } from "./groups";

/**
 * What each group of the product page says in one line while it is folded on a
 * phone («٣ صور وفيديو», «٤ متغيرات — من ٢٥٠ ج.م · مخزون ٣٢ قطعة»), and the
 * price the header shows. All of it from the product the page already holds:
 * no request is made for a summary.
 */

const STRINGS = {
  en: {
    photos_one: "{n} photo",
    photos_two: "{n} photos",
    photos_few: "{n} photos",
    photos_many: "{n} photos",
    photos_other: "{n} photos",
    noPhotos: "No photos yet",
    withVideo: "{photos} and a video",
    videoOnly: "A video, no photos",
    variants_one: "{n} variant",
    variants_two: "{n} variants",
    variants_few: "{n} variants",
    variants_many: "{n} variants",
    variants_other: "{n} variants",
    noVariants: "No variant yet: customers can't buy it",
    priceFrom: "from {price}",
    stock: "{pieces} in stock",
    notTracked: "quantity not tracked",
    noOptions: "No options",
    fields_one: "{n} custom field",
    fields_two: "{n} custom fields",
    fields_few: "{n} custom fields",
    fields_many: "{n} custom fields",
    fields_other: "{n} custom fields",
    offers_one: "{n} offer",
    offers_two: "{n} offers",
    offers_few: "{n} offers",
    offers_many: "{n} offers",
    offers_other: "{n} offers",
    noOffers: "Bundles, pre-orders and purchase limits",
    features_one: "{n} feature",
    features_two: "{n} features",
    features_few: "{n} features",
    features_many: "{n} features",
    features_other: "{n} features",
    testimonials_one: "{n} testimonial",
    testimonials_two: "{n} testimonials",
    testimonials_few: "{n} testimonials",
    testimonials_many: "{n} testimonials",
    testimonials_other: "{n} testimonials",
    faqs_one: "{n} question",
    faqs_two: "{n} questions",
    faqs_few: "{n} questions",
    faqs_many: "{n} questions",
    faqs_other: "{n} questions",
    pageEmpty: "Content, page settings and the A/B test",
    seoCustom: "Your own title and description",
    seoDefault: "Uses the product's name and description",
    seoHidden: "Hidden from search engines",
    noCollections: "Not in any collection yet",
    andMore: "{names} +{n}",
  },
  ar: {
    photos_one: "صورة واحدة",
    photos_two: "صورتين",
    photos_few: "{n} صور",
    photos_many: "{n} صورة",
    photos_other: "{n} صورة",
    noPhotos: "من غير صور لسه",
    withVideo: "{photos} وفيديو",
    videoOnly: "فيديو من غير صور",
    variants_one: "متغير واحد",
    variants_two: "متغيرين",
    variants_few: "{n} متغيرات",
    variants_many: "{n} متغير",
    variants_other: "{n} متغير",
    noVariants: "من غير متغير لسه: العميل مش هيقدر يشتريه",
    priceFrom: "من {price}",
    stock: "المخزون {pieces}",
    notTracked: "الكمية مش بتتتبّع",
    noOptions: "من غير خيارات",
    fields_one: "خانة إضافية واحدة",
    fields_two: "خانتين إضافيتين",
    fields_few: "{n} خانات إضافية",
    fields_many: "{n} خانة إضافية",
    fields_other: "{n} خانة إضافية",
    offers_one: "عرض واحد",
    offers_two: "عرضين",
    offers_few: "{n} عروض",
    offers_many: "{n} عرض",
    offers_other: "{n} عرض",
    noOffers: "الباقات، الطلب المسبق وحدود الشراء",
    features_one: "ميزة واحدة",
    features_two: "ميزتين",
    features_few: "{n} مميزات",
    features_many: "{n} ميزة",
    features_other: "{n} ميزة",
    testimonials_one: "رأي واحد",
    testimonials_two: "رأيين",
    testimonials_few: "{n} آراء",
    testimonials_many: "{n} رأي",
    testimonials_other: "{n} رأي",
    faqs_one: "سؤال واحد",
    faqs_two: "سؤالين",
    faqs_few: "{n} أسئلة",
    faqs_many: "{n} سؤال",
    faqs_other: "{n} سؤال",
    pageEmpty: "المحتوى، إعدادات الصفحة واختبار A/B",
    seoCustom: "عنوان ووصف من عندك",
    seoDefault: "بياخد اسم المنتج ووصفه",
    seoHidden: "مخفي من محركات البحث",
    noCollections: "مش في أي مجموعة لسه",
    andMore: "{names} +{n}",
  },
} satisfies Messages;

/** The variants a shopper can meet: everything not archived (all of them when every one is). */
function liveVariants(variants: Variant[]): Variant[] {
  const live = variants.filter((v) => v.status !== "archived");
  return live.length > 0 ? live : variants;
}

function moneyLocale(): string {
  return getLocale() === "ar" ? "ar-EG" : "en-EG";
}

/** The product's price as the header says it: one price, or the range of its variants. Null with no variant. */
export function productPriceLabel(variants: Variant[]): string | null {
  const live = liveVariants(variants);
  if (live.length === 0) return null;
  const prices = live.map((v) => parseMoney(v.priceAmount));
  return formatMoneyRange(Math.min(...prices), Math.max(...prices), live[0].currency, moneyLocale());
}

/** Whether the product's quantity is counted (the same rule the variants section is given). */
export function isTracked(product: Product): boolean {
  return product.productType !== "physical" || (product as { trackInventory?: boolean }).trackInventory !== false;
}

/** At most two names, then "+n". */
function someNames(names: string[], template: string): string {
  const comma = getLocale() === "ar" ? "، " : ", ";
  const shown = names.slice(0, 2).join(comma);
  return names.length > 2 ? fmt(template, { names: shown, n: names.length - 2 }) : shown;
}

export function useGroupSummaries(product: Product): Record<GroupKey, string> {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const variants = product.variants ?? [];
  const live = variants.filter((v) => v.status !== "archived");
  const media = product.media ?? [];
  const photos = media.filter((m) => !isVideoMedia(m)).length;
  const hasVideo = media.some(isVideoMedia);

  // Basics: the type, then the first tags.
  const tags = product.tags ?? [];
  const basics = [labels.type(product.productType), tags.length > 0 ? someNames(tags, t.andMore) : null].filter(Boolean).join(" · ");

  const photosSaid = photos > 0 ? pluralOf(t, "photos", photos) : null;
  const mediaLine = photosSaid ? (hasVideo ? fmt(t.withVideo, { photos: photosSaid }) : photosSaid) : hasVideo ? t.videoOnly : t.noPhotos;

  // Price and stock: how many variants, the lowest price, what is on the shelf.
  let pricing = t.noVariants;
  if (live.length > 0) {
    const prices = live.map((v) => parseMoney(v.priceAmount));
    const lowest = formatMoney(Math.min(...prices), live[0].currency);
    const priceSaid = live.length > 1 ? `${pluralOf(t, "variants", live.length)} — ${fmt(t.priceFrom, { price: lowest })}` : lowest;
    const stockSaid = isTracked(product)
      ? fmt(t.stock, { pieces: countOf("piece", live.reduce((sum, v) => sum + (v.stockOnHand ?? 0), 0)) })
      : t.notTracked;
    pricing = `${priceSaid} · ${stockSaid}`;
  }

  // Options: the names the active variants use, then the custom fields.
  const optionNames: string[] = [];
  for (const variant of variants) {
    if (variant.status !== "active") continue;
    for (const [name, value] of Object.entries(variant.optionValues ?? {})) {
      if (value && !optionNames.includes(name)) optionNames.push(name);
    }
  }
  const fields = (product.customFields ?? []).length;
  const options =
    [optionNames.length > 0 ? someNames(optionNames, t.andMore) : null, fields > 0 ? pluralOf(t, "fields", fields) : null].filter(Boolean).join(" · ") ||
    t.noOptions;

  const liveOffers = (product.offers ?? []).filter((o) => o.status !== "archived").length;
  const offers = liveOffers > 0 ? pluralOf(t, "offers", liveOffers) : t.noOffers;

  const cms = resolveProductCms((product as unknown as CatalogProduct).cms);
  const page =
    [
      cms.features.length > 0 ? pluralOf(t, "features", cms.features.length) : null,
      cms.testimonials.length > 0 ? pluralOf(t, "testimonials", cms.testimonials.length) : null,
      cms.faqs.length > 0 ? pluralOf(t, "faqs", cms.faqs.length) : null,
    ]
      .filter(Boolean)
      .join(" · ") || t.pageEmpty;

  const stored = (product.seo ?? {}) as Record<string, unknown>;
  const custom = (typeof stored.title === "string" && stored.title.trim() !== "") || (typeof stored.description === "string" && stored.description.trim() !== "");
  const seo = stored.noindex === true ? t.seoHidden : custom ? t.seoCustom : t.seoDefault;

  const memberships = product.collections ?? [];
  const collections = memberships.length > 0 ? someNames(memberships.map((c) => c.name), t.andMore) : t.noCollections;

  return { basics, media: mediaLine, pricing, options, offers, page, seo, collections };
}
