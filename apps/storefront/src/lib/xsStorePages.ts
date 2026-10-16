import { xsShellOf } from "./xsShell";

/**
 * The store's own pages — the catalogue, a product, the cart, checkout — on a
 * store that wears an imported template, drawn the way that template draws
 * its shop: a page-title strip where it has one, the product's pictures
 * beside or under the big one, the tabs under it centred or not.
 *
 *   themeSettings.storePages = {
 *     strip:   "band" | "title" | "inline" | "none",   the page-title strip
 *     image:   "/xs/18/…" | "https://…",              the "title" strip's picture
 *     thumbs:  "side" | "below",                       a product's small pictures
 *     tabs:    "center" | "start",                     a product's tabs
 *     titles:  { catalog?, cart?, checkout? },         the strip's words, else the store's own
 *     related: "…",                                    the heading over similar products
 *   }
 *
 * Every key is optional; what is missing is the template's (STORE_PAGES,
 * from each original's shop and product pages under Themes/_extracted).
 * Only the look's CSS reads these, through the data attributes the pages put
 * on their <main>: nothing about buying or paying changes.
 */

export type XsStrip = "band" | "title" | "inline" | "none";

export interface XsStorePages {
  look: string;
  strip: XsStrip;
  image: string | null;
  thumbs: "side" | "below";
  tabs: "center" | "start";
  titles: { catalog?: string; cart?: string; checkout?: string };
  related: string | null;
}

type Template = Partial<Pick<XsStorePages, "strip" | "thumbs" | "tabs">> & { image?: string };

/**
 * Each template's own: "band" a tinted strip with the title and the trail
 * (Male Fashion, Electro…), "title" the look's picture band (its about and
 * contact pages' title, as the food and Famms templates head their sub-pages),
 * "inline" the trail alone over the page (Coza Store). `image` is the picture
 * band's, from the look's own about and contact pages.
 */
export const STORE_PAGES: Record<string, Template> = {
  "01": { strip: "inline", thumbs: "side", tabs: "center" },
  "02": { strip: "title" },
  "04": { thumbs: "side", tabs: "center" },
  "05": { thumbs: "side", tabs: "center" },
  "06": { tabs: "center" },
  "07": { strip: "title", image: "/xs/07/cart-page-header-img.jpg" },
  "08": { strip: "title", tabs: "center" },
  "14": { strip: "title" },
  "15": { thumbs: "side", tabs: "center" },
  "17": { strip: "title", image: "/xs/17/tasty.jpg" },
  "18": { strip: "title", image: "/xs/18/hero-bg.jpg" },
  "19": { strip: "title", image: "/xs/19/hero.jpg" },
  "20": { strip: "title", image: "/xs/20/bg-hero.jpg" },
};

const STRIPS: readonly XsStrip[] = ["band", "title", "inline", "none"];
const MAX_WORDS = 80;

const objectOf = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

function words(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().slice(0, MAX_WORDS);
  return text || undefined;
}

/** A picture's address the storefront serves: one of the template's, or an absolute https one. */
function picture(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const src = value.trim();
  return /^\/xs\/\d\d\/[\w./-]+$/.test(src) || /^https:\/\/[^\s"'()]+$/.test(src) ? src : null;
}

/** The store's pages as its template and its own settings have them; null for a store that wears no template. */
export function readXsStorePages(themeSettings: Record<string, unknown> | null | undefined): XsStorePages | null {
  const look = xsShellOf(themeSettings);
  if (!look) return null;
  const own = objectOf(themeSettings?.storePages) ?? {};
  const template = STORE_PAGES[look] ?? {};
  const titles = objectOf(own.titles) ?? {};
  return {
    look,
    strip: STRIPS.includes(own.strip as XsStrip) ? (own.strip as XsStrip) : (template.strip ?? "band"),
    image: picture(own.image) ?? template.image ?? null,
    thumbs: own.thumbs === "side" || own.thumbs === "below" ? own.thumbs : (template.thumbs ?? "below"),
    tabs: own.tabs === "center" || own.tabs === "start" ? own.tabs : (template.tabs ?? "start"),
    titles: {
      ...(words(titles.catalog) ? { catalog: words(titles.catalog) } : {}),
      ...(words(titles.cart) ? { cart: words(titles.cart) } : {}),
      ...(words(titles.checkout) ? { checkout: words(titles.checkout) } : {}),
    },
    related: words(own.related) ?? null,
  };
}

/** Whether the strip carries the page's title (then the page leaves out its own heading and trail). */
export function stripHoldsTitle(pages: XsStorePages | null | undefined): boolean {
  return pages?.strip === "band" || pages?.strip === "title";
}

/** The attributes a page's <main> carries for its look's CSS (xs-store.css). */
export function storePageAttrs(page: "product" | "catalog" | "cart" | "checkout", pages: XsStorePages | null | undefined): Record<string, string> {
  if (!pages) return { "data-page": page };
  return { "data-page": page, "data-xs-thumbs": pages.thumbs, "data-xs-tabs": pages.tabs, "data-xs-strip": pages.strip };
}
