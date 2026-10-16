import type { Locale } from "@/lib/i18n";

/**
 * The shopper's words for a store on holiday (lib/holidayText.ts). Kept
 * beside the code that says them. Arabic is Egyptian, as the rest of the
 * store. Dates come in already formatted (lib/fulfilmentDates).
 */

const en = {
  holidayOn: "We're on holiday",
  holidayUntil: (date: string) => `We're on holiday until ${date}`,
  ordersPaused: "Orders are paused for now",
  pausedBody: "You can keep browsing and filling your cart. Ordering opens again when we're back.",
  pausedBodyUntil: (date: string) => `You can keep browsing and filling your cart. Ordering opens again on ${date}.`,
  shipsFrom: (date: string) => `Orders ship from ${date}`,
  shipsLater: "Orders ship once the holiday is over",
};

export type FulfilmentCopy = typeof en;

const ar: FulfilmentCopy = {
  holidayOn: "المتجر في إجازة",
  holidayUntil: (date) => `المتجر في إجازة لحد ${date}`,
  ordersPaused: "الطلبات موقوفة مؤقتًا",
  pausedBody: "تقدر تتصفح وتضيف للسلة عادي. الطلب هيتفتح تاني لما نرجع.",
  pausedBodyUntil: (date) => `تقدر تتصفح وتضيف للسلة عادي. الطلب هيتفتح تاني يوم ${date}.`,
  shipsFrom: (date) => `الطلبات هتتشحن من ${date}`,
  shipsLater: "الطلبات هتتشحن بعد الإجازة",
};

const fr: FulfilmentCopy = {
  holidayOn: "Nous sommes en congé",
  holidayUntil: (date) => `Nous sommes en congé jusqu'au ${date}`,
  ordersPaused: "Les commandes sont suspendues pour le moment",
  pausedBody: "Vous pouvez continuer à parcourir la boutique et remplir votre panier. Les commandes rouvriront à notre retour.",
  pausedBodyUntil: (date) => `Vous pouvez continuer à parcourir la boutique et remplir votre panier. Les commandes rouvriront le ${date}.`,
  shipsFrom: (date) => `Les commandes seront expédiées à partir du ${date}`,
  shipsLater: "Les commandes seront expédiées après le congé",
};

const COPY: Record<Locale, FulfilmentCopy> = { en, ar, fr };

export function fulfilmentCopy(locale: Locale): FulfilmentCopy {
  return COPY[locale] ?? en;
}
