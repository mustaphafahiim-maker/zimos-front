/**
 * Tags from website pages (SPEC §18.4; backend contacts/pageTags.js): which
 * of a page's buy buttons or order forms — the ones the merchant gave
 * "Tags added to the customer" — this shopper used, kept on the device for a
 * day and sent with the order as `pageTags: [{ pageId, elementId }]`. Only
 * where they are: the server reads the tags from the published page.
 */

interface PageTagRef {
  pageId: string;
  elementId: string;
  at: number;
}

const KEY = (workspaceId: string) => `zimos_page_tags:${workspaceId}`;
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX = 10;

function read(workspaceId: string): PageTagRef[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY(workspaceId)) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    const now = Date.now();
    return raw.filter(
      (r): r is PageTagRef =>
        Boolean(r) && typeof r.pageId === "string" && typeof r.elementId === "string" && typeof r.at === "number" && now - r.at < TTL_MS
    );
  } catch {
    return [];
  }
}

/** The shopper pressed the button / started on the form: remember it until they order (or for a day). */
export function rememberPageTag(workspaceId: string, pageId: string, elementId: string) {
  if (typeof window === "undefined" || !pageId || !elementId) return;
  const rest = read(workspaceId).filter((r) => !(r.pageId === pageId && r.elementId === elementId));
  try {
    window.localStorage.setItem(KEY(workspaceId), JSON.stringify([...rest, { pageId, elementId, at: Date.now() }].slice(-MAX)));
  } catch {
    // Storage blocked: the tags are simply not added.
  }
}

/** The `pageTags` field of a checkout body: spread it in. Empty when there is nothing (and on the server). */
export function pageTagFields(workspaceId: string): { pageTags?: Array<{ pageId: string; elementId: string }> } {
  if (typeof window === "undefined") return {};
  const refs = read(workspaceId);
  return refs.length ? { pageTags: refs.map(({ pageId, elementId }) => ({ pageId, elementId })) } : {};
}

/** The order is placed: the tags went with it. */
export function clearPageTags(workspaceId: string) {
  try {
    window.localStorage.removeItem(KEY(workspaceId));
  } catch {
    // nothing to do
  }
}
