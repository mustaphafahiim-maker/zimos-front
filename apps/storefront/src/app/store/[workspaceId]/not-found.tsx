"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The 404 for anything under a store — a path the merchant never published, or
 * a product that's gone.
 *
 * A client component so it can work out where "the store" is from the URL: a
 * not-found boundary is rendered outside its segment, so neither the route
 * params nor the store layout's link prefix reach it. The pathname is the one
 * the shopper sees, which on a store's own subdomain is already store-relative
 * and on the shared host still carries the `/store/<workspaceId>` prefix.
 */
export default function StoreNotFound() {
  const pathname = usePathname() ?? "";
  const workspaceId = pathname.match(/^\/store\/([^/]+)/)?.[1] ?? null;
  const home = workspaceId ? `/store/${workspaceId}` : "/";

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-display text-5xl font-medium text-primary">404</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-ink">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-ink-soft">
        We couldn&rsquo;t find that page. It may have been moved or removed.
      </p>
      <Link
        href={home}
        className="mt-6 inline-flex items-center rounded-[0.5rem] bg-primary px-5 py-2.5 text-sm font-medium text-paper-raised transition-colors hover:bg-primary-dark"
      >
        Back to the store
      </Link>
    </main>
  );
}
