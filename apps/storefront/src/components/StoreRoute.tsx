"use client";

import Link from "next/link";
import { createContext, useContext, type ComponentProps, type ReactNode } from "react";
import { storeHref } from "@/lib/storeHref";

/**
 * The store's link prefix, handed down to client components.
 *
 * Only a server component can tell how the request arrived (see
 * `getStoreBasePath`), so the store layout resolves the prefix once and puts it
 * here for everything below — the cart icon, the checkout button, the page
 * builder's own blocks — instead of threading it through every prop.
 */
const StoreBasePathContext = createContext<string>("");

export function StoreRouteProvider({
  basePath,
  children,
}: {
  basePath: string;
  children: ReactNode;
}) {
  return <StoreBasePathContext value={basePath}>{children}</StoreBasePathContext>;
}

/**
 * The prefix every link in this store needs — empty on the store's own
 * subdomain. Defaults to empty outside a store (the not-found boundary can be
 * rendered above the store layout, so it resolves its own links instead).
 */
export function useStoreBasePath(): string {
  return useContext(StoreBasePathContext);
}

/**
 * A link written as if the store were at the root of its own site: `/cart`,
 * `/products/mug`. Absolute URLs, anchors and `mailto:` are left untouched, so
 * merchant-authored hrefs can go straight through.
 */
export function StoreLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const basePath = useStoreBasePath();
  const isInternal = href.startsWith("/");
  return <Link href={isInternal ? storeHref(basePath, href) : href} {...props} />;
}
