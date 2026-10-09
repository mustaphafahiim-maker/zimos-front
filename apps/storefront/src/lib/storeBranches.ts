import { storefrontHasBranches, type StoreLocatorTexts } from "@store-builder/api-client";
import { intlLocaleFor, pickText, type Dictionary, type Locale } from "./i18n";
import type { ResolvedShellLink } from "./storeShell";

/**
 * The store locator on the storefront (frontend-handoff 233): the words of
 * the «فروعنا» page, and the footer's link to it. No imports from
 * next/headers, so the page, its client list and both footers can use it;
 * the server's own reader is lib/storeBranchesServer.
 */

const km = (value: number, locale: Locale) => new Intl.NumberFormat(intlLocaleFor(locale), { maximumFractionDigits: 1 }).format(value);

const COPY = {
  en: {
    title: "Our stores",
    intro: "Visit us at the branch nearest to you.",
    nearest: "Nearest to me",
    locating: "Finding your location…",
    nearestBadge: "Nearest to you",
    sorted: "Sorted from the nearest to the farthest.",
    noLocation: "We couldn't get your location, so the branches are listed as they are.",
    distance: (value: number) => `${km(value, "en")} km away`,
    pickup: "Pickup available",
    hours: "Opening hours",
    call: "Call",
    whatsapp: "WhatsApp",
    directions: "Directions",
    callBranch: (name: string) => `Call ${name}`,
    whatsappBranch: (name: string) => `WhatsApp ${name}`,
    directionsTo: (name: string) => `Directions to ${name}`,
    empty: "No branches to show right now.",
  },
  ar: {
    title: "فروعنا",
    intro: "زورنا في أقرب فرع ليك.",
    nearest: "أقرب فرع ليا",
    locating: "بنحدد مكانك…",
    nearestBadge: "الأقرب ليك",
    sorted: "مرتّبة من الأقرب للأبعد.",
    noLocation: "مقدرناش نعرف مكانك، فالفروع معروضة زي ما هي.",
    distance: (value: number) => `على بعد ${km(value, "ar")} كم`,
    pickup: "استلام من الفرع",
    hours: "مواعيد العمل",
    call: "اتصل",
    whatsapp: "واتساب",
    directions: "الاتجاهات",
    callBranch: (name: string) => `اتصل بفرع ${name}`,
    whatsappBranch: (name: string) => `واتساب فرع ${name}`,
    directionsTo: (name: string) => `الاتجاهات لفرع ${name}`,
    empty: "مفيش فروع معروضة دلوقتي.",
  },
  fr: {
    title: "Nos magasins",
    intro: "Rendez-nous visite dans le magasin le plus proche de chez vous.",
    nearest: "Le plus proche de moi",
    locating: "Recherche de votre position…",
    nearestBadge: "Le plus proche",
    sorted: "Classés du plus proche au plus éloigné.",
    noLocation: "Nous n'avons pas pu obtenir votre position : les magasins restent affichés tels quels.",
    distance: (value: number) => `à ${km(value, "fr")} km`,
    pickup: "Retrait en magasin",
    hours: "Horaires d'ouverture",
    call: "Appeler",
    whatsapp: "WhatsApp",
    directions: "Itinéraire",
    callBranch: (name: string) => `Appeler ${name}`,
    whatsappBranch: (name: string) => `WhatsApp ${name}`,
    directionsTo: (name: string) => `Itinéraire vers ${name}`,
    empty: "Aucun magasin à afficher pour le moment.",
  },
};

export type BranchCopy = (typeof COPY)["en"];

export function branchCopy(locale: Locale): BranchCopy {
  return pickText(COPY, locale);
}

/**
 * A branch's hours or note in the page's language: the store writes them in
 * Arabic and English, so each stands in for the other when one is empty, and
 * French reads the English one first.
 */
export function branchText(texts: StoreLocatorTexts | null | undefined, locale: Locale): string | null {
  const ar = texts?.ar?.trim() ?? "";
  const en = texts?.en?.trim() ?? "";
  return (locale === "ar" ? ar || en : en || ar) || null;
}

/** The store as the footer gets it, saying whether its branches page is on (the API's own metadata does not, yet). */
export function withStoreLocator<T extends object>(store: T, enabled: boolean): T {
  return enabled && !storefrontHasBranches(store) ? { ...store, storeLocator: { enabled: true } } : store;
}

/**
 * The footer's link columns with «فروعنا» among them, when the store shows
 * its branches: in the pages column — the first of `pageAndPolicyGroups` when
 * the store has footer pages — or in a pages column of its own before the
 * policies. Both footer layouts wrap their columns in this.
 */
export function withBranchesLink(
  groups: Array<{ title: string; links: ResolvedShellLink[] }>,
  store: unknown,
  t: Dictionary,
  locale: Locale
): Array<{ title: string; links: ResolvedShellLink[] }> {
  if (!storefrontHasBranches(store)) return groups;
  const link: ResolvedShellLink = { key: "page:/branches", label: branchCopy(locale).title, href: "/branches", external: false };
  const [first, ...rest] = groups;
  if (first && first.title === t.footer.pages) return [{ ...first, links: [...first.links, link] }, ...rest];
  return [{ title: t.footer.pages, links: [link] }, ...groups];
}
