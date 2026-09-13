"use client";

import { usePathname } from "next/navigation";
import { NotFoundContent } from "@/components/NotFoundContent";

/**
 * The 404 for anything under a store — a path the merchant never published, or
 * a product that's gone. Reached when a page below the store layout calls
 * `notFound()`, so there is a real store to send the shopper back to.
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

  return <NotFoundContent homeHref={home} homeLabel="Back to the store" />;
}
