import { useEffect, useSyncExternalStore } from "react";
import { isApiErrorCode, isDomainsSectionClosed, storeDesignDomainsOverview } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";

/*
 * Custom domains can be closed for the whole server (handoff item 341:
 * CUSTOM_DOMAINS_ENABLED set to anything but "true"): every domains path then
 * answers 404 ROUTE_NOT_FOUND, and the dashboard hides Store settings →
 * Domains and the setup guide's domain step.
 *
 * The answer is the server's, not the store's: learned once per visit (the
 * first overview answer), then shared by the settings menu, the setup guide
 * and the Domains tab itself. Kept in its own small file so the home page
 * does not pull the domains screen in.
 */
let closedState: "open" | "closed" | null = null;
let probing: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setClosedState(next: "open" | "closed") {
  if (closedState === next) return;
  closedState = next;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** The Domains tab reports what its own overview request learned. */
export function noteCustomDomains(error: unknown, loaded: boolean) {
  if (isDomainsSectionClosed(error)) setClosedState("closed");
  else if (loaded) setClosedState("open");
}

/**
 * True once the server said custom domains are closed (GET /domains/overview
 * answered 404 ROUTE_NOT_FOUND). While unknown, and with `ask`, it asks once;
 * any other answer — the list, or a 403 for a role without `domain.manage` —
 * means open, and a network failure leaves it unknown.
 */
export function useCustomDomainsClosed(ask = true): boolean {
  const workspaceId = useWorkspaceId();
  const state = useSyncExternalStore(subscribe, () => closedState);
  useEffect(() => {
    if (!ask || closedState !== null || probing) return;
    probing = storeDesignDomainsOverview(apiClient, workspaceId)
      .then(
        () => setClosedState("open"),
        (err: unknown) => {
          if (isDomainsSectionClosed(err)) setClosedState("closed");
          else if (isApiErrorCode(err, "FORBIDDEN")) setClosedState("open");
        }
      )
      .finally(() => {
        probing = null;
      });
  }, [ask, workspaceId]);
  return state === "closed";
}
