"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Which funnel session and step a page is being shown in, for the page's own
 * elements that act on the funnel — a COD form placed on a sales page orders
 * and moves the shopper on along the step's "order" link. Provided by the
 * funnel's session page; absent everywhere else (the store, the editor).
 */
export interface FunnelSessionInfo {
  workspaceId: string;
  funnelId: string;
  sessionId: string;
  stepKey: string;
  stepType: string;
  sessionOrderId: string | null;
}

const FunnelSessionContext = createContext<FunnelSessionInfo | null>(null);

export function FunnelSessionProvider({ value, children }: { value: FunnelSessionInfo; children: ReactNode }) {
  return <FunnelSessionContext.Provider value={value}>{children}</FunnelSessionContext.Provider>;
}

export function useFunnelSession(): FunnelSessionInfo | null {
  return useContext(FunnelSessionContext);
}
