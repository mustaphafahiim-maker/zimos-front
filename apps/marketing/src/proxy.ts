import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";

/**
 * Every route lives under `/[locale]/…`. This redirects locale-less requests
 * (`/`, `/pricing`, deep links from elsewhere) to a locale-prefixed URL,
 * preferring the visitor's `Accept-Language` and falling back to Arabic.
 */

/**
 * Paths that are served as they are: Next's own internals, the route handlers,
 * the metadata files, and anything that names a file.
 *
 * These exclusions live in code rather than in a `config.matcher` so that they
 * read as the plain conditions they are, and stay in step with the storefront's
 * proxy. A matcher is compiled as a path pattern rather than as the regular
 * expression it resembles, so its escaping rules are its own; keeping the list
 * here means a mistake in it shows up as ordinary code, not as a proxy that
 * quietly stops running.
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

function pickLocale(request: NextRequest): string {
  const header = request.headers.get("accept-language");
  if (header) {
    for (const part of header.split(",")) {
      const tag = part.split(";")[0]?.trim().toLowerCase();
      if (!tag) continue;
      const base = tag.split("-")[0];
      const match = locales.find((locale) => locale === base);
      if (match) return match;
    }
  }
  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPassThrough(pathname)) return NextResponse.next();

  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return NextResponse.next();

  const locale = pickLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}
