import Link from "next/link";

/**
 * The branded 404 body, shared by both not-found boundaries.
 *
 * Where a shopper is sent back to depends on which boundary caught the 404 —
 * the store's own home page when there is a store, the site root when there
 * isn't — so the caller decides the link and this only draws it. Deliberately
 * not a client component: it needs no hooks, which leaves the root boundary a
 * plain server component and keeps `"use client"` to the store boundary that
 * actually reads the pathname.
 */
export function NotFoundContent({
  homeHref,
  homeLabel,
}: {
  homeHref: string;
  homeLabel: string;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-display text-5xl font-medium text-primary">404</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-ink">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-ink-soft">
        We couldn&rsquo;t find that page. It may have been moved or removed.
      </p>
      <Link
        href={homeHref}
        className="mt-6 inline-flex items-center rounded-[0.5rem] bg-primary px-5 py-2.5 text-sm font-medium text-paper-raised transition-colors hover:bg-primary-dark"
      >
        {homeLabel}
      </Link>
    </main>
  );
}
