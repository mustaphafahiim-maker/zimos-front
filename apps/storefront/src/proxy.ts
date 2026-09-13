import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  MARKETING_URL,
  STORE_SLUG_HEADER,
  isRootDomainHost,
  storeSlugFromHost,
} from "@/lib/domains";

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
 * Three kinds of host reach this app:
 *
 *   • a store — `<slug>.zimos.co`, or `<slug>.localhost:3000` in development;
 *   • the root domain with no store in it (`zimos.co`, `www.zimos.co`,
 *     `store.zimos.co`), which has nothing of its own to show and so goes to
 *     the marketing site;
 *   • anything else — plain `localhost`, an IP, the platform's own health
 *     checks — left alone so development and deploys keep working.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPassThrough(pathname)) return NextResponse.next();

  const host = request.headers.get("host");
  const slug = storeSlugFromHost(host);

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
        return NextResponse.redirect(url);
      }
      // Another workspace's path on this store's host — not ours to rewrite.
      return NextResponse.next();
    }

    const url = request.nextUrl.clone();
    url.pathname = `/store/${slug}${pathname === "/" ? "" : pathname}`;
    const headers = new Headers(request.headers);
    headers.set(STORE_SLUG_HEADER, slug);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  if (isInternalPath) return NextResponse.next();

  // No store in the host, and this app has no front page of its own to show.
  // Temporary, not permanent: a browser caches a permanent redirect for the
  // life of the profile, which would outlive any change of mind here.
  if (isRootDomainHost(host)) return NextResponse.redirect(MARKETING_URL, 307);

  return NextResponse.next();
}
