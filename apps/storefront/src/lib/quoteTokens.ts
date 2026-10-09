/**
 * The shopper's own quote requests on this device (frontend-handoff 219).
 *
 * POST /store/:ws/quotes answers with a private token, shown that once: it is
 * what opens the quote later, so the browser keeps it — per store, in
 * localStorage. A browser that blocks storage keeps it for the life of the
 * page only; the quote page then says it cannot open the quote from here.
 */

export interface SavedQuote {
  token: string;
  /** "Q-0001", for a list of the shopper's requests. */
  number: string;
  /** When it was sent, ms since the epoch. */
  at: number;
}

const KEY_PREFIX = "zimos_quotes_";
/** Old requests are dropped from the device past this many. */
const KEEP = 30;

// What this page saved, for a browser where localStorage throws.
const memory = new Map<string, Record<string, SavedQuote>>();

function readAll(storeId: string): Record<string, SavedQuote> {
  if (!storeId || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`${KEY_PREFIX}${storeId}`);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { ...(memory.get(storeId) ?? {}), ...(parsed as Record<string, SavedQuote>) };
  } catch {
    /* storage blocked or the entry is not ours: what this page holds */
  }
  return memory.get(storeId) ?? {};
}

/** Keeps a new request's token. `storeId` is the store's UUID. */
export function saveQuoteToken(storeId: string, quoteId: string, token: string, number: string): void {
  if (!storeId || !quoteId || !token) return;
  const all = { ...readAll(storeId), [quoteId]: { token, number, at: Date.now() } };
  const kept = Object.fromEntries(
    Object.entries(all)
      .sort(([, a], [, b]) => (b.at ?? 0) - (a.at ?? 0))
      .slice(0, KEEP)
  );
  memory.set(storeId, kept);
  try {
    window.localStorage.setItem(`${KEY_PREFIX}${storeId}`, JSON.stringify(kept));
  } catch {
    /* storage blocked: the token lasts as long as this page */
  }
}

/** The token of a quote sent from this device; null when this browser never sent it. */
export function readQuoteToken(storeId: string, quoteId: string): string | null {
  const saved = readAll(storeId)[quoteId];
  return saved && typeof saved.token === "string" && saved.token ? saved.token : null;
}
