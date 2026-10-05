/**
 * Dropshipping, order by order (backend: src/modules/dropship/dropshipOrders.js):
 * the order page's Supplier card, and each supplier's forwarding settings.
 */
import type { ApiClient } from "../client";
import type { OrderStage } from "../types";
import type { DropshipProviderDto } from "./apps";

export type DropshipAutoForward = "off" | "created" | "confirmed";

export interface DropshipOrderRef {
  provider: string;
  providerName: string;
  externalOrderId: string;
  /** The supplier's own word for where the order stands (received, confirmed, shipped…). */
  externalStatus: string | null;
  /** The stage that status means here; null when it changes nothing. */
  suggestedStage: OrderStage | null;
  forwardedBy: "manual" | "auto";
  pushedAt: string;
  checkedAt: string | null;
  /** Why the last check failed, if it did. */
  lastError: string | null;
  /** Still asked about every few minutes (the supplier reports status and the order is not finished there). */
  followed: boolean;
}

export interface DropshipOrderSupplier {
  code: string;
  name: string;
  isTest: boolean;
  /** How many of the order's lines are this supplier's products (0: none are anyone's). */
  lines: number;
}

export interface DropshipOrderState {
  refs: DropshipOrderRef[];
  /** Connected suppliers the order can be forwarded to. */
  suppliers: DropshipOrderSupplier[];
}

const base = (workspaceId: string, orderId: string) => `/workspaces/${workspaceId}/orders/${orderId}/dropship`;

export function dropshipOrderState(client: ApiClient, workspaceId: string, orderId: string): Promise<DropshipOrderState> {
  return client.request<DropshipOrderState>(base(workspaceId, orderId));
}

/** Forwards the order (its lines from this supplier) and answers the card again. Sending twice is harmless. */
export function dropshipOrderPush(client: ApiClient, workspaceId: string, orderId: string, code: string): Promise<DropshipOrderState> {
  return client.request<DropshipOrderState>(`${base(workspaceId, orderId)}/${encodeURIComponent(code)}/push`, { method: "POST" });
}

/** Asks every supplier the order went to where it stands now. */
export function dropshipOrderRefresh(client: ApiClient, workspaceId: string, orderId: string): Promise<DropshipOrderState> {
  return client.request<DropshipOrderState>(`${base(workspaceId, orderId)}/refresh`, { method: "POST" });
}

export interface DropshipProviderSettings {
  /** Forward orders holding this supplier's products by themselves: never, when placed, or once confirmed. */
  autoForward: DropshipAutoForward;
  /** Move the order to the stage the supplier's status means (when the order can make that move). */
  applyStatus: boolean;
  /** The supplier reports order status, so the two settings above about following apply. */
  followsStatus: boolean;
}

export function dropshipSettingsOf(provider: DropshipProviderDto): DropshipProviderSettings {
  const p = provider as DropshipProviderDto & Partial<DropshipProviderSettings>;
  return {
    autoForward: p.autoForward === "created" || p.autoForward === "confirmed" ? p.autoForward : "off",
    applyStatus: Boolean(p.applyStatus),
    followsStatus: Boolean(p.followsStatus),
  };
}

/** Needs apps.manage (403 otherwise). */
export function dropshipSaveSettings(
  client: ApiClient,
  workspaceId: string,
  code: string,
  settings: Partial<Pick<DropshipProviderSettings, "autoForward" | "applyStatus">>
): Promise<{ code: string; autoForward: DropshipAutoForward; applyStatus: boolean }> {
  return client.request(`/workspaces/${workspaceId}/dropship/providers/${encodeURIComponent(code)}/settings`, { method: "PATCH", body: settings });
}
