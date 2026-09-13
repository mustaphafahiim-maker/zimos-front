/**
 * Which store a request is for is decided by its host: every storefront is
 * served from its own subdomain, `<slug>.zimos.co`. The app's own routes still
 * live under `/store/<workspaceId>/…`, so something has to map one onto the
 * other — the proxy on the way in, and the pages on the way out when they need
 * a public URL back for a link or a canonical tag. Both read the host through
 * the helpers here so they can never disagree about what counts as a store.
 */

/** Overridable so a staging deploy can hang stores off its own domain. */
export const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "zimos.co").toLowerCase();

/** The marketing site — where a visitor whose host names no store is sent. */
export const MARKETING_URL = `https://${ROOT_DOMAIN}`;

/**
 * Subdomains that belong to the platform rather than to a merchant: this app's
 * own canonical host and its sibling deploys. None of them can be a slug, so a
 * merchant who somehow registered one still can't shadow them here.
 */
const RESERVED_SUBDOMAINS = new Set(["store", "www", "app", "admin", "api"]);

/**
 * Development has no wildcard DNS, but browsers resolve every `*.localhost`
 * name to the loopback address by themselves — so `mystore.localhost:3000`
 * exercises the real subdomain path with no hosts-file entry. Plain
 * `localhost` is left on the `/store/<workspaceId>` routes.
 */
const DEV_SUFFIX = ".localhost";

/** The Host header without its port, lowercased. Empty when there is none. */
export function hostnameOf(host: string | null | undefined): string {
  return (host ?? "").trim().replace(/:\d+$/, "").toLowerCase();
}

/**
 * The store slug a host addresses, or null when it names no store — the bare
 * root domain, a reserved subdomain, plain `localhost`, an IP, or any host the
 * platform doesn't serve stores on.
 */
export function storeSlugFromHost(host: string | null | undefined): string | null {
  const hostname = hostnameOf(host);
  for (const suffix of [`.${ROOT_DOMAIN}`, DEV_SUFFIX]) {
    if (!hostname.endsWith(suffix)) continue;
    const label = hostname.slice(0, -suffix.length);
    // Exactly one label: `cdn.assets.zimos.co` is not a store either.
    if (!label || label.includes(".") || RESERVED_SUBDOMAINS.has(label)) return null;
    return label;
  }
  return null;
}

/** Whether the host is the root domain itself or any subdomain of it. */
export function isRootDomainHost(host: string | null | undefined): boolean {
  const hostname = hostnameOf(host);
  return hostname === ROOT_DOMAIN || hostname.endsWith(`.${ROOT_DOMAIN}`);
}

/** A store's public origin, e.g. `https://mystore.zimos.co`. */
export function storeOrigin(slug: string): string {
  return `https://${slug}.${ROOT_DOMAIN}`;
}

/**
 * Set by the proxy on a rewritten request, naming the store whose subdomain it
 * arrived on. Its presence is what tells a page it is being served at the root
 * of a store's own domain, and so must emit `/cart` rather than
 * `/store/<workspaceId>/cart`.
 */
export const STORE_SLUG_HEADER = "x-store-slug";
