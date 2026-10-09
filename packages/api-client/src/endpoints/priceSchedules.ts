/**
 * Scheduled price changes — sales with a start and an end (backend: frontend-handoff item 227,
 * src/modules/priceSchedules).
 *
 * At the start the variants' real price changes (the cart, checkout, feeds and pixels all agree),
 * with the price before the sale as the compare-at "was" price when `showWasPrice`; at the end the
 * old price and compare-at come back. A minute-by-minute job does the switching.
 *
 * Dashboard, /workspaces/:ws/price-schedules (read products.view, change products.manage):
 *   GET    /?status=        → { schedules: PriceSchedule[] } (newest start first, at most 200)
 *   POST   /preview  body   → PriceSchedulePreview — what the sale would do now (up to 500 variants shown)
 *   POST   /         body   → 201 { schedule } — with `items` once started: a start in the past starts at once
 *   GET    /:id             → { schedule } with `items`
 *   PUT    /:id      body   → { schedule } — only while `scheduled` (409 PRICE_SCHEDULE_LOCKED)
 *   POST   /:id/stop        → { schedule } — scheduled → cancelled; active → ended now, prices back;
 *                             anything else 409 PRICE_SCHEDULE_OVER
 * 422 VALIDATION_ERROR on `endsAt` (not after the start, or already past) and on `target.ids`
 * (not this store's; a collection target takes exactly one id).
 *
 * Every amount is integer minor units; prices in answers are sent as strings.
 */
import type { ApiClient } from "../client";

export type PriceScheduleStatus = "scheduled" | "active" | "ended" | "cancelled";
export const PRICE_SCHEDULE_STATUSES: readonly PriceScheduleStatus[] = ["scheduled", "active", "ended", "cancelled"];

export type PriceScheduleTargetType = "products" | "variants" | "collection";

export interface PriceScheduleTarget {
  type: PriceScheduleTargetType;
  /** 1–1000 ids of this store; exactly one for a collection. */
  ids: string[];
}

export type PriceChangeMode = "percent_off" | "amount_off" | "set_price";

export interface PriceScheduleChange {
  mode: PriceChangeMode;
  /** percent_off: 1–90. amount_off / set_price: minor units. */
  value: number;
}

/** The body of create, edit and preview. */
export interface PriceScheduleInput {
  /** 1–120 characters. */
  name: string;
  /** ISO date-time. */
  startsAt: string;
  /** ISO date-time after the start and in the future; null = no end. */
  endsAt: string | null;
  target: PriceScheduleTarget;
  change: PriceScheduleChange;
  /** While it runs, the price before the sale is the crossed-out "was" price. */
  showWasPrice: boolean;
}

/**
 * What happened to one variant: `applied` (on sale now), `restored` (its old price is back),
 * `kept` (the team changed the price during the sale, so it was left), `skipped` (already in
 * another running sale, or the sale changes nothing for it).
 */
export type PriceScheduleItemState = "applied" | "restored" | "kept" | "skipped";

export interface PriceScheduleItem {
  variantId: string;
  /** Null when the variant is gone. */
  productName: string | null;
  sku: string | null;
  options: Record<string, string> | null;
  oldPrice: string;
  newPrice: string;
  state: PriceScheduleItemState;
}

export interface PriceSchedule extends PriceScheduleInput {
  id: string;
  status: PriceScheduleStatus;
  /** When the prices changed. */
  appliedAt: string | null;
  /** When they went back. */
  revertedAt: string | null;
  createdAt: string;
  /** On GET /:id and on a save, once the sale has started. */
  items?: PriceScheduleItem[];
}

export interface PriceSchedulePreviewVariant {
  variantId: string;
  productName: string | null;
  sku: string | null;
  options: Record<string, string> | null;
  price: string;
  salePrice: string;
}

export interface PriceSchedulePreview {
  /** Every variant the sale reaches; `variants` holds the first 500. */
  total: number;
  variants: PriceSchedulePreviewVariant[];
}

export const PRICE_SCHEDULE_LIMITS = { name: 120, percentMin: 1, percentMax: 90, ids: 1000, previewShown: 500 } as const;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/price-schedules`;

export async function priceSchedulesList(client: ApiClient, workspaceId: string, status?: PriceScheduleStatus): Promise<PriceSchedule[]> {
  return (await client.request<{ schedules: PriceSchedule[] }>(`${base(workspaceId)}${status ? `?status=${status}` : ""}`)).schedules;
}

export async function priceScheduleGet(client: ApiClient, workspaceId: string, scheduleId: string): Promise<PriceSchedule> {
  return (await client.request<{ schedule: PriceSchedule }>(`${base(workspaceId)}/${scheduleId}`)).schedule;
}

/** What the sale would do to each variant now. */
export function priceSchedulePreview(client: ApiClient, workspaceId: string, body: PriceScheduleInput): Promise<PriceSchedulePreview> {
  return client.request<PriceSchedulePreview>(`${base(workspaceId)}/preview`, { method: "POST", body });
}

export async function priceScheduleCreate(client: ApiClient, workspaceId: string, body: PriceScheduleInput): Promise<PriceSchedule> {
  return (await client.request<{ schedule: PriceSchedule }>(base(workspaceId), { method: "POST", body })).schedule;
}

export async function priceScheduleUpdate(client: ApiClient, workspaceId: string, scheduleId: string, body: PriceScheduleInput): Promise<PriceSchedule> {
  return (await client.request<{ schedule: PriceSchedule }>(`${base(workspaceId)}/${scheduleId}`, { method: "PUT", body })).schedule;
}

/** Cancels a sale that has not started, or ends a running one now (the prices go back). */
export async function priceScheduleStop(client: ApiClient, workspaceId: string, scheduleId: string): Promise<PriceSchedule> {
  return (await client.request<{ schedule: PriceSchedule }>(`${base(workspaceId)}/${scheduleId}/stop`, { method: "POST" })).schedule;
}
