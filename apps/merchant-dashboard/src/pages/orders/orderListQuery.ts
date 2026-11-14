/**
 * The orders list remembers the filters, search and sort it was last shown
 * with, so the order page's previous / next arrows walk the same list the
 * merchant came from. Session-scoped: a new tab starts from the plain list.
 */
const KEY = "zimos.orders.lastListQuery";

/** `query` is a URL query string without the leading "?". */
export function rememberOrdersListQuery(query: string): void {
  try {
    window.sessionStorage.setItem(KEY, query);
  } catch {
    // Private mode / storage disabled: the arrows fall back to the plain list.
  }
}

export function lastOrdersListQuery(): string {
  try {
    return window.sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
