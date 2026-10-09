import {
  IconCoins,
  IconFolder,
  IconImage,
  IconOffers,
  IconPage,
  IconProduct,
  IconSearch,
  IconSliders,
  type IconComponent,
} from "@/components/icons";
import type { Messages } from "@/i18n/LocaleContext";

/**
 * The eight groups of the product page, in the order they are read. The key is
 * also the group's element id — what the desktop index scrolls to, what a
 * `#pricing` link opens on a phone — and the tail of its `persistKey`
 * (`product:pricing`).
 */
export const GROUP_KEYS = ["basics", "media", "pricing", "options", "offers", "page", "seo", "collections"] as const;

export type GroupKey = (typeof GROUP_KEYS)[number];

export const GROUP_ICONS: Record<GroupKey, IconComponent> = {
  basics: IconProduct,
  media: IconImage,
  pricing: IconCoins,
  options: IconSliders,
  offers: IconOffers,
  page: IconPage,
  seo: IconSearch,
  collections: IconFolder,
};

export const GROUP_STRINGS = {
  en: {
    basics: "Basics",
    media: "Photos and video",
    pricing: "Price and stock",
    options: "Options",
    offers: "Offers",
    page: "Product page",
    seo: "Search engines",
    collections: "Collections",
    indexLabel: "Sections of this product",
    unsaved: "Has unsaved changes",
  },
  ar: {
    basics: "الأساسيات",
    media: "الصور والفيديو",
    pricing: "السعر والمخزون",
    options: "الخيارات",
    offers: "العروض",
    page: "صفحة المنتج",
    seo: "محركات البحث",
    collections: "المجموعات",
    indexLabel: "أقسام المنتج",
    unsaved: "فيه تغييرات لسه ما اتحفظتش",
  },
} satisfies Messages;

/** From Tailwind's `lg` up the page is two columns: the index, and every group open. */
export const DESKTOP_QUERY = "(min-width: 64rem)";

/**
 * Brings a group to the reader: on a phone it opens the folded section (the
 * accordion listens for its own `#id`), then the page scrolls to it. The
 * address keeps the `#id` without a new history entry, so Back still leaves
 * the product.
 */
export function revealGroup(group: GroupKey, options?: { scroll?: boolean }): void {
  try {
    // The router's own state rides in history.state: keep it.
    window.history.replaceState(window.history.state, "", `#${group}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } catch {
    /* an embedded view without history: the scroll below still happens */
  }
  if (options?.scroll === false) return;
  const calm = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // After the fold has opened, or the scroll would stop at the closed row.
  requestAnimationFrame(() => {
    document.getElementById(group)?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  });
}
