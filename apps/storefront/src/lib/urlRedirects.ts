import type { StorefrontRedirect } from "@store-builder/api-client";
import { storeHref } from "./storeHref";

/**
 * URL redirects on the storefront: what the pages that
 * cannot find something and the not-found page share. An address the store no
 * longer has is asked about at GET /store/:ws/redirects/lookup; a hit sends
 * the shopper on — permanently for a 301, for now for a 302.
 *
 * No imports from next/headers here, so both the server pages
 * (lib/urlRedirectsServer) and the not-found page's own check
 * (components/RedirectLookup) can use it.
 */

export type RedirectQuery = Record<string, string | string[] | undefined>;

/**
 * The query parameters that follow a shopper through a redirect: where the
 * visit came from (lib/touches reads them on the page they land on) and a
 * coupon link's code. Anything else belonged to the old address.
 */
const CARRIED = new Set(["ad_id", "fbclid", "ttclid", "gclid", "sccid", "twclid", "rdt_cid", "msclkid", "tblci", "ref", "coupon"]);
const isCarried = (key: string) => /^utm_/i.test(key) || CARRIED.has(key.toLowerCase());

/** A route segment as written: Next may hand it percent-encoded (Arabic slugs). */
export function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Text as the API keeps an address: decoded, except the characters that mean
 * something in a URL (the API runs decodeURI over what the merchant typed).
 */
function asStored(value: string): string {
  const encoded = encodeURIComponent(value);
  try {
    return decodeURI(encoded);
  } catch {
    return encoded;
  }
}

const pairsOf = (query: RedirectQuery | undefined): Array<[string, string]> =>
  Object.entries(query ?? {}).flatMap(([key, value]) =>
    (Array.isArray(value) ? value : [value]).filter((item): item is string => item !== undefined).map((item) => [key, item] as [string, string])
  );

/** A store-relative path and the page's query as one address: "/products?collection=old". */
export function addressOf(path: string, query?: RedirectQuery): string {
  const pairs = pairsOf(query).map(([key, value]) => `${asStored(key)}=${asStored(value)}`);
  return pairs.length > 0 ? `${path}?${pairs.join("&")}` : path;
}

/** Two store-relative addresses that open the same page: the same path and the same parameters, in any order. */
function sameAddress(a: string, b: string): boolean {
  const key = (address: string) => {
    let text = address;
    try {
      text = decodeURI(address);
    } catch {
      /* as written */
    }
    const at = text.indexOf("?");
    const rawPath = at >= 0 ? text.slice(0, at) : text;
    const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
    const pairs = [...new URLSearchParams(at >= 0 ? text.slice(at + 1) : "")].map(([k, v]) => `${k}=${v}`).sort();
    return `${path}?${pairs.join("&")}`;
  };
  return key(a) === key(b);
}

/**
 * An address fit for a Location header: the API keeps addresses decoded, and
 * a header takes only printable ASCII. What is already percent-encoded (the
 * characters that mean something in a URL) is left as it is.
 */
function forHeader(address: string): string {
  return address.replace(/[^\x21-\x7E]/gu, (char) => {
    try {
      return encodeURIComponent(char);
    } catch {
      return "";
    }
  });
}

/**
 * Where a found redirect sends the shopper, as a URL for this request — or
 * null when it would only bring them back to the address they are on (a
 * redirect from "/x" to "/x?y=1" that itself is not found).
 *
 * `to` is store-relative (resolved against how the store is served) or a full
 * https:// address. `current` is the store-relative address the shopper is
 * on, `search` its query: the campaign parameters in it ride along to a page
 * of the store, and nothing is added to another site's address.
 */
export function redirectTarget(found: StorefrontRedirect, basePath: string, current: string, search?: URLSearchParams | RedirectQuery): string | null {
  const to = found.to.trim();
  if (/^https:\/\//i.test(to)) {
    try {
      return new URL(to).href;
    } catch {
      return null;
    }
  }
  if (!to.startsWith("/")) return null;
  // One leading slash: "//host" would leave the store.
  const local = to.replace(/^\/+/, "/");
  const hashAt = local.indexOf("#");
  const hash = hashAt >= 0 ? local.slice(hashAt) : "";
  const beforeHash = hashAt >= 0 ? local.slice(0, hashAt) : local;
  const queryAt = beforeHash.indexOf("?");
  const path = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  const ownQuery = queryAt >= 0 ? beforeHash.slice(queryAt + 1) : "";

  const own = new URLSearchParams(ownQuery);
  const incoming = search instanceof URLSearchParams ? [...search.entries()] : pairsOf(search);
  const carried = incoming.filter(([key]) => isCarried(key) && !own.has(key));
  // The merchant's own address is kept as written; only the visit's campaign parameters are added to it.
  const extra = new URLSearchParams(carried).toString();
  const query = [ownQuery, extra].filter(Boolean).join("&");
  const target = `${path}${query ? `?${query}` : ""}`;
  if (sameAddress(target, current)) return null;
  return forHeader(storeHref(basePath, `${target}${hash}`));
}

/** 301 is the merchant's "permanent"; anything else is temporary. */
export function isPermanent(found: StorefrontRedirect): boolean {
  return found.statusCode === 301;
}
