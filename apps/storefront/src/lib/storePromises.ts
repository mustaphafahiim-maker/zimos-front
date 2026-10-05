import { storefrontDesignMeta, type StorefrontStoreInfo } from "@store-builder/api-client";
import type { Locale } from "./i18n";

/**
 * What the store promises about shipping, returns and cash on delivery, in its
 * own words (SPEC §8.5; backend storefront/storeInfo.js: settings →
 * store info, three cards of a title and points). The trust strip, the
 * product page's "Shipping & returns" tab and FAQ, and the footer's help
 * column read these, never a promise the platform made up for the store
 * ("fast delivery", "easy returns", "2–5 days"). A store that has not written
 * them simply shows none.
 */

export type StoreCard = StorefrontStoreInfo["cards"][number];

export function storeCards(store: unknown): StoreCard[] {
  return storefrontDesignMeta(store).storeInfo?.cards ?? [];
}

const LABELS: Record<"en" | "ar" | "fr", Record<StoreCard["key"], string>> = {
  en: { shipping_policy: "Shipping", return_policy: "Returns", cod_policy: "Cash on delivery" },
  ar: { shipping_policy: "الشحن", return_policy: "الاسترجاع", cod_policy: "الدفع عند الاستلام" },
  fr: { shipping_policy: "Livraison", return_policy: "Retours", cod_policy: "Paiement à la livraison" },
};

/** The card's own title, or what kind of policy it is when the merchant gave it none. */
export function cardTitle(card: StoreCard, locale: Locale): string {
  return card.title || (LABELS[locale as "en" | "ar" | "fr"] ?? LABELS.en)[card.key];
}

const byKey = (cards: StoreCard[], key: StoreCard["key"]) => cards.find((c) => c.key === key && c.points.length > 0);

/**
 * The store-wide questions, answered from the cards: how to pay, when it
 * arrives, returns. `questions` are the dictionary's wording; a question the
 * store has no card for is left out.
 */
export function faqFromCards(cards: StoreCard[], questions: { pay: string; arrive: string; returns: string }) {
  const rows: Array<{ q: string; a: string }> = [];
  const cod = byKey(cards, "cod_policy");
  const shipping = byKey(cards, "shipping_policy");
  const returns = byKey(cards, "return_policy");
  if (cod) rows.push({ q: questions.pay, a: cod.points.join("\n") });
  if (shipping) rows.push({ q: questions.arrive, a: shipping.points.join("\n") });
  if (returns) rows.push({ q: questions.returns, a: returns.points.join("\n") });
  return rows;
}

/** The "Shipping & returns" tab: the shipping and returns cards. */
export function shippingRows(cards: StoreCard[], locale: Locale) {
  return cards
    .filter((c) => c.key === "shipping_policy" || c.key === "return_policy")
    .map((c) => ({ title: cardTitle(c, locale), points: c.points }));
}
