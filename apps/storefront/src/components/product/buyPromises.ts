import type { Locale } from "@/lib/i18n";
import { cardTitle, type StoreCard } from "@/lib/storePromises";

/**
 * The store's own promises (lib/storePromises: its shipping, returns and
 * cash-on-delivery cards), cut down to what fits on one short line each — the
 * card's title and its first point — for the trust lines beside the product
 * page's buy buttons (BuyAssurances). Worked out on the server by the page,
 * which holds the whole store; nothing here is the platform's wording.
 */

/** One card as a line: its title, and the first point the store wrote under it. */
export interface PromiseLine {
  title: string;
  point: string | null;
}

export interface BuyPromises {
  cod: PromiseLine | null;
  returns: PromiseLine | null;
  shipping: PromiseLine | null;
}

export function buyPromises(cards: StoreCard[], locale: Locale): BuyPromises {
  const line = (key: StoreCard["key"]): PromiseLine | null => {
    const card = cards.find((c) => c.key === key);
    if (!card) return null;
    const point = card.points.find((p) => p.trim())?.trim() ?? null;
    return { title: cardTitle(card, locale), point };
  };
  return { cod: line("cod_policy"), returns: line("return_policy"), shipping: line("shipping_policy") };
}
