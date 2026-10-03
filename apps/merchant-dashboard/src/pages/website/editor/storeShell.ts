/**
 * The store's header and footer as the website editor's Header and Footer
 * panels edit them. Store-wide, not per page: they are saved into the
 * workspace's `themeSettings` beside the colours and the announcement bar, by
 * the same Save as the Store look (storeLook.ts's `lookToWorkspacePatch`).
 *
 * The storefront reads every key here in apps/storefront/src/lib/storeShell.ts
 * — the two apps share no code, so the saved shape is spelled out in both:
 *
 *   header: { announcement, menu?, logo?: { size?, align? },
 *             show?: { cart?, language?, theme?, trackOrder? }, sticky? }
 *   footer: { groups?: [{ title, links }], text?, show?: { brand?, links?, help? } }
 *
 * Only a value that differs from the default is ever written, and every
 * default is the header/footer every store already had — so a merchant who
 * never opens these panels saves exactly the blob they had before.
 */

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
}

export type LogoSize = "sm" | "md" | "lg";
export type LogoAlign = "start" | "center";

export interface HeaderLook {
  /** The merchant's own menu, or null for the built-in links. */
  menu: ShellLink[] | null;
  logoSize: LogoSize;
  logoAlign: LogoAlign;
  showCart: boolean;
  showLanguage: boolean;
  showTheme: boolean;
  showTrackOrder: boolean;
  sticky: boolean;
}

export interface FooterGroupLook {
  id: string;
  title: string;
  links: ShellLink[];
}

export interface FooterLook {
  /** The merchant's own link groups, or null for the built-in one. */
  groups: FooterGroupLook[] | null;
  /** Under the store name; empty shows the store's tagline. */
  text: string;
  showBrand: boolean;
  showLinks: boolean;
  showHelp: boolean;
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
    links.push({ id: shellId("link"), kind, label, href });
    if (links.length >= max) break;
  }
  return links;
}

function readShow(show: Blob | null, key: string): boolean {
  return show?.[key] !== false;
}

export function readHeaderLook(rawHeader: unknown): HeaderLook {
  const header = objectOf(rawHeader);
  if (!header) return DEFAULT_HEADER_LOOK;
  const logo = objectOf(header.logo);
  const show = objectOf(header.show);
  return {
    menu: Array.isArray(header.menu) ? readLinks(header.menu, MAX_MENU_LINKS) : null,
    logoSize: logo?.size === "sm" || logo?.size === "lg" ? logo.size : "md",
    logoAlign: logo?.align === "center" ? "center" : "start",
    showCart: readShow(show, "cart"),
    showLanguage: readShow(show, "language"),
    showTheme: readShow(show, "theme"),
    showTrackOrder: readShow(show, "trackOrder"),
    sticky: header.sticky !== false,
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
      groups.push({
        id: shellId("group"),
        title: typeof o.title === "string" ? o.title.slice(0, LINK_LABEL_MAX) : "",
        links: readLinks(o.links, MAX_GROUP_LINKS),
      });
      if (groups.length >= MAX_FOOTER_GROUPS) break;
    }
  }
  return {
    groups,
    text: typeof footer.text === "string" ? footer.text.slice(0, FOOTER_TEXT_MAX) : "",
    showBrand: readShow(show, "brand"),
    showLinks: readShow(show, "links"),
    showHelp: readShow(show, "help"),
  };
}

/** A link as saved: no local id, trimmed, and dropped entirely when it points nowhere. */
function saveLinks(links: ShellLink[]): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = [];
  for (const link of links) {
    const href = (builtinHref(link.kind) ?? link.href).trim();
    if (!href) continue;
    const saved: Record<string, string> = { label: link.label.trim(), href, kind: link.kind };
    out.push(saved);
  }
  return out;
}

/** `show` with only the parts turned off — absent means shown. */
function showPatch(entries: Array<[string, boolean]>): Blob | null {
  const off = entries.filter(([, on]) => !on);
  return off.length === 0 ? null : Object.fromEntries(off.map(([key]) => [key, false]));
}

/**
 * The saved `header` object: whatever was there that these panels don't own,
 * the announcement bar, and only the header settings that differ from the
 * default.
 */
export function writeHeader(existing: unknown, header: HeaderLook, announcement: Blob): Blob {
  const next: Blob = { ...(objectOf(existing) ?? {}) };
  delete next.menu;
  delete next.logo;
  delete next.show;
  delete next.sticky;
  next.announcement = announcement;
  if (header.menu !== null) next.menu = saveLinks(header.menu);
  const logo: Blob = {};
  if (header.logoSize !== "md") logo.size = header.logoSize;
  if (header.logoAlign !== "start") logo.align = header.logoAlign;
  if (Object.keys(logo).length > 0) next.logo = logo;
  const show = showPatch([
    ["cart", header.showCart],
    ["language", header.showLanguage],
    ["theme", header.showTheme],
    ["trackOrder", header.showTrackOrder],
  ]);
  if (show) next.show = show;
  if (!header.sticky) next.sticky = false;
  return next;
}

/**
 * The saved `footer` object, or undefined when there is nothing to save —
 * a store that never touched its footer keeps no `footer` key at all.
 */
export function writeFooter(existing: unknown, footer: FooterLook): Blob | undefined {
  const next: Blob = { ...(objectOf(existing) ?? {}) };
  delete next.groups;
  delete next.text;
  delete next.show;
  if (footer.groups !== null) {
    next.groups = footer.groups.map((group) => ({ title: group.title.trim(), links: saveLinks(group.links) }));
  }
  if (footer.text.trim()) next.text = footer.text.trim();
  const show = showPatch([
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
    a.every((link, i) => link.kind === b[i].kind && link.label === b[i].label && link.href === b[i].href)
  );
}

export function sameHeader(a: HeaderLook, b: HeaderLook): boolean {
  return (
    sameLinks(a.menu, b.menu) &&
    a.logoSize === b.logoSize &&
    a.logoAlign === b.logoAlign &&
    a.showCart === b.showCart &&
    a.showLanguage === b.showLanguage &&
    a.showTheme === b.showTheme &&
    a.showTrackOrder === b.showTrackOrder &&
    a.sticky === b.sticky
  );
}

export function sameFooter(a: FooterLook, b: FooterLook): boolean {
  const groupsSame =
    a.groups === null || b.groups === null
      ? a.groups === b.groups
      : a.groups.length === b.groups.length &&
        a.groups.every((g, i) => g.title === b.groups![i].title && sameLinks(g.links, b.groups![i].links));
  return (
    groupsSame &&
    a.text === b.text &&
    a.showBrand === b.showBrand &&
    a.showLinks === b.showLinks &&
    a.showHelp === b.showHelp
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
