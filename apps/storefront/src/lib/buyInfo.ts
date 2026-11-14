import {
  purchaseLimitProblems,
  purchaseLimitProductName,
  storefrontPreorderOf,
  storefrontPurchaseLimitsOf,
  type PurchaseLimitProblem,
  type StorefrontPreorder,
} from "@store-builder/api-client";
import { getDictionary, parseLocale, type Dictionary, type Locale } from "./i18n";

/**
 * What the product page, cart and checkout tell the shopper about buying:
 * pre-orders and purchase limits. Display only — the API decides what sells.
 */

type BuyText = Dictionary["buyInfo"];

/** A calendar day ("YYYY-MM-DD") in the shopper's language, read as that day (never shifted by the time zone). */
export function formatShopDay(
  ymd: string | null | undefined,
  intlLocale: string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }
): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const date = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale, { ...opts, timeZone: "UTC" }).format(date);
}

/** Whether the product keeps selling its variants once they run out. */
export function takesPreorders(product: unknown): boolean {
  return storefrontPreorderOf(product) !== null;
}

/**
 * The pre-order the chosen variant is sold as: only when it is sold out and
 * the product takes pre-orders; null otherwise (in stock, or "Sold out").
 */
export function preorderFor(product: unknown, variant: { inStock?: boolean } | null | undefined): StorefrontPreorder | null {
  if (!variant || variant.inStock) return null;
  return storefrontPreorderOf(product);
}

// ------------------------------------------------------ purchase limits --

/** The product page's quantity stepper bounds from the product's limits (the stepper's own defaults otherwise). */
export function stepperLimits(product: unknown): { min?: number; max?: number } {
  const l = storefrontPurchaseLimitsOf(product);
  return { ...(l?.min ? { min: l.min } : {}), ...(l?.max ? { max: l.max } : {}) };
}

/** "Min 2 per order", "Max 3 per order", "Max 4 per customer": the limits the product has, in order. */
export function limitLines(product: unknown, t: BuyText): string[] {
  const l = storefrontPurchaseLimitsOf(product);
  if (!l) return [];
  return [
    ...(l.min && l.min > 1 ? [t.minPerOrder(l.min)] : []),
    ...(l.max ? [t.maxPerOrder(l.max)] : []),
    ...(l.maxPerCustomer ? [t.maxPerCustomer(l.maxPerCustomer)] : []),
  ];
}

/** One refused product in the shopper's words; `withName` names it (a banner), else not (on its own line). */
export function limitProblemText(p: PurchaseLimitProblem, t: BuyText, withName = true): string {
  const name = withName ? purchaseLimitProductName(p) : "";
  if (p.maxPerCustomer !== undefined) return p.left ? t.limitLeft(p.left, name) : t.limitDone(name);
  if (p.min !== undefined) return t.limitMin(p.min, name);
  if (p.max !== undefined) return t.limitMax(p.max, name);
  return t.limitDone(name);
}

/** The page's language: the one asked for, else <html lang> (set from the store's), else Arabic. */
function shopLocale(locale?: Locale): Locale {
  if (locale) return locale;
  if (typeof document !== "undefined") return parseLocale(document.documentElement.lang) ?? "ar";
  return "ar";
}

/**
 * A PURCHASE_LIMIT refusal (cart or checkout) in the shopper's words, every
 * refused product named — the API's message is English only. null for any
 * other error.
 */
export function purchaseLimitMessage(err: unknown, locale?: Locale): string | null {
  const problems = purchaseLimitProblems(err);
  if (problems.length === 0) return null;
  const t = getDictionary(shopLocale(locale)).buyInfo;
  return problems.map((p) => limitProblemText(p, t)).join(" · ");
}

/** The cart's add / change: a limit refusal is re-thrown in the shopper's words (its callers show `err.message`). */
export function rethrowCartLimit(err: unknown): never {
  const text = purchaseLimitMessage(err);
  throw text ? new Error(text) : err;
}
