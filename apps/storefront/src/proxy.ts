import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  MARKETING_URL,
  STORE_SLUG_HEADER,
  isRootDomainHost,
  storeSlugFromHost,
} from "@/lib/domains";
import {
  PAYMENTS_PREVIEW_PARAM,
  STORE_PREVIEW_COOKIE,
  STORE_PREVIEW_HEADER,
  STORE_PREVIEW_PARAM,
  isTokenShaped,
  storePreviewCookieOptions,
} from "@/lib/storePreview";
import { resolveCustomHost } from "@/lib/customDomains";

/**
 * Paths that are served as they are, whatever the host: Next's own internals,
 * the route handlers, the metadata files, and anything that names a file.
 *
 * This is a check in code rather than a `config.matcher` because a matcher is
 * compiled as a path pattern, not as the plain regular expression it looks
 * like, and the difference is silent — the proxy simply stops running on most
 * of the paths it was meant to cover.
 */
function isPassThrough(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    // A file extension on the last segment: `/logo.png`, `/fonts/x.woff2`.
    /\.[^./]+$/.test(pathname)
  );
}

/**
 * Turns the host into the route.
 *
 * A shopper only ever sees `<slug>.zimos.co/products/xyz`, while the app's
 * routes live under `/store/<workspaceId>/products/xyz`. This maps one onto the
 * other with an internal rewrite — not a redirect, unlike marketing's proxy —
 * so the merchant's own subdomain is what stays in the address bar. The slug
 * goes through as the workspace id because the storefront API accepts either.
 *
 * Four kinds of host reach this app:
 *
 *   • a store — `<slug>.zimos.co`, or `<slug>.localhost:3000` in development;
 *   • a merchant's own domain connected to a store (lib/customDomains.ts asks
 *     the API which store). Its root can open a funnel instead of the store
 *     home — the domain's "home funnel";
 *   • the root domain with no store in it (`zimos.co`, `www.zimos.co`,
 *     `store.zimos.co`), which has nothing of its own to show and so goes to
 *     the marketing site;
 *   • anything else — plain `localhost`, an IP, the platform's own health
 *     checks — left alone so development and deploys keep working.
 */
/** Metadata files every store answers for itself, from its own settings. */
const STORE_FILES = new Set(["/robots.txt", "/sitemap.xml"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // On a store's own host these two are the store's (app/store/[workspaceId]/…/route.ts).
  if (STORE_FILES.has(pathname)) {
    const fileHost = request.headers.get("host");
    const storeSlug = storeSlugFromHost(fileHost) ?? (await resolveCustomHost(fileHost))?.slug;
    if (storeSlug) {
      const url = request.nextUrl.clone();
      url.pathname = `/store/${storeSlug}${pathname}`;
      return NextResponse.rewrite(url);
    }
  }
  if (isPassThrough(pathname)) return NextResponse.next();

  // A staff preview token (lib/storePreview): from the link that opened the
  // store, else from this browser's cookie. Server components send it to the
  // API as X-Store-Preview; a token that came in the link is kept in the cookie.
  const linked = request.nextUrl.searchParams.get(STORE_PREVIEW_PARAM) ?? request.nextUrl.searchParams.get(PAYMENTS_PREVIEW_PARAM);
  const fromLink = isTokenShaped(linked) ? linked : null;
  const stored = request.cookies.get(STORE_PREVIEW_COOKIE)?.value;
  const preview = fromLink ?? (isTokenShaped(stored) ? stored : null);
  const headers = new Headers(request.headers);
  headers.delete(STORE_PREVIEW_HEADER);
  if (preview) headers.set(STORE_PREVIEW_HEADER, preview);
  const secure = (request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")) === "https";
  const keep = (response: NextResponse) => {
    if (fromLink) response.cookies.set(STORE_PREVIEW_COOKIE, fromLink, storePreviewCookieOptions(secure));
    return response;
  };
  const next = () => keep(NextResponse.next({ request: { headers } }));

  const host = request.headers.get("host");
  const custom = storeSlugFromHost(host) ? null : await resolveCustomHost(host);
  const slug = storeSlugFromHost(host) ?? custom?.slug ?? null;

  // The internal shape, reached directly: deep links that predate subdomains,
  // the dashboard's preview route, and local development.
  const isInternalPath = pathname === "/store" || pathname.startsWith("/store/");

  if (slug) {
    if (isInternalPath) {
      // The store's own subdomain asked for the internal path. Serving it would
      // leave `/store/<slug>` in the address bar of a store that has a domain
      // of its own, so send the shopper to the same page's public URL instead.
      const prefix = `/store/${slug}`;
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        const url = request.nextUrl.clone();
        url.pathname = pathname.slice(prefix.length) || "/";
        return keep(NextResponse.redirect(url));
      }
      // Another workspace's path on this store's host — not ours to rewrite.
      return next();
    }

    const url = request.nextUrl.clone();
    // A merchant domain with a home funnel opens that funnel on its root.
    url.pathname =
      pathname === "/" && custom?.homeFunnelRef
        ? `/store/${slug}/f/${encodeURIComponent(custom.homeFunnelRef)}`
        : `/store/${slug}${pathname === "/" ? "" : pathname}`;
    headers.set(STORE_SLUG_HEADER, slug);
    return keep(NextResponse.rewrite(url, { request: { headers } }));
  }

  if (isInternalPath) return next();

  // No store in the host, and this app has no front page of its own to show.
  // Temporary, not permanent: a browser caches a permanent redirect for the
  // life of the profile, which would outlive any change of mind here.
  if (isRootDomainHost(host)) return NextResponse.redirect(MARKETING_URL, 307);

  return next();
}
