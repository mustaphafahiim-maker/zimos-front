/**
 * Which sites may show the store's pages inside a frame: the CSP
 * `frame-ancestors` directive, read at build time by next.config.ts from
 * STOREFRONT_FRAME_ANCESTORS, a comma-separated list of origins besides the
 * store's own. The dashboard's live previews frame the store from the
 * dashboard's origin (e.g. "https://app.zimos.co"), so that origin belongs on
 * the list.
 *
 * Unset or empty sends no header: any site may frame the store, exactly as
 * before. Set, the answer is `frame-ancestors 'self' <origins>`. Only named
 * http(s) origins are kept, never a wildcard; anything else is dropped, so a
 * typo narrows the list instead of opening it, and "self" alone allows the
 * store's own pages only.
 */
export function frameAncestorsPolicy(raw: string | undefined): string | null {
  const entries = (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return null;

  const origins: string[] = [];
  for (const entry of entries) {
    if (entry.includes("*")) continue;
    try {
      const url = new URL(entry);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      if (!origins.includes(url.origin)) origins.push(url.origin);
    } catch {
      // "self", "'self'" and anything that is not an address: 'self' is always there.
    }
  }
  return ["frame-ancestors", "'self'", ...origins].join(" ");
}
