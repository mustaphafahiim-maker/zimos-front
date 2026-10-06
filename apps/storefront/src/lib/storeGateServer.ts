import { cache } from "react";
import { cookies, headers } from "next/headers";
import { isStoreLocked, storefrontGateOf, type StoreGatePublic } from "@store-builder/api-client";
import { createServerStorefrontApiClient } from "./serverApiClient";
import { STORE_GATE_COOKIE, ageCookieName, isGateTokenShaped } from "./storeGate";
import { STORE_PREVIEW_HEADER, isTokenShaped } from "./storePreview";

export interface StoreGateView {
  gate: StoreGatePublic;
  /** The store's own pages are closed to this visitor (no right password, no staff preview). */
  locked: boolean;
  /** Funnel pages are closed too (the merchant's "lock funnels"); only meaningful while `locked`. */
  funnelsLocked: boolean;
  /** Staff previewing the store: no gate, no age question. */
  staff: boolean;
  /** The visitor already said they are old enough, this session. */
  ageConfirmed: boolean;
  /** The visitor's unlock token is no use here any more — the page drops it. */
  dropToken: boolean;
}

/** Whether the API answers this route for this request (credentials included), or 423 STORE_LOCKED. */
async function answers(path: (workspaceId: string) => string, workspaceId: string): Promise<boolean> {
  const client = await createServerStorefrontApiClient();
  try {
    await client.request(path(workspaceId), { auth: false });
    return true;
  } catch (err) {
    return !isStoreLocked(err);
  }
}

/**
 * The store gate for this request (frontend-handoff 197), read once per
 * render. The API is the judge: a visitor with credentials — a staff preview
 * token, or the password's token for a password store — is checked against
 * one of the store's locked routes, so an expired preview or a token from an
 * old password counts as locked. Without credentials a gated store is locked,
 * with no call.
 *
 * Funnels follow the merchant's "lock funnels", which GET /store/:ws does not
 * carry; a locked visitor asks a funnel route once (it answers 423 when they
 * are locked, a plain 404 for the made-up funnel otherwise).
 */
export const getStoreGateView = cache(async (workspaceId: string, store: unknown): Promise<StoreGateView> => {
  const gate = storefrontGateOf(store);
  const [requestHeaders, jar] = await Promise.all([headers(), cookies()]);
  const staffToken = isTokenShaped(requestHeaders.get(STORE_PREVIEW_HEADER));
  const gateToken = isGateTokenShaped(jar.get(STORE_GATE_COOKIE)?.value);
  const storeId = (store as { id?: unknown } | null)?.id;
  const ageConfirmed = typeof storeId === "string" && jar.get(ageCookieName(storeId))?.value === "1";

  let locked = false;
  if (gate.mode !== "off") {
    const credentials = staffToken || (gate.mode === "password" && gateToken);
    locked = credentials ? !(await answers((ws) => `/store/${ws}/collections`, workspaceId)) : true;
  }
  const raw = (store as { gate?: { lockFunnels?: unknown } } | null)?.gate?.lockFunnels;
  const funnelsLocked =
    locked && (typeof raw === "boolean" ? raw : !(await answers((ws) => `/store/${ws}/funnels/__gate__/pages`, workspaceId)));

  return {
    gate,
    locked,
    funnelsLocked,
    staff: staffToken && !locked,
    ageConfirmed,
    dropToken: gateToken && (gate.mode !== "password" || locked),
  };
});
