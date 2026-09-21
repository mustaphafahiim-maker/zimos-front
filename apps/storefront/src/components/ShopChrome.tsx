"use client";

import type { ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";

/** The route segment under /store/[workspaceId] that holds funnel pages. */
export const FUNNEL_SEGMENT = "f";

/**
 * The store's own navigation — header and footer — which a funnel page leaves
 * out: a funnel keeps the shopper on one path, so it draws its own minimal
 * masthead instead (app/store/[workspaceId]/f/layout.tsx).
 *
 * The store layout sits above the funnel routes and can't be swapped out for
 * them, so it asks here which segment is showing. Everywhere else in the store
 * this renders its children untouched.
 */
export function ShopChrome({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment();
  if (segment === FUNNEL_SEGMENT) return null;
  return <>{children}</>;
}
