/**
 * Delivery date and time slots (backend src/modules/deliverySlots; frontend-handoff 221).
 *
 * Staff, /workspaces/:ws/delivery-slots (read orders.view, save workspace.manage):
 *   GET /               → DeliverySlotSettings
 *   PUT /                 DeliverySlotSettings → the saved settings
 *       `weekly` keys "0"–"6" (0 = Sunday), at most 12 slots a day, `from` / `to` "HH:MM" in the
 *       store's own time with `to` after `from` (422 on `weekly.<day>.<i>.to`); `capacity`
 *       1–10000 or null (no limit). A slot sent without an `id` is given one: send the ids back
 *       unchanged on later saves, so the orders booked into a slot keep pointing at it.
 *   GET /schedule?from=YYYY-MM-DD&to=YYYY-MM-DD (62 days at most) → { days }
 *       Only the days and slots that hold an order; cancelled orders are left out.
 *   PUT /orders/:orderId (orders.manage) { date, slotId, force? } | { date: null } → { deliverySlot }
 *       409 DELIVERY_SLOT_FULL unless `force`; 422 on `slotId` when that weekday has no such slot.
 *       The team's move is not held to the lead days, the horizon or the closed days.
 *
 * Shopper:
 *   GET /store/:ws/delivery-slots → 404 while off, else StorefrontDeliverySlots (only days that
 *       have a slot; a full slot comes back `available: false`).
 *   Checkout body `deliverySlot: { date, slotId }`. 422 on `deliverySlot` when the store needs one
 *       (or offers none); 409 DELIVERY_SLOT_UNAVAILABLE; 409 DELIVERY_SLOT_FULL.
 *   The order carries `shippingSnapshot.deliverySlot = { date, slotId, from, to }`.
 *
 * All exported names are prefixed `deliverySlot` / `DeliverySlot` / `DELIVERY_SLOT`.
 */
import { ApiError, type ApiClient } from "../client";
import { apiFieldProblems, isApiErrorCode } from "../errors";

// ---------------------------------------------------------------- staff --

/** One slot of a weekday. Times are "HH:MM" in the store's own time zone. */
export interface DeliverySlot {
  /** Given by the API on the first save; kept as it is afterwards. */
  id?: string;
  from: string;
  to: string;
  /** Orders the slot takes on one date; null = no limit. */
  capacity: number | null;
}

/** 0 = Sunday … 6 = Saturday, as the API keys the week. */
export type DeliverySlotWeekday = "0" | "1" | "2" | "3" | "4" | "5" | "6";

export const DELIVERY_SLOT_WEEKDAYS: readonly DeliverySlotWeekday[] = ["0", "1", "2", "3", "4", "5", "6"];

export interface DeliverySlotNote {
  ar?: string;
  en?: string;
}

export interface DeliverySlotSettings {
  enabled: boolean;
  /** The checkout refuses an order without a slot. */
  required: boolean;
  /** The earliest day offered: 0 = today, 1 = tomorrow… */
  leadDays: number;
  /** "HH:MM" store time: after it the earliest day moves one day later. null = none. */
  cutoffTime: string | null;
  /** A slot today is offered only when it starts at least this many minutes from now. */
  sameDayNoticeMinutes: number;
  /** How many days ahead the shopper may choose. */
  horizonDays: number;
  weekly: Partial<Record<DeliverySlotWeekday, DeliverySlot[]>>;
  /** "YYYY-MM-DD" days with no delivery. */
  closedDates: string[];
  note: DeliverySlotNote | null;
}

/** The API's bounds. */
export const DELIVERY_SLOT_PER_DAY_MAX = 12;
export const DELIVERY_SLOT_CAPACITY_MAX = 10000;
export const DELIVERY_SLOT_LEAD_DAYS_MAX = 30;
export const DELIVERY_SLOT_HORIZON_DAYS_MAX = 60;
export const DELIVERY_SLOT_NOTICE_MINUTES_MAX = 1440;
export const DELIVERY_SLOT_CLOSED_DATES_MAX = 366;
export const DELIVERY_SLOT_NOTE_MAX = 300;
export const DELIVERY_SLOT_SCHEDULE_DAYS_MAX = 62;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/delivery-slots`;

export function deliverySlotSettingsGet(client: ApiClient, workspaceId: string): Promise<DeliverySlotSettings> {
  return client.request<DeliverySlotSettings>(base(workspaceId));
}

export function deliverySlotSettingsSave(client: ApiClient, workspaceId: string, body: DeliverySlotSettings): Promise<DeliverySlotSettings> {
  return client.request<DeliverySlotSettings>(base(workspaceId), { method: "PUT", body });
}

export interface DeliverySlotScheduleOrder {
  id: string;
  orderNumber: string;
  /** Minor units, as a string. */
  totalAmount: string;
  currency: string;
  customerName: string | null;
}

export interface DeliverySlotScheduleSlot {
  slotId: string;
  from: string;
  to: string;
  orders: DeliverySlotScheduleOrder[];
}

export interface DeliverySlotScheduleDay {
  /** "YYYY-MM-DD". */
  date: string;
  slots: DeliverySlotScheduleSlot[];
}

/** The orders booked per day and slot between two days ("YYYY-MM-DD", 62 days at most). */
export async function deliverySlotSchedule(client: ApiClient, workspaceId: string, from: string, to: string): Promise<DeliverySlotScheduleDay[]> {
  const { days } = await client.request<{ days: DeliverySlotScheduleDay[] }>(`${base(workspaceId)}/schedule?from=${from}&to=${to}`);
  return Array.isArray(days) ? days : [];
}

/** The day and slot an order was placed with (`shippingSnapshot.deliverySlot`). */
export interface OrderDeliverySlot {
  /** "YYYY-MM-DD". */
  date: string;
  slotId: string;
  from: string;
  to: string;
}

/**
 * Moves an order to another day and slot, or — with `null` — takes its slot off.
 * A full slot answers 409 DELIVERY_SLOT_FULL unless `force` is sent.
 */
export async function deliverySlotMoveOrder(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  choice: { date: string; slotId: string; force?: boolean } | null
): Promise<OrderDeliverySlot | null> {
  const { deliverySlot } = await client.request<{ deliverySlot: OrderDeliverySlot | null }>(`${base(workspaceId)}/orders/${orderId}`, {
    method: "PUT",
    body: choice ? { date: choice.date, slotId: choice.slotId, ...(choice.force ? { force: true } : {}) } : { date: null },
  });
  return readSlot(deliverySlot);
}

/** 409 DELIVERY_SLOT_FULL: the slot holds as many orders as it takes (checkout, or a staff move without `force`). */
export function isDeliverySlotFull(err: unknown): boolean {
  return isApiErrorCode(err, "DELIVERY_SLOT_FULL");
}

function readSlot(value: unknown): OrderDeliverySlot | null {
  const s = value as Partial<OrderDeliverySlot> | null | undefined;
  return s && typeof s === "object" && typeof s.date === "string" && typeof s.from === "string" && typeof s.to === "string"
    ? { date: s.date.slice(0, 10), slotId: typeof s.slotId === "string" ? s.slotId : "", from: s.from, to: s.to }
    : null;
}

/**
 * The delivery day and slot carried by an order (`shippingSnapshot.deliverySlot`) or by an answer
 * that names it at the top (`deliverySlot`); null when there is none.
 */
export function deliverySlotOf(source: unknown): OrderDeliverySlot | null {
  if (!source || typeof source !== "object") return null;
  const s = source as { deliverySlot?: unknown; shippingSnapshot?: { deliverySlot?: unknown } | null };
  return readSlot(s.deliverySlot) ?? readSlot(s.shippingSnapshot?.deliverySlot);
}

// -------------------------------------------------------------- shopper --

export interface StorefrontDeliverySlot {
  id: string;
  from: string;
  to: string;
  /** false once the slot is fully booked for that day: shown, but not selectable. */
  available: boolean;
}

export interface StorefrontDeliveryDay {
  /** "YYYY-MM-DD", in the store's calendar. */
  date: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  slots: StorefrontDeliverySlot[];
}

export interface StorefrontDeliverySlots {
  /** The checkout refuses an order without a slot. */
  required: boolean;
  note: DeliverySlotNote | null;
  /** The store's time zone (the days and times are in it). */
  timezone: string;
  days: StorefrontDeliveryDay[];
}

/** The days and slots on offer now; null while the store offers none (404). Never cached by the API. */
export async function storefrontDeliverySlots(client: ApiClient, workspaceRef: string): Promise<StorefrontDeliverySlots | null> {
  try {
    const view = await client.request<StorefrontDeliverySlots>(`/store/${workspaceRef}/delivery-slots`, { auth: false });
    if (!view || !Array.isArray(view.days)) return null;
    return { required: view.required === true, note: view.note ?? null, timezone: view.timezone ?? "", days: view.days };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** What the checkout body gains. */
export interface DeliverySlotCheckoutFields {
  deliverySlot?: { date: string; slotId: string };
}

/**
 * Why a checkout was refused over its delivery slot:
 *   required     422 on `deliverySlot` — the store needs one and none was sent
 *   not_offered  422 on `deliverySlot` — the store stopped offering slots
 *   unavailable  409 DELIVERY_SLOT_UNAVAILABLE — that day or slot is no longer on offer
 *   full         409 DELIVERY_SLOT_FULL — the last place was just taken
 * null for any other error. After every one of them the slots should be read again.
 */
export type DeliverySlotProblem = "required" | "not_offered" | "unavailable" | "full";

export function checkoutDeliverySlotProblemOf(err: unknown): DeliverySlotProblem | null {
  if (isApiErrorCode(err, "DELIVERY_SLOT_FULL")) return "full";
  if (isApiErrorCode(err, "DELIVERY_SLOT_UNAVAILABLE")) return "unavailable";
  const problem = apiFieldProblems(err).find((p) => p.field === "deliverySlot" || p.field.startsWith("deliverySlot."));
  if (!problem) return null;
  return /does not offer/i.test(problem.message) ? "not_offered" : "required";
}
