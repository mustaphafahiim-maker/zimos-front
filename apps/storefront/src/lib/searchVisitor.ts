import { getVisitorId } from "./visitorId";

/**
 * Who searched (frontend-handoff 211). The results page is rendered on the
 * server, which cannot see the tab's visitor id (sessionStorage, lib/visitor).
 * So the search box leaves that same id in a session cookie as it sends the
 * shopper to the results, and the server passes it on as `X-Visitor-Id`: the
 * merchant's report then counts shoppers, not only searches.
 *
 * First-party and anonymous — a random id, no name, nothing kept after the
 * browser closes — like the store's own analytics (lib/analyticsEvents), which
 * carry the same id.
 */
export const SEARCH_VISITOR_COOKIE = "zimos_search_visitor";

/** What the API takes as a visitor id: 8–64 characters, nothing a header could not carry. */
const VISITOR_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function isSearchVisitorId(value: string | null | undefined): value is string {
  return typeof value === "string" && VISITOR_ID.test(value);
}

/** Call in the browser, just before navigating to a search. Never throws. */
export function rememberSearchVisitor(workspaceId: string): void {
  try {
    const id = getVisitorId(workspaceId);
    if (!isSearchVisitorId(id)) return;
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${SEARCH_VISITOR_COOKIE}=${id}; path=/; samesite=lax${secure}`;
  } catch {
    /* cookies blocked: the search is counted without a shopper */
  }
}
