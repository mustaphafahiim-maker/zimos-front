/**
 * The store's header and footer as the website editor's Header and Footer
 * panels edit them. Store-wide, not per page: they are saved into the
 * workspace's `themeSettings` beside the colours and the announcement bar, by
 * the same Save as the Store look (storeLook.ts's `lookToWorkspacePatch`).
 *
 * The storefront reads every key here in apps/storefront/src/lib/storeShell.ts
 * — the two apps share no code, so the saved shape is spelled out in both:
 *
 *   header: { announcement, menu?: [{ label, href, kind, …kept }], logo?: { size?, align? },
 *             show?: { cart?, language?, theme?, trackOrder? }, sticky?, layout?: "side" }
 *   footer: { groups?: [{ title, links }], text?, show?: { brand?, links?, help? } }
 *
 * A menu link or footer group may carry keys the panels do not edit: a
 * template's dropdown is `menu[i].children`, read by the storefront's
 * NavDropdown. They are read into `extra` and written back as they were, so
 * editing the header never drops them. The same holds for a key inside `logo`
 * or `show` that these panels have no field for.
 *
 * Only a value that differs from the default is ever written, and every
 * default is the header/footer every store already had — so a merchant who
 * never opens these panels saves exactly the blob they had before.
 */

import type { ScreenDevice } from "@/lib/canvasDrag";
import { deviceParts, withDeviceValue, type DeviceValue } from "@/lib/deviceValue";
import type { ShellPart } from "@/lib/previewBridge";

export type { ShellPart };

/** A fixed part's name, in the editor's language. */
export function shellPartLabel(
  part: ShellPart,
  ui: { shellHeader: string; shellFooter: string; announcementBar: string }
): string {
  return part === "header" ? ui.shellHeader : part === "footer" ? ui.shellFooter : ui.announcementBar;
}

/** What a link points at. Only the editor needs this; the storefront reads `href`. */
export type LinkKind = "home" | "cart" | "track" | "page" | "product" | "collection" | "url";
export const LINK_KINDS: LinkKind[] = ["home", "cart", "track", "page", "product", "collection", "url"];

export interface ShellLink {
  /** Local only — keys the sortable list; never saved. */
  id: string;
  kind: LinkKind;
  /** Empty on a built-in page: the storefront names it in the shopper's language. */
  label: string;
  href: string;
  /**
   * Whatever else the saved link carried that these panels do not edit: a
   * template's dropdown (`children`, read by the storefront's NavDropdown), or
   * any key written by hand. Never shown as a field; written back untouched so
   * a save round-trips it.
   */
  extra?: Record<string, unknown>;
}

/** How many links a saved link's dropdown holds (0 when it has none). */
export function submenuCount(link: ShellLink): number {
  const children = link.extra?.children;
  return Array.isArray(children) ? children.length : 0;
}

export type LogoSize = "sm" | "md" | "lg";
export type LogoAlign = "start" | "center";
/**
 * Where the store's navigation sits on a wide screen: the bar across the top
 * every store has, or a column beside the page. Saved as `header.layout`, and
 * only when it is "side".
 */
export type NavLayout = "top" | "side";

export interface HeaderLook {
  /** The merchant's own menu, or null for the built-in links. */
  menu: ShellLink[] | null;
  logoSize: LogoSize;
  logoAlign: LogoAlign;
  /** A logo picture for an imported template's header (`logo.image`); empty shows the store's logo, else the template's. */
  logoImage?: string;
  /** The store's name in the template's lettering instead of any logo picture (`logo.name`). */
  logoAsName?: boolean;
  /** Where each part of an imported template's header stands (xsShellLayout.ts), as saved; absent: the template's. */
  zones?: unknown;
  showCart: boolean;
  showLanguage: boolean;
  showTheme: boolean;
  showTrackOrder: boolean;
  sticky: boolean;
  layout: NavLayout;
  /**
   * The bar's own colours, honoured by an imported template's header
   * (storefront components/xs): background, text, stripBackground, stripText.
   * A key is present only while its colour is chosen.
   */
  colors?: Record<string, string>;
  /** Its own sizes in pixels, honoured the same way (HEADER_SIZES / FOOTER_SIZES), each one value or one per screen (lib/deviceValue); a key is present only while set. */
  sizes?: ShellSizes;
}

export interface FooterGroupLook {
  id: string;
  title: string;
  links: ShellLink[];
  /** Saved keys of the group these panels do not edit; written back untouched (see ShellLink.extra). */
  extra?: Record<string, unknown>;
}

export interface FooterLook {
  /** The merchant's own link groups, or null for the built-in one. */
  groups: FooterGroupLook[] | null;
  /** Under the store name; empty shows the store's tagline. */
  text: string;
  showBrand: boolean;
  showLinks: boolean;
  showHelp: boolean;
  /** A logo picture for an imported template's footer (`logo.image`); empty shows the template's, else the name. */
  logoImage?: string;
  /** The store's name in the template's lettering instead of any logo picture (`logo.name`). */
  logoAsName?: boolean;
  /** An imported template's footer columns and bottom line (xsShellLayout.ts), as saved; absent: the template's. */
  columns?: unknown;
  bottom?: unknown;
  /** The footer's own colours, honoured by an imported template's footer: background, text, heading. */
  colors?: Record<string, string>;
  /** Its own sizes in pixels, honoured the same way (HEADER_SIZES / FOOTER_SIZES), each one value or one per screen (lib/deviceValue); a key is present only while set. */
  sizes?: ShellSizes;
}

/**
 * Caps that keep the whole `themeSettings` blob under the API's ~5KB limit
 * (see THEME_SETTINGS_MAX_CHARS) with room to spare for everything else in it.
 */
export const MAX_MENU_LINKS = 8;
export const MAX_FOOTER_GROUPS = 3;
export const MAX_GROUP_LINKS = 6;
export const LINK_LABEL_MAX = 40;
export const LINK_HREF_MAX = 300;
export const FOOTER_TEXT_MAX = 300;

/**
 * The API refuses a `themeSettings` whose JSON is longer than this
 * (Backend workspaceService.updateWorkspace). Checked before saving so the
 * merchant gets a clear message rather than a generic 422.
 */
export const THEME_SETTINGS_MAX_CHARS = 5000;

export const DEFAULT_HEADER_LOOK: HeaderLook = {
  menu: null,
  logoSize: "md",
  logoAlign: "start",
  showCart: true,
  showLanguage: true,
  showTheme: true,
  showTrackOrder: true,
  sticky: true,
  layout: "top",
};

export const DEFAULT_FOOTER_LOOK: FooterLook = {
  groups: null,
  text: "",
  showBrand: true,
  showLinks: true,
  showHelp: true,
};

type Blob = Record<string, unknown>;

function objectOf(value: unknown): Blob | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Blob) : null;
}

/** A saved object without the keys the panels own: what has to travel back untouched. */
function restOf(saved: Blob | null, owned: readonly string[]): Blob {
  if (!saved) return {};
  return Object.fromEntries(Object.entries(saved).filter(([key]) => !owned.includes(key)));
}

const LINK_KEYS = ["label", "href", "kind"] as const;
const GROUP_KEYS = ["title", "links"] as const;
const LOGO_KEYS = ["size", "align", "image", "name"] as const;
const HEADER_SHOW_KEYS = ["cart", "language", "theme", "trackOrder"] as const;
const FOOTER_SHOW_KEYS = ["brand", "links", "help"] as const;

let nextId = 0;
/** A fresh local id for a link or group row. */
export function shellId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}-${Math.random().toString(36).slice(2, 7)}`;
}

/** The fixed address of a built-in page, or null for the kinds that take one. */
export function builtinHref(kind: LinkKind): string | null {
  switch (kind) {
    case "home":
      return "/";
    case "cart":
      return "/cart";
    case "track":
      return "/track";
    default:
      return null;
  }
}

/** The address a product or collection link is written with — the storefront's own routes. */
export function productHref(slugOrId: string): string {
  return `/products/${encodeURIComponent(slugOrId)}`;
}

export function collectionHref(collectionId: string): string {
  return `/?collection=${encodeURIComponent(collectionId)}#products`;
}

/** What a saved link points at, for a link saved without a `kind` (hand-edited data). */
export function kindOfHref(href: string): LinkKind {
  const h = href.trim();
  if (h === "/" || h === "") return "home";
  if (h === "/cart") return "cart";
  if (h === "/track") return "track";
  if (h.startsWith("/products/")) return "product";
  if (h.includes("collection=")) return "collection";
  if (/^(https?:|mailto:|tel:)/i.test(h)) return "url";
  return "page";
}

export function newLink(kind: LinkKind = "home"): ShellLink {
  return { id: shellId("link"), kind, label: "", href: builtinHref(kind) ?? "" };
}

function readLinks(raw: unknown, max: number): ShellLink[] {
  if (!Array.isArray(raw)) return [];
  const links: ShellLink[] = [];
  for (const item of raw) {
    const o = objectOf(item);
    if (!o) continue;
    const href = typeof o.href === "string" ? o.href.trim().slice(0, LINK_HREF_MAX) : "";
    const label = typeof o.label === "string" ? o.label.slice(0, LINK_LABEL_MAX) : "";
    const kind =
      typeof o.kind === "string" && (LINK_KINDS as string[]).includes(o.kind) ? (o.kind as LinkKind) : kindOfHref(href);
    // Everything but the three keys the panels own is kept as it was saved.
    const rest = restOf(o, LINK_KEYS);
    const link: ShellLink = { id: shellId("link"), kind, label, href };
    if (Object.keys(rest).length > 0) link.extra = rest;
    links.push(link);
    if (links.length >= max) break;
  }
  return links;
}

function readShow(show: Blob | null, key: string): boolean {
  return show?.[key] !== false;
}

export const HEADER_COLOR_KEYS = ["background", "text", "stripBackground", "stripText"] as const;
export const FOOTER_COLOR_KEYS = ["background", "text", "heading"] as const;

/** The sizes a template's header and footer take from the editor, each with its least and most in pixels. */
export const HEADER_SIZES: Record<string, readonly [number, number]> = { logo: [20, 140], bar: [48, 160], menu: [11, 26], strip: [10, 20] };
export const FOOTER_SIZES: Record<string, readonly [number, number]> = { title: [12, 32], text: [11, 22], logo: [16, 200] };

/** A header's or footer's sizes: each one number for every screen, or one per screen. */
export type ShellSizes = Record<string, DeviceValue<number>>;

/** The whole numbers within range among a saved `sizes` object, per screen; undefined when none is set. */
function readSizes(raw: unknown, ranges: Record<string, readonly [number, number]>): ShellSizes | undefined {
  const saved = objectOf(raw);
  if (!saved) return undefined;
  const sizes: ShellSizes = {};
  for (const [key, [least, most]] of Object.entries(ranges)) {
    let value: unknown;
    for (const [device, part] of Object.entries(deviceParts(saved[key]))) {
      if (typeof part === "number" && Number.isInteger(part) && part >= least && part <= most) value = withDeviceValue(value, device as ScreenDevice, part);
    }
    if (value !== undefined) sizes[key] = value as DeviceValue<number>;
  }
  return Object.keys(sizes).length > 0 ? sizes : undefined;
}

/** `sizes` as it is saved: the chosen ones over whatever else the saved object held; undefined when empty. */
function writeSizes(existing: unknown, ranges: Record<string, readonly [number, number]>, sizes: ShellSizes | undefined): Blob | undefined {
  const next: Blob = { ...restOf(objectOf(existing), Object.keys(ranges)), ...(sizes ?? {}) };
  return Object.keys(next).length > 0 ? next : undefined;
}

const sameSizes = (a: ShellSizes | undefined, b: ShellSizes | undefined) =>
  JSON.stringify(Object.entries(a ?? {}).sort()) === JSON.stringify(Object.entries(b ?? {}).sort());

/** One of a header's or footer's sizes on one screen set (null: back to the template's there). */
export function withShellSize(sizes: ShellSizes | undefined, key: string, device: ScreenDevice, px: number | null): ShellSizes | undefined {
  const next: ShellSizes = { ...(sizes ?? {}) };
  const value = withDeviceValue(next[key], device, px);
  if (value === undefined) delete next[key];
  else next[key] = value as DeviceValue<number>;
  return Object.keys(next).length > 0 ? next : undefined;
}

/** The #rrggbb values among `keys` of a saved `colors` object; undefined when none is set. */
function readColors(raw: unknown, keys: readonly string[]): Record<string, string> | undefined {
  const saved = objectOf(raw);
  if (!saved) return undefined;
  const colors: Record<string, string> = {};
  for (const key of keys) {
    const value = saved[key];
    if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) colors[key] = value.toLowerCase();
  }
  return Object.keys(colors).length > 0 ? colors : undefined;
}

/** `colors` as it is saved: the chosen ones over whatever else the saved object held; undefined when empty. */
function writeColors(existing: unknown, keys: readonly string[], colors: Record<string, string> | undefined): Blob | undefined {
  const next: Blob = { ...restOf(objectOf(existing), keys), ...(colors ?? {}) };
  return Object.keys(next).length > 0 ? next : undefined;
}

const sameColors = (a: Record<string, string> | undefined, b: Record<string, string> | undefined) =>
  JSON.stringify(Object.entries(a ?? {}).sort()) === JSON.stringify(Object.entries(b ?? {}).sort());

export function readHeaderLook(rawHeader: unknown): HeaderLook {
  const header = objectOf(rawHeader);
  if (!header) return DEFAULT_HEADER_LOOK;
  const logo = objectOf(header.logo);
  const show = objectOf(header.show);
  return {
    menu: Array.isArray(header.menu) ? readLinks(header.menu, MAX_MENU_LINKS) : null,
    logoSize: logo?.size === "sm" || logo?.size === "lg" ? logo.size : "md",
    logoAlign: logo?.align === "center" ? "center" : "start",
    ...(typeof logo?.image === "string" && logo.image.trim() ? { logoImage: logo.image.trim() } : {}),
    ...(logo?.name === true ? { logoAsName: true } : {}),
    ...(header.zones !== undefined ? { zones: header.zones } : {}),
    showCart: readShow(show, "cart"),
    showLanguage: readShow(show, "language"),
    showTheme: readShow(show, "theme"),
    showTrackOrder: readShow(show, "trackOrder"),
    sticky: header.sticky !== false,
    layout: header.layout === "side" ? "side" : "top",
    colors: readColors(header.colors, HEADER_COLOR_KEYS),
    sizes: readSizes(header.sizes, HEADER_SIZES),
  };
}

export function readFooterLook(rawFooter: unknown): FooterLook {
  const footer = objectOf(rawFooter);
  if (!footer) return DEFAULT_FOOTER_LOOK;
  const show = objectOf(footer.show);
  let groups: FooterGroupLook[] | null = null;
  if (Array.isArray(footer.groups)) {
    groups = [];
    for (const item of footer.groups) {
      const o = objectOf(item);
      if (!o) continue;
      const rest = restOf(o, GROUP_KEYS);
      const group: FooterGroupLook = {
        id: shellId("group"),
        title: typeof o.title === "string" ? o.title.slice(0, LINK_LABEL_MAX) : "",
        links: readLinks(o.links, MAX_GROUP_LINKS),
      };
      if (Object.keys(rest).length > 0) group.extra = rest;
      groups.push(group);
      if (groups.length >= MAX_FOOTER_GROUPS) break;
    }
  }
  return {
    groups,
    text: typeof footer.text === "string" ? footer.text.slice(0, FOOTER_TEXT_MAX) : "",
    showBrand: readShow(show, "brand"),
    showLinks: readShow(show, "links"),
    showHelp: readShow(show, "help"),
    ...(typeof objectOf(footer.logo)?.image === "string" && String(objectOf(footer.logo)?.image).trim()
      ? { logoImage: String(objectOf(footer.logo)?.image).trim() }
      : {}),
    ...(objectOf(footer.logo)?.name === true ? { logoAsName: true } : {}),
    ...(footer.columns !== undefined ? { columns: footer.columns } : {}),
    ...(footer.bottom !== undefined ? { bottom: footer.bottom } : {}),
    colors: readColors(footer.colors, FOOTER_COLOR_KEYS),
    sizes: readSizes(footer.sizes, FOOTER_SIZES),
  };
}

/**
 * A link as saved: no local id, trimmed, and dropped entirely when it points
 * nowhere. The keys the panels do not edit (`extra`: a dropdown's `children`)
 * go back exactly as they were read; label, href and kind always win over them.
 */
function saveLinks(links: ShellLink[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const link of links) {
    const href = (builtinHref(link.kind) ?? link.href).trim();
    if (!href) continue;
    const saved: Record<string, unknown> = { ...(link.extra ?? {}), label: link.label.trim(), href, kind: link.kind };
    out.push(saved);
  }
  return out;
}

/**
 * `show` with only the parts turned off (absent means shown), over whatever
 * else the saved `show` carried that these panels have no switch for.
 */
function showPatch(existing: unknown, owned: readonly string[], entries: Array<[string, boolean]>): Blob | null {
  const next: Blob = restOf(objectOf(existing), owned);
  for (const [key, on] of entries) if (!on) next[key] = false;
  return Object.keys(next).length === 0 ? null : next;
}

/**
 * The saved `header` object: whatever was there that these panels don't own,
 * the announcement bar, and only the header settings that differ from the
 * default.
 */
export function writeHeader(existing: unknown, header: HeaderLook, announcement: Blob): Blob {
  const before = objectOf(existing);
  const next: Blob = { ...(before ?? {}) };
  delete next.menu;
  delete next.logo;
  delete next.show;
  delete next.sticky;
  delete next.layout;
  delete next.colors;
  const headerColors = writeColors(before?.colors, HEADER_COLOR_KEYS, header.colors);
  if (headerColors) next.colors = headerColors;
  delete next.sizes;
  const headerSizes = writeSizes(before?.sizes, HEADER_SIZES, header.sizes);
  if (headerSizes) next.sizes = headerSizes;
  next.announcement = announcement;
  if (header.menu !== null) next.menu = saveLinks(header.menu);
  const logo: Blob = restOf(objectOf(before?.logo), LOGO_KEYS);
  if (header.logoSize !== "md") logo.size = header.logoSize;
  if (header.logoAlign !== "start") logo.align = header.logoAlign;
  if (header.logoImage) logo.image = header.logoImage;
  if (header.logoAsName) logo.name = true;
  if (Object.keys(logo).length > 0) next.logo = logo;
  delete next.zones;
  if (header.zones !== undefined) next.zones = header.zones;
  const show = showPatch(before?.show, HEADER_SHOW_KEYS, [
    ["cart", header.showCart],
    ["language", header.showLanguage],
    ["theme", header.showTheme],
    ["trackOrder", header.showTrackOrder],
  ]);
  if (show) next.show = show;
  if (!header.sticky) next.sticky = false;
  if (header.layout === "side") next.layout = "side";
  return next;
}

/**
 * The saved `footer` object, or undefined when there is nothing to save —
 * a store that never touched its footer keeps no `footer` key at all.
 */
export function writeFooter(existing: unknown, footer: FooterLook): Blob | undefined {
  const before = objectOf(existing);
  const next: Blob = { ...(before ?? {}) };
  delete next.groups;
  delete next.text;
  delete next.show;
  delete next.colors;
  const footerColors = writeColors(before?.colors, FOOTER_COLOR_KEYS, footer.colors);
  if (footerColors) next.colors = footerColors;
  delete next.sizes;
  const footerSizes = writeSizes(before?.sizes, FOOTER_SIZES, footer.sizes);
  if (footerSizes) next.sizes = footerSizes;
  const footerLogo: Blob = restOf(objectOf(before?.logo), ["image", "name"]);
  delete next.logo;
  if (footer.logoImage) footerLogo.image = footer.logoImage;
  if (footer.logoAsName) footerLogo.name = true;
  if (Object.keys(footerLogo).length > 0) next.logo = footerLogo;
  delete next.columns;
  delete next.bottom;
  if (footer.columns !== undefined) next.columns = footer.columns;
  if (footer.bottom !== undefined) next.bottom = footer.bottom;
  if (footer.groups !== null) {
    next.groups = footer.groups.map((group) => ({
      ...(group.extra ?? {}),
      title: group.title.trim(),
      links: saveLinks(group.links),
    }));
  }
  if (footer.text.trim()) next.text = footer.text.trim();
  const show = showPatch(before?.show, FOOTER_SHOW_KEYS, [
    ["brand", footer.showBrand],
    ["links", footer.showLinks],
    ["help", footer.showHelp],
  ]);
  if (show) next.show = show;
  return Object.keys(next).length > 0 ? next : undefined;
}

function sameLinks(a: ShellLink[] | null, b: ShellLink[] | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.length === b.length &&
    a.every(
      (link, i) =>
        link.kind === b[i].kind &&
        link.label === b[i].label &&
        link.href === b[i].href &&
        sameExtra(link.extra, b[i].extra)
    )
  );
}

/** The untouched keys travel by reference from read to write, so identity settles nearly every comparison. */
function sameExtra(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): boolean {
  if (a === b) return true;
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

export function sameHeader(a: HeaderLook, b: HeaderLook): boolean {
  return (
    JSON.stringify(a.zones ?? null) === JSON.stringify(b.zones ?? null) &&
    sameLinks(a.menu, b.menu) &&
    a.logoSize === b.logoSize &&
    a.logoAlign === b.logoAlign &&
    (a.logoImage ?? "") === (b.logoImage ?? "") &&
    Boolean(a.logoAsName) === Boolean(b.logoAsName) &&
    a.showCart === b.showCart &&
    a.showLanguage === b.showLanguage &&
    a.showTheme === b.showTheme &&
    a.showTrackOrder === b.showTrackOrder &&
    a.sticky === b.sticky &&
    a.layout === b.layout &&
    sameColors(a.colors, b.colors) &&
    sameSizes(a.sizes, b.sizes)
  );
}

export function sameFooter(a: FooterLook, b: FooterLook): boolean {
  const groupsSame =
    a.groups === null || b.groups === null
      ? a.groups === b.groups
      : a.groups.length === b.groups.length &&
        a.groups.every(
          (g, i) =>
            g.title === b.groups![i].title &&
            sameLinks(g.links, b.groups![i].links) &&
            sameExtra(g.extra, b.groups![i].extra)
        );
  const layoutSame = JSON.stringify([a.columns ?? null, a.bottom ?? null]) === JSON.stringify([b.columns ?? null, b.bottom ?? null]);
  return (
    layoutSame &&
    groupsSame &&
    a.text === b.text &&
    a.showBrand === b.showBrand &&
    a.showLinks === b.showLinks &&
    a.showHelp === b.showHelp &&
    (a.logoImage ?? "") === (b.logoImage ?? "") &&
    Boolean(a.logoAsName) === Boolean(b.logoAsName) &&
    sameColors(a.colors, b.colors) &&
    sameSizes(a.sizes, b.sizes)
  );
}

/**
 * The built-in footer group, as a starting point for a merchant who wants to
 * change it. `title` is the storefront's own heading for it ("Store" /
 * "المتجر") in the editor's language, so customising starts from what the
 * footer already shows.
 */
export function starterFooterGroups(title: string): FooterGroupLook[] {
  return [{ id: shellId("group"), title, links: [newLink("home"), newLink("cart"), newLink("track")] }];
}

/** The built-in header links, as a starting point for a merchant who wants to change them. */
export function starterMenu(): ShellLink[] {
  return [newLink("home")];
}
