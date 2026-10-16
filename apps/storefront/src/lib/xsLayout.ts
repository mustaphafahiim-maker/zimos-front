import type { Device } from "./deviceValue";
import { XS_STRIP_LINKS } from "./xsShell";

/**
 * Where everything in an imported template's header and footer stands — the
 * merchant's arrangement over the template's own (themeSettings.header.zones,
 * footer.columns, footer.bottom), edited in the website editor's Header and
 * Footer panels and by dragging the parts on the page.
 *
 * The header's zones are the template's own boxes, so its look's rules still
 * place and draw them:
 *
 *   strip   notice · links
 *   bar     brand (beside the menu) · menu · icons
 *
 * A part is one thing in a zone: the logo, the menu, the search, the account
 * link, the wish list, the cart, the phone menu's button, the announcement,
 * a link or a word of the merchant's, the social accounts, order tracking or
 * the language switch. A header with no arrangement of its own gets the
 * template's (defaultHeaderZones), which draws exactly what the template
 * always drew. The arrangement may differ by screen ({ base, tablet, mobile },
 * lib/deviceValue).
 *
 * The footer is an ordered row of columns — the link groups, the pages and
 * policies, the brand, contact details, a newsletter sign-up, social accounts,
 * payment methods — each with an optional width and alignment, and a bottom
 * row of parts (the rights line, "powered by", words of the merchant's). The
 * template's licence credit is not a part: it is always drawn.
 */

export const HEADER_ZONES = ["notice", "links", "brand", "menu", "icons"] as const;
export type HeaderZone = (typeof HEADER_ZONES)[number];

export const HEADER_PART_TYPES = ["logo", "menu", "search", "account", "wishlist", "cart", "phone", "notice", "link", "text", "social", "track", "language"] as const;
export type HeaderPartType = (typeof HEADER_PART_TYPES)[number];

/** The parts there is at most one of; a link or a word may be added many times. */
export const SINGLE_PARTS: ReadonlySet<HeaderPartType> = new Set(HEADER_PART_TYPES.filter((type) => type !== "link" && type !== "text"));

export interface HeaderPart {
  id: string;
  type: HeaderPartType;
  /** A link's or a word's text. */
  label?: string;
  /** A link's address. */
  href?: string;
}

export type HeaderZones = Record<HeaderZone, HeaderPart[]>;

const MAX_PARTS = 16;
const MAX_LABEL = 80;
const SAFE_ID = /^[A-Za-z0-9_-]{1,40}$/;

type Blob = Record<string, unknown>;
const objectOf = (value: unknown): Blob | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Blob) : null);

/** An address a part may link to: a path on the store, an anchor, or http(s) / mailto / tel. */
function readHref(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!value || value.length > 500) return undefined;
  if (/^\/(?!\/)/.test(value) || value.startsWith("#") || /^(https?:|mailto:|tel:)/i.test(value)) return value;
  return undefined;
}

/** What the template's header holds and where, as it always drew it (the strip's links from lib/xsShell). */
export function defaultHeaderZones(look: string, show: { cart: boolean; track: boolean; language: boolean }): HeaderZones {
  const strip: HeaderPart[] = (XS_STRIP_LINKS[look] ?? []).map((item, i) =>
    item.social ? { id: "social", type: "social" } : item.href ? { id: `strip-${i}`, type: "link", label: item.label, href: item.href } : { id: `strip-${i}`, type: "text", label: item.label }
  );
  return {
    notice: [{ id: "notice", type: "notice" }],
    links: [...strip, ...(show.track ? [{ id: "track", type: "track" as const }] : []), ...(show.language ? [{ id: "language", type: "language" as const }] : [])],
    brand: [{ id: "logo", type: "logo" }],
    menu: [{ id: "menu", type: "menu" }],
    icons: [
      { id: "search", type: "search" },
      { id: "account", type: "account" },
      { id: "wishlist", type: "wishlist" },
      ...(show.cart ? [{ id: "cart", type: "cart" as const }] : []),
      { id: "phone", type: "phone" },
    ],
  };
}

/**
 * One screen's saved zones, every part checked: a known type, an id of its
 * own, words and addresses within bounds, one of each single part. The phone
 * menu's button is kept whatever was saved — without it a phone has no menu —
 * at the end of the icons. Null when nothing usable was saved.
 */
export function readHeaderZones(raw: unknown): HeaderZones | null {
  const saved = objectOf(raw);
  if (!saved) return null;
  const zones = {} as HeaderZones;
  const seen = new Set<string>();
  let any = false;
  for (const zone of HEADER_ZONES) {
    zones[zone] = [];
    const list = Array.isArray(saved[zone]) ? (saved[zone] as unknown[]) : [];
    if (Array.isArray(saved[zone])) any = true;
    for (const item of list.slice(0, MAX_PARTS)) {
      const part = objectOf(item);
      const type = part?.type as HeaderPartType;
      const id = typeof part?.id === "string" ? part.id : "";
      if (!part || !HEADER_PART_TYPES.includes(type) || !SAFE_ID.test(id) || seen.has(id)) continue;
      if (SINGLE_PARTS.has(type) && seen.has(`type:${type}`)) continue;
      const read: HeaderPart = { id, type };
      if (type === "link" || type === "text") {
        const label = typeof part.label === "string" ? part.label.trim().slice(0, MAX_LABEL) : "";
        if (!label) continue;
        read.label = label;
        if (type === "link") {
          const href = readHref(part.href);
          if (!href) continue;
          read.href = href;
        }
      }
      seen.add(id);
      seen.add(`type:${type}`);
      zones[zone].push(read);
    }
  }
  if (!any) return null;
  if (!seen.has("type:phone")) zones.icons.push({ id: "phone", type: "phone" });
  return zones;
}

/**
 * The zones each screen shows: a computer's (base), a tablet's (its own or a
 * computer's), a phone's (its own or a tablet's). `saved` is one arrangement
 * or one per screen; the template's when none.
 */
export function headerZonesByDevice(saved: unknown, fallback: HeaderZones): Record<Device, HeaderZones> {
  const perScreen = objectOf(saved);
  const isSplit = perScreen && ["base", "tablet", "mobile"].some((device) => device in perScreen) && !HEADER_ZONES.some((zone) => zone in perScreen);
  const base = (isSplit ? readHeaderZones(perScreen.base) : readHeaderZones(saved)) ?? fallback;
  const tablet = (isSplit ? readHeaderZones(perScreen.tablet) : null) ?? base;
  const mobile = (isSplit ? readHeaderZones(perScreen.mobile) : null) ?? tablet;
  return { base, tablet, mobile };
}

/**
 * The words a template wrote where a language switch would stand, as a plain
 * word that does nothing — XS 01's "EN", which its Arabic copy says as
 * "العربية". Saved stores keep them in `header.zones`; the templates in the
 * console carry them too.
 */
const LANGUAGE_WORDS = new Set(["en", "english", "العربية", "عربي"]);

export function isLanguageWord(part: HeaderPart): boolean {
  return part.type === "text" && LANGUAGE_WORDS.has((part.label ?? "").trim().toLowerCase());
}

/**
 * The zones with the store's language button as the merchant set it
 * (themeSettings.shopperDisplay.localeSwitch, lib/shopperDisplay):
 *
 *   on    a template's language word becomes the real switch, in its place; a
 *         screen with neither that nor a switch of the merchant's gets one at
 *         the end of the strip's links (on a phone the strip is hidden and the
 *         phone menu shows it)
 *   off   the language word is left out, so no word that looks like a button
 *         stays; a switch the merchant added in the editor stays, as before
 */
export function withLanguageSwitch(byDevice: Record<Device, HeaderZones>, on: boolean): Record<Device, HeaderZones> {
  const out = {} as Record<Device, HeaderZones>;
  for (const device of ["base", "tablet", "mobile"] as const) {
    const zones = byDevice[device];
    const parts = HEADER_ZONES.flatMap((zone) => zones[zone]);
    // One switch a screen: the merchant's own wins over the template's word.
    const ownSwitch = parts.some((part) => part.type === "language");
    let placed = ownSwitch;
    const next = {} as HeaderZones;
    for (const zone of HEADER_ZONES) {
      next[zone] = zones[zone].flatMap((part): HeaderPart[] => {
        if (!isLanguageWord(part)) return [part];
        if (!on || placed) return [];
        placed = true;
        return [{ id: part.id, type: "language" }];
      });
    }
    if (on && !placed) next.links = [...next.links, { id: "language", type: "language" }];
    out[device] = next;
  }
  return out;
}

/**
 * A zone's parts as drawn: one list when every screen shows the same, else
 * one list per group of screens that agree (each shown only on its screens).
 */
export function zoneGroups(byDevice: Record<Device, HeaderZones>, zone: HeaderZone): Array<{ devices: Device[] | null; parts: HeaderPart[] }> {
  const groups: Array<{ key: string; devices: Device[]; parts: HeaderPart[] }> = [];
  for (const device of ["base", "tablet", "mobile"] as const) {
    const parts = byDevice[device][zone];
    const key = JSON.stringify(parts);
    const same = groups.find((group) => group.key === key);
    if (same) same.devices.push(device);
    else groups.push({ key, devices: [device], parts });
  }
  return groups.length === 1 ? [{ devices: null, parts: groups[0].parts }] : groups.map(({ devices, parts }) => ({ devices, parts }));
}

// --- the footer ------------------------------------------------------------------

export const FOOTER_COLUMN_TYPES = ["group", "pages", "brand", "contact", "newsletter", "social", "payments"] as const;
export type FooterColumnType = (typeof FOOTER_COLUMN_TYPES)[number];

export interface FooterColumn {
  id: string;
  type: FooterColumnType;
  /** A link group's place in footer.groups. */
  at?: number;
  /** A heading of its own (contact, newsletter, social, payments). */
  title?: string;
  /** A line under the heading (newsletter); the payment methods' names, one per line (payments). */
  text?: string;
  /** Its share of the row, in parts (1–4), per screen. */
  width?: unknown;
  align?: "start" | "center" | "end";
  /** The screens it is left off. */
  hide?: Device[];
}

export const FOOTER_BOTTOM_TYPES = ["rights", "powered", "text"] as const;
export type FooterBottomType = (typeof FOOTER_BOTTOM_TYPES)[number];
export interface FooterBottomPart {
  id: string;
  type: FooterBottomType;
  label?: string;
}

/** The template's footer as it always drew it: the link groups, the pages and policies, then the brand. */
export function defaultFooterColumns(groups: number, showBrand: boolean): FooterColumn[] {
  return [
    ...Array.from({ length: groups }, (_, at): FooterColumn => ({ id: `group-${at}`, type: "group", at })),
    { id: "pages", type: "pages" },
    ...(showBrand ? [{ id: "brand", type: "brand" as const }] : []),
  ];
}

export const DEFAULT_FOOTER_BOTTOM: FooterBottomPart[] = [
  { id: "rights", type: "rights" },
  { id: "powered", type: "powered" },
];

/** The saved columns, each checked; null when none were saved. */
export function readFooterColumns(raw: unknown): FooterColumn[] | null {
  if (!Array.isArray(raw)) return null;
  const out: FooterColumn[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, 12)) {
    const column = objectOf(item);
    const type = column?.type as FooterColumnType;
    const id = typeof column?.id === "string" ? column.id : "";
    if (!column || !FOOTER_COLUMN_TYPES.includes(type) || !SAFE_ID.test(id) || seen.has(id)) continue;
    const read: FooterColumn = { id, type };
    if (type === "group") {
      if (typeof column.at !== "number" || !Number.isInteger(column.at) || column.at < 0 || column.at > 11) continue;
      read.at = column.at;
    }
    if (typeof column.title === "string" && column.title.trim()) read.title = column.title.trim().slice(0, MAX_LABEL);
    if (typeof column.text === "string" && column.text.trim()) read.text = column.text.trim().slice(0, 600);
    if (column.width !== undefined) read.width = column.width;
    if (column.align === "start" || column.align === "center" || column.align === "end") read.align = column.align;
    if (Array.isArray(column.hide)) {
      const hide = (["base", "tablet", "mobile"] as const).filter((device) => (column.hide as unknown[]).includes(device));
      if (hide.length > 0) read.hide = hide;
    }
    seen.add(id);
    out.push(read);
  }
  return out;
}

/** The saved bottom row, each part checked; null when none was saved. */
export function readFooterBottom(raw: unknown): FooterBottomPart[] | null {
  if (!Array.isArray(raw)) return null;
  const out: FooterBottomPart[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, 8)) {
    const part = objectOf(item);
    const type = part?.type as FooterBottomType;
    const id = typeof part?.id === "string" ? part.id : "";
    if (!part || !FOOTER_BOTTOM_TYPES.includes(type) || !SAFE_ID.test(id) || seen.has(id)) continue;
    const read: FooterBottomPart = { id, type };
    if (type === "text") {
      const label = typeof part.label === "string" ? part.label.trim().slice(0, 200) : "";
      if (!label) continue;
      read.label = label;
    }
    seen.add(id);
    out.push(read);
  }
  return out;
}
