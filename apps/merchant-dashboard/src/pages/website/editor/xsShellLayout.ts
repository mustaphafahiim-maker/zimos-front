import type { ScreenDevice } from "@/lib/canvasDrag";
import { deviceParts, valueOnDevice } from "@/lib/deviceValue";

/**
 * Where everything in an imported template's header and footer stands — the
 * editor's half of storefront lib/xsLayout.ts, which draws it and holds the
 * same rules (zones, part types, one of each single part, the phone menu's
 * button always kept, the licence credit never a part).
 *
 *   themeSettings.header.zones     { notice, links, brand, menu, icons } of parts,
 *                                  or one such per screen { base, tablet, mobile }
 *   themeSettings.footer.columns   the footer's columns in order
 *   themeSettings.footer.bottom    the bottom line's parts in order
 *
 * A store that never arranged anything is drawn as its template is; the
 * template's arrangement is in its shell file (templates/xs/xsNN.shell.json),
 * which is what these start from.
 */

export const HEADER_ZONES = ["notice", "links", "brand", "menu", "icons"] as const;
export type HeaderZone = (typeof HEADER_ZONES)[number];
export const HEADER_PART_TYPES = ["logo", "menu", "search", "account", "wishlist", "cart", "phone", "notice", "link", "text", "social", "track", "language"] as const;
export type HeaderPartType = (typeof HEADER_PART_TYPES)[number];

export interface HeaderPart {
  id: string;
  type: HeaderPartType;
  label?: string;
  href?: string;
}
export type HeaderZones = Record<HeaderZone, HeaderPart[]>;

/** The parts there is at most one of. */
export const SINGLE_PARTS: readonly HeaderPartType[] = HEADER_PART_TYPES.filter((type) => type !== "link" && type !== "text");

type Blob = Record<string, unknown>;
const objectOf = (value: unknown): Blob | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Blob) : null);

const SHELLS = import.meta.glob<{ header?: { zones?: unknown } }>("../templates/xs/xs*.shell.json", { eager: true, import: "default" });

const EMPTY: HeaderZones = { notice: [], links: [], brand: [], menu: [], icons: [] };

/** A screen's zones as saved, lightly checked; null when nothing usable is there. */
export function readZones(raw: unknown): HeaderZones | null {
  const saved = objectOf(raw);
  if (!saved || !HEADER_ZONES.some((zone) => Array.isArray(saved[zone]))) return null;
  const zones: HeaderZones = { notice: [], links: [], brand: [], menu: [], icons: [] };
  const seen = new Set<string>();
  for (const zone of HEADER_ZONES) {
    for (const item of Array.isArray(saved[zone]) ? (saved[zone] as unknown[]) : []) {
      const part = objectOf(item);
      const type = part?.type as HeaderPartType;
      if (!part || typeof part.id !== "string" || !HEADER_PART_TYPES.includes(type) || seen.has(part.id)) continue;
      seen.add(part.id);
      zones[zone].push({
        id: part.id,
        type,
        ...(typeof part.label === "string" ? { label: part.label } : {}),
        ...(typeof part.href === "string" ? { href: part.href } : {}),
      });
    }
  }
  return zones;
}

/** The template's own arrangement (its shell file); the bare bar for a look with none. */
export function templateZones(look: string | null | undefined): HeaderZones {
  const file = Object.entries(SHELLS).find(([path]) => path.endsWith(`/xs${look}.shell.json`))?.[1];
  return (
    readZones(file?.header?.zones) ?? {
      ...EMPTY,
      notice: [{ id: "notice", type: "notice" }],
      brand: [{ id: "logo", type: "logo" }],
      menu: [{ id: "menu", type: "menu" }],
      icons: [
        { id: "search", type: "search" },
        { id: "account", type: "account" },
        { id: "wishlist", type: "wishlist" },
        { id: "cart", type: "cart" },
        { id: "phone", type: "phone" },
      ],
    }
  );
}

/** Whether `saved` holds one arrangement per screen. */
function isPerScreen(saved: unknown): boolean {
  const o = objectOf(saved);
  return !!o && !HEADER_ZONES.some((zone) => zone in o) && ["base", "tablet", "mobile"].some((device) => device in o);
}

/** What one screen shows: its own arrangement, the next larger screen's, or the template's. */
export function zonesOn(saved: unknown, device: ScreenDevice, look: string | null | undefined): HeaderZones {
  const fallback = templateZones(look);
  if (!isPerScreen(saved)) return readZones(saved) ?? fallback;
  return readZones(valueOnDevice(saved, device)) ?? readZones(valueOnDevice(saved, "base")) ?? fallback;
}

/** Whether this screen has an arrangement of its own (not one it takes from a larger screen). */
export function hasOwnZones(saved: unknown, device: ScreenDevice): boolean {
  if (!isPerScreen(saved)) return device === "base" && readZones(saved) !== null;
  return readZones(deviceParts(saved)[device]) !== null;
}

/**
 * The header's `zones` after one screen's arrangement is set (null: that
 * screen takes the larger screen's again). A computer's alone is saved plain.
 */
export function withZonesOn(saved: unknown, device: ScreenDevice, zones: HeaderZones | null, look: string | null | undefined): unknown {
  const parts: Partial<Record<ScreenDevice, unknown>> = isPerScreen(saved) ? { ...deviceParts(saved) } : readZones(saved) ? { base: saved } : {};
  if (zones === null) delete parts[device];
  else parts[device] = zones;
  // A smaller screen arranged on its own needs the computer's beside it, as it is now.
  if (device !== "base" && zones !== null && parts.base === undefined) parts.base = templateZones(look);
  const keys = Object.keys(parts);
  if (keys.length === 0) return undefined;
  if (keys.length === 1 && parts.base !== undefined) return parts.base;
  return parts;
}

/** The zone a part stands in, and its place there. */
export function findPart(zones: HeaderZones, id: string): { zone: HeaderZone; index: number } | null {
  for (const zone of HEADER_ZONES) {
    const index = zones[zone].findIndex((part) => part.id === id);
    if (index !== -1) return { zone, index };
  }
  return null;
}

/** A part moved to `index` of `zone` (counting that zone as it is before the move). */
export function movePart(zones: HeaderZones, id: string, zone: HeaderZone, index: number): HeaderZones {
  const from = findPart(zones, id);
  if (!from) return zones;
  const part = zones[from.zone][from.index];
  const next: HeaderZones = { ...zones, [from.zone]: zones[from.zone].filter((p) => p.id !== id) };
  const target = from.zone === zone && from.index < index ? index - 1 : index;
  const list = [...next[zone]];
  list.splice(Math.max(0, Math.min(list.length, target)), 0, part);
  next[zone] = list;
  return next;
}

/**
 * A part moved into `zone` right before `before`, else right after
 * `after`, else at the zone's end — the parts it was seen beside on the
 * canvas. Unchanged when one it names is not in that zone.
 */
export function movePartBeside(zones: HeaderZones, id: string, zone: HeaderZone, before: string | null, after: string | null): HeaderZones {
  const list = zones[zone];
  const anchor = before ?? after;
  const at = anchor === null ? list.length : list.findIndex((part) => part.id === anchor);
  if (at === -1 || anchor === id) return zones;
  return movePart(zones, id, zone, before !== null ? at : anchor === null ? at : at + 1);
}

/** Without a part — never the phone menu's button, which a phone cannot do without. */
export function removePart(zones: HeaderZones, id: string): HeaderZones {
  const at = findPart(zones, id);
  if (!at || zones[at.zone][at.index].type === "phone") return zones;
  return { ...zones, [at.zone]: zones[at.zone].filter((p) => p.id !== id) };
}

/** With a part added at the end of a zone; a single part already placed is not added twice. */
export function addPart(zones: HeaderZones, zone: HeaderZone, part: HeaderPart): HeaderZones {
  if (SINGLE_PARTS.includes(part.type) && Object.values(zones).flat().some((p) => p.type === part.type)) return zones;
  return { ...zones, [zone]: [...zones[zone], part] };
}

/** The single parts not placed anywhere yet. */
export function missingParts(zones: HeaderZones): HeaderPartType[] {
  const placed = new Set(Object.values(zones).flat().map((p) => p.type));
  return SINGLE_PARTS.filter((type) => !placed.has(type));
}

/** A fresh id for a part. */
export function partId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- the footer ----------------------------------------------------------------

export const FOOTER_COLUMN_TYPES = ["group", "pages", "brand", "contact", "newsletter", "social", "payments"] as const;
export type FooterColumnType = (typeof FOOTER_COLUMN_TYPES)[number];
export interface FooterColumn {
  id: string;
  type: FooterColumnType;
  at?: number;
  title?: string;
  text?: string;
  /** Parts of the row (1–4), one value or one per screen. */
  width?: unknown;
  align?: "start" | "center" | "end";
  /** The screens it is left off. */
  hide?: ScreenDevice[];
}
export type FooterBottomType = "rights" | "powered" | "text";
export interface FooterBottomPart {
  id: string;
  type: FooterBottomType;
  label?: string;
}

/** The template's footer: the link groups, the pages and policies, then the brand. */
export function templateColumns(groups: number, showBrand: boolean): FooterColumn[] {
  return [
    ...Array.from({ length: groups }, (_, at): FooterColumn => ({ id: `group-${at}`, type: "group", at })),
    { id: "pages", type: "pages" },
    ...(showBrand ? [{ id: "brand", type: "brand" as const }] : []),
  ];
}

export const TEMPLATE_BOTTOM: FooterBottomPart[] = [
  { id: "rights", type: "rights" },
  { id: "powered", type: "powered" },
];

export function readColumns(raw: unknown): FooterColumn[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((item): FooterColumn[] => {
    const c = objectOf(item);
    if (!c || typeof c.id !== "string" || !FOOTER_COLUMN_TYPES.includes(c.type as FooterColumnType)) return [];
    return [
      {
        id: c.id,
        type: c.type as FooterColumnType,
        ...(typeof c.at === "number" ? { at: c.at } : {}),
        ...(typeof c.title === "string" ? { title: c.title } : {}),
        ...(typeof c.text === "string" ? { text: c.text } : {}),
        ...(c.width !== undefined ? { width: c.width } : {}),
        ...(c.align === "start" || c.align === "center" || c.align === "end" ? { align: c.align } : {}),
        ...(Array.isArray(c.hide) && c.hide.length > 0 ? { hide: (["base", "tablet", "mobile"] as const).filter((d) => (c.hide as unknown[]).includes(d)) } : {}),
      },
    ];
  });
}

export function readBottom(raw: unknown): FooterBottomPart[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((item): FooterBottomPart[] => {
    const p = objectOf(item);
    if (!p || typeof p.id !== "string" || !["rights", "powered", "text"].includes(p.type as string)) return [];
    return [{ id: p.id, type: p.type as FooterBottomType, ...(typeof p.label === "string" ? { label: p.label } : {}) }];
  });
}
