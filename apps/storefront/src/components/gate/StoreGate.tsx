import type { ReactNode } from "react";
import { brandingRemoved } from "@/components/PoweredByZimos";
import { CLEAR_GATE_COOKIE_SCRIPT } from "@/lib/storeGate";
import { getStoreGateView } from "@/lib/storeGateServer";
import { StoreGateScreen } from "./StoreGateScreen";

/**
 * The store behind its gate (frontend-handoff 197). Wraps the store's chrome
 * and page in the store layout: with no gate and no age question it is the
 * store as it is; otherwise StoreGateScreen picks, by the route showing,
 * between the store, the password or coming-soon page, and the age question.
 *
 * The routes that stay open while locked (order tracking, payments,
 * downloads…) keep the whole store chrome; a locked route shows only the
 * gate, full screen. The merchant's scripts, analytics and the cookie banner
 * sit outside it in the layout and are not this component's business.
 */
export async function StoreGate({ workspaceId, store, children }: { workspaceId: string; store: unknown; children: ReactNode }) {
  const view = await getStoreGateView(workspaceId, store);
  // A token the store no longer takes is dropped before anything sends it.
  const drop = view.dropToken ? <script dangerouslySetInnerHTML={{ __html: CLEAR_GATE_COOKIE_SCRIPT }} /> : null;
  if (view.gate.mode === "off" && !view.gate.ageCheck.enabled) {
    return (
      <>
        {drop}
        {children}
      </>
    );
  }
  return (
    <>
      {drop}
      <StoreGateScreen
        gate={view.gate}
        locked={view.locked}
        funnelsLocked={view.funnelsLocked}
        staff={view.staff}
        ageConfirmed={view.ageConfirmed}
        showBranding={!brandingRemoved(store)}
      >
        {children}
      </StoreGateScreen>
    </>
  );
}
