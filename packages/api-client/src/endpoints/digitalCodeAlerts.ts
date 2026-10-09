/**
 * Licence code pool alerts (backend: frontend-handoff item 213,
 * src/modules/digital/codePoolAlerts.js). The pool itself — pasting codes,
 * stock, drawing a code per unit when an order is paid — is in ./digital.
 *
 * /workspaces/:ws/digital/code-alerts:
 *   GET (products.view)   → { lowAt }   the store warns when at most this many codes are left (default 5)
 *   PUT (products.manage) { lowAt: 0–100000 } → { lowAt }
 *
 * After a paid order draws codes the team gets a `stock.low` notification,
 * once a day per product: "Orders waiting for codes: …" with
 * `data.waitingCodes` when the pool ran out, else "Codes running low: …" when
 * at most `lowAt` are left. Both carry `data.productId` and `data.available`
 * and link to /catalog/:productId?tab=digital.
 */
import type { ApiClient } from "../client";
import type { MerchantNotificationDto } from "./notifications";

/** The most the API takes as `lowAt`. */
export const DIGITAL_CODE_LOW_AT_MAX = 100000;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/digital/code-alerts`;

export async function digitalCodeAlertsGet(client: ApiClient, workspaceId: string): Promise<number> {
  const { lowAt } = await client.request<{ lowAt: number }>(base(workspaceId));
  return lowAt;
}

export async function digitalCodeAlertsSave(client: ApiClient, workspaceId: string, lowAt: number): Promise<number> {
  const saved = await client.request<{ lowAt: number }>(base(workspaceId), { method: "PUT", body: { lowAt } });
  return saved.lowAt;
}

/**
 * How many codes paid orders of a product were still owed when the store last
 * told this member about its pool — read from their notifications (newest
 * first), the only place the API reports it. 0 when the newest word on the
 * product is "running low" (nothing waiting), or when there is none.
 *
 * It is what was true when the notification was raised: codes added since may
 * have been handed to those orders. A caller that also knows the pool has
 * codes left can be sure nothing is waiting.
 */
export function digitalWaitingCodes(notifications: readonly MerchantNotificationDto[], productId: string): number {
  const latest = notifications.find((n) => isDigitalCodeAlert(n) && n.data?.productId === productId);
  const waiting = Number(latest?.data?.waitingCodes);
  return Number.isFinite(waiting) && waiting > 0 ? waiting : 0;
}

/**
 * A `stock.low` notification about a licence code pool rather than a
 * variant's stock: both kinds name a product and what is left, but only the
 * code pool's links to the product's digital tab (or says codes are owed).
 */
export function isDigitalCodeAlert(notification: MerchantNotificationDto): boolean {
  if (notification.type !== "stock.low") return false;
  return Number(notification.data?.waitingCodes) > 0 || (notification.link ?? "").includes("tab=digital");
}
