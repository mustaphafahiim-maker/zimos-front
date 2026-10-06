import { cache } from "react";
import type { Dictionary, Locale } from "./i18n";

/**
 * The merchant's own wording for the store's labels (dashboard → Website →
 * Store texts; backend storefront/storefrontTexts.js), laid over the
 * dictionary in lib/i18n.ts.
 *
 * GET /store/:ws carries them as `storefrontTexts`: language → dictionary path
 * ("checkout.place", "form.errors.summary") → plain text. A path the
 * dictionary does not have, or one that names a group or a list, is ignored.
 * A text whose default takes a value (`cart.perUnit(price)`) keeps its
 * `{price}`-style placeholders, filled here with the value named after the
 * function's argument (ARG_NAMES).
 *
 * Server components get them through a per-request slot (as lib/moneyFormat
 * does for the currency format): reading the store (lib/storeMeta
 * getStoreState) fills it, and getDictionary reads it. React's `cache` keeps
 * the slot to one request on the server; in client components it never holds
 * anything, so they pass the texts explicitly (StoreContext).
 */
export type StoreTexts = Record<string, Record<string, string>>;

/** The argument names of the dictionary's texts that take values, in order. */
const ARG_NAMES: Record<string, readonly string[]> = {
  "common.cartWithCount": ["n"],
  "common.save": ["pct"],
  "common.piece": ["n"],
  "catalog.searchTitle": ["q"],
  "catalog.count": ["n"],
  "catalog.noResults": ["q"],
  "catalog.filterCount": ["n"],
  "catalog.showResults": ["n"],
  "catalog.page": ["n"],
  "catalog.seeAll": ["q"],
  "catalog.suggestionsCount": ["n"],
  "custom.counter": ["n", "max"],
  "custom.adds": ["amount"],
  "custom.tooLong": ["max"],
  "custom.photoPreview": ["label"],
  "product.youSave": ["amount"],
  "form.errors.summary": ["n"],
  "bump.only": ["price"],
  "bump.addedNote": ["name"],
  "cart.perUnit": ["price"],
  "checkout.freeShippingHint": ["amount"],
  "checkout.discountPending": ["code"],
  "payment.orderNumber": ["n"],
  "payment.failedReason": ["reason"],
  "payment.retryWith": ["method"],
  "payment.expiresAt": ["time"],
  "upsell.save": ["amount"],
  "thankYou.whatsappMessage": ["store", "number"],
  "thankYou.shareText": ["store"],
  "track.errors.rateLimitedIn": ["minutes"],
  "footer.rights": ["store", "year"],
  "unavailable.body": ["store"],
  "renderer.item": ["n"],
  "renderer.rating": ["n"],
  "renderer.cartCount": ["n"],
  "immersive.modelOf": ["name"],
  "funnel.step": ["n"],
  "meta.storeDescription": ["store"],
  "shop.itemsInCart": ["n"],
  "shop.addedToCart": ["name"],
  "shop.payOnlineTotal": ["amount"],
  "shop.stepOf": ["n", "total"],
  "shop.funnelStep": ["n"],
  "shop.goToSlide": ["n"],
};

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

/** A value as the default texts write it: Arabic-Indic digits in Arabic, a year as is. */
function show(value: unknown, name: string, locale: Locale): string {
  if (typeof value === "number" && locale === "ar" && name !== "year") return new Intl.NumberFormat("ar-EG").format(value);
  return String(value ?? "");
}

/** The merchant's text with each `{name}` replaced by the matching argument; other braces stay as written. */
function filler(text: string, key: string, locale: Locale): (...args: unknown[]) => string {
  // A text the table does not know: its placeholders take the arguments in order of appearance.
  const names = ARG_NAMES[key] ?? [...new Set(Array.from(text.matchAll(PLACEHOLDER), (m) => m[1]))];
  return (...args: unknown[]) =>
    text.replace(PLACEHOLDER, (whole, name: string) => {
      const i = names.indexOf(name);
      return i >= 0 && i < args.length ? show(args[i], name, locale) : whole;
    });
}

/** `dict` with the overrides laid over it; untouched groups are shared, not copied. */
function apply(dict: Dictionary, overrides: Record<string, string>, locale: Locale): Dictionary {
  const root: Record<string, unknown> = { ...(dict as unknown as Record<string, unknown>) };
  for (const [key, raw] of Object.entries(overrides)) {
    if (typeof raw !== "string") continue;
    const text = raw.trim();
    if (!text) continue;
    const parts = key.split(".");
    if (parts.length < 2) continue;
    // Walk down, copying each group on the way so the shared dictionary is never changed.
    let node: Record<string, unknown> = root;
    let ok = true;
    for (const part of parts.slice(0, -1)) {
      const child = Object.prototype.hasOwnProperty.call(node, part) ? node[part] : undefined;
      if (!child || typeof child !== "object" || Array.isArray(child)) {
        ok = false;
        break;
      }
      const copy = { ...(child as Record<string, unknown>) };
      node[part] = copy;
      node = copy;
    }
    const leaf = parts[parts.length - 1];
    if (!ok || !Object.prototype.hasOwnProperty.call(node, leaf)) continue;
    const current = node[leaf];
    if (typeof current === "string") node[leaf] = text;
    else if (typeof current === "function") node[leaf] = filler(text, key, locale);
  }
  return root as unknown as Dictionary;
}

// One merged dictionary per override object and language.
const merged = new WeakMap<object, Map<Locale, Dictionary>>();

/** The dictionary in `locale` with the store's texts for that language over it. */
export function withStoreTexts(dict: Dictionary, texts: StoreTexts | null | undefined, locale: Locale): Dictionary {
  const overrides = texts?.[locale];
  if (!overrides || typeof overrides !== "object" || Object.keys(overrides).length === 0) return dict;
  let byLocale = merged.get(overrides);
  if (!byLocale) {
    byLocale = new Map();
    merged.set(overrides, byLocale);
  }
  let result = byLocale.get(locale);
  if (!result) {
    result = apply(dict, overrides, locale);
    byLocale.set(locale, result);
  }
  return result;
}

/** The store texts as the public store answer carries them; `{}` when none. */
export function storeTextsOf(store: unknown): StoreTexts {
  const texts = (store as { storefrontTexts?: unknown } | null)?.storefrontTexts;
  return texts && typeof texts === "object" && !Array.isArray(texts) ? (texts as StoreTexts) : {};
}

const requestSlot = cache((): { value: StoreTexts | null } => ({ value: null }));

export function setRequestStoreTexts(texts: StoreTexts | null | undefined) {
  requestSlot().value = texts ?? null;
}

export function requestStoreTexts(): StoreTexts | null {
  return requestSlot().value;
}
