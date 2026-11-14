/**
 * The words on the store's own pages — a product's buttons and order form,
 * the catalogue's controls, the cart and checkout — that the merchant may
 * write their own way, per language:
 *
 *   themeSettings.storeWords = { ar: { "product.orderNow": "اطلبها دلوقتي" }, en: { … } }
 *
 * Only the paths in STORE_WORDS, each a word of the storefront's dictionary
 * (lib/i18n.ts); anything else is ignored. A word left out is the
 * dictionary's. The dashboard offers the same list (editor/StoreWordsBlock).
 */

export const STORE_WORDS = [
  "product.orderNow",
  "product.addToCart",
  "product.stickyOrder",
  "product.quantity",
  "common.inStock",
  "form.title",
  "form.subtitle",
  "form.phone",
  "form.governorate",
  "form.city",
  "form.notes",
  "form.total",
  "form.submit",
  "checkout.codHint",
  "shop.details",
  "shop.shippingReturns",
  "catalog.allProducts",
  "catalog.sort",
  "catalog.filters",
  "catalog.price",
  "catalog.related",
  "cart.title",
  "cart.empty",
  "cart.emptyHint",
  "cart.checkout",
  "checkout.title",
  "common.continueShopping",
] as const;

export type StoreWords = Partial<Record<(typeof STORE_WORDS)[number], string>>;

const MAX = 160;

const objectOf = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** One language's own words, each checked; empty when none. */
export function readStoreWords(themeSettings: Record<string, unknown> | null | undefined, locale: string): StoreWords {
  const own = objectOf(objectOf(themeSettings?.storeWords)?.[locale]);
  if (!own) return {};
  const out: StoreWords = {};
  for (const path of STORE_WORDS) {
    const value = own[path];
    if (typeof value === "string" && value.trim() && value.length <= MAX) out[path] = value.trim();
  }
  return out;
}

/** Every language's own words, for the store context (lib/StoreContext). */
export function readAllStoreWords(themeSettings: Record<string, unknown> | null | undefined): Record<string, StoreWords> {
  const saved = objectOf(themeSettings?.storeWords);
  if (!saved) return {};
  const out: Record<string, StoreWords> = {};
  for (const locale of Object.keys(saved).slice(0, 4)) {
    if (!/^[a-z]{2}$/.test(locale)) continue;
    const words = readStoreWords(themeSettings, locale);
    if (Object.keys(words).length > 0) out[locale] = words;
  }
  return out;
}

/** The dictionary with the store's own words in place: the objects on each word's path copied, the rest shared. */
export function withStoreWords<T extends object>(dictionary: T, words: StoreWords | null | undefined): T {
  if (!words || Object.keys(words).length === 0) return dictionary;
  const out = { ...dictionary } as Record<string, unknown>;
  for (const [path, word] of Object.entries(words)) {
    if (!(STORE_WORDS as readonly string[]).includes(path) || typeof word !== "string") continue;
    const [group, key] = path.split(".");
    const inner = objectOf(out[group]);
    if (!inner || typeof inner[key] !== "string") continue;
    out[group] = { ...inner, [key]: word };
  }
  return out as T;
}
