/**
 * What was last opened from Spotlight (⌘K), per store — the launcher's
 * «الأخيرة» (components/CommandPalette.tsx).
 *
 * Kept in this browser only, in localStorage under `zimos.spotlight.recents.v1`
 * as `{ [workspaceId]: SpotlightRecent[] }`, newest first, six per store. A
 * recent is a way back to a page, not a copy of the record: an id, a plain-text
 * title, an optional plain-text detail, the dashboard route and the key of its
 * icon.
 *
 * Phone numbers are never written. A customer is kept by name only: no detail,
 * and a "name" that is really a number is stored as an empty title (the
 * launcher then says «عميل»).
 */
export const SPOTLIGHT_RECENTS_KEY = "zimos.spotlight.recents.v1";
export const SPOTLIGHT_RECENTS_MAX = 6;

/** Stores remembered in one browser; the one opened longest ago is dropped first. */
const MAX_STORES = 12;
const MAX_TEXT = 120;

export type SpotlightRecentGroup = "order" | "product" | "customer" | "funnel" | "action" | "page";

export interface SpotlightRecent {
  /** Stable per thing: "order-<id>", "page-/orders", "cmd-order". */
  id: string;
  group: SpotlightRecentGroup;
  /** Plain text. Empty for a customer saved without a name. */
  title: string;
  /** Plain text, optional. Never set for a customer. */
  detail?: string;
  /** A dashboard route: "/orders/<id>". */
  to: string;
  /** Which icon to draw: the group for a record, the action's id, a page's nav key. */
  icon: string;
}

const GROUPS: ReadonlySet<string> = new Set(["order", "product", "customer", "funnel", "action", "page"] satisfies SpotlightRecentGroup[]);

/**
 * Seven or more digits in a row (Latin, Arabic-Indic or Persian), with the
 * spaces, dashes, dots and brackets people put between them: a phone number,
 * not a name.
 */
export function looksLikePhone(text: string): boolean {
  return /[\d٠-٩۰-۹](?:[\s\-().]*[\d٠-٩۰-۹]){6,}/.test(text);
}

/** An in-app route — never "//host", a scheme or a backslash path. */
function isDashboardRoute(to: string): boolean {
  return to.startsWith("/") && !to.startsWith("//") && !to.includes("\\");
}

function isRecent(value: unknown): value is SpotlightRecent {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    r.id !== "" &&
    typeof r.group === "string" &&
    GROUPS.has(r.group) &&
    typeof r.title === "string" &&
    (r.detail === undefined || typeof r.detail === "string") &&
    typeof r.to === "string" &&
    isDashboardRoute(r.to) &&
    typeof r.icon === "string"
  );
}

/** The shape that is written: trimmed, capped, and with nothing a customer should not leave behind. */
function clean(recent: SpotlightRecent): SpotlightRecent {
  const customer = recent.group === "customer";
  const title = recent.title.trim().slice(0, MAX_TEXT);
  const detail = customer ? "" : (recent.detail ?? "").trim().slice(0, MAX_TEXT);
  const out: SpotlightRecent = {
    id: recent.id,
    group: recent.group,
    title: customer && looksLikePhone(title) ? "" : title,
    to: recent.to,
    icon: recent.icon,
  };
  if (detail) out.detail = detail;
  return out;
}

function readAll(): Map<string, SpotlightRecent[]> {
  const all = new Map<string, SpotlightRecent[]>();
  try {
    const raw = localStorage.getItem(SPOTLIGHT_RECENTS_KEY);
    if (!raw) return all;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return all;
    for (const [workspaceId, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      const recents = list.filter(isRecent).slice(0, SPOTLIGHT_RECENTS_MAX);
      if (recents.length > 0) all.set(workspaceId, recents);
    }
  } catch {
    /* private mode, or a value someone edited by hand: start empty */
  }
  return all;
}

function writeAll(all: Map<string, SpotlightRecent[]>): void {
  try {
    if (all.size === 0) localStorage.removeItem(SPOTLIGHT_RECENTS_KEY);
    else localStorage.setItem(SPOTLIGHT_RECENTS_KEY, JSON.stringify(Object.fromEntries(all)));
  } catch {
    /* private mode or a full disk: the launcher simply has no recents */
  }
}

/** The store's recents, newest first. */
export function readSpotlightRecents(workspaceId: string | null | undefined): SpotlightRecent[] {
  if (!workspaceId) return [];
  return readAll().get(workspaceId) ?? [];
}

/** Puts `recent` first in the store's list (once), keeps six, and returns the list. */
export function rememberSpotlightRecent(workspaceId: string | null | undefined, recent: SpotlightRecent): SpotlightRecent[] {
  if (!workspaceId) return [];
  const all = readAll();
  const before = all.get(workspaceId) ?? [];
  if (!recent.id || !GROUPS.has(recent.group) || !isDashboardRoute(recent.to)) return before;

  const entry = clean(recent);
  const list = [entry, ...before.filter((r) => r.id !== entry.id)].slice(0, SPOTLIGHT_RECENTS_MAX);
  // Re-inserted so the store used last is the last one to be dropped.
  all.delete(workspaceId);
  all.set(workspaceId, list);
  while (all.size > MAX_STORES) {
    const oldest = all.keys().next();
    if (oldest.done) break;
    all.delete(oldest.value);
  }
  writeAll(all);
  return list;
}

/** Forgets the store's recents (the «امسح» next to the heading). */
export function clearSpotlightRecents(workspaceId: string | null | undefined): void {
  if (!workspaceId) return;
  const all = readAll();
  if (!all.delete(workspaceId)) return;
  writeAll(all);
}
