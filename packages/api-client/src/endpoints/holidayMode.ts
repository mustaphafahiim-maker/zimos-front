/**
 * Holiday mode (backend src/modules/holidayMode).
 *
 * Staff, /workspaces/:ws/holiday-mode:
 *   GET (orders.view)        → HolidayModeSettings (+ `activeNow`)
 *   PUT (workspace.manage)     HolidayModeInput → the saved settings
 *       Dates are ISO. `from: null` = from now, `until: null` = until switched off; `until` must
 *       be after `from` (422 on `until`). `message` texts up to 500 characters.
 *
 * While on (enabled, and now between `from` and `until`):
 *   pause — the store, the cart and every page keep working, but the checkout answers
 *           423 STORE_ON_HOLIDAY with `error.details.holiday` (the same object as `store.holiday`);
 *   delay — orders go through; each gets the tag `holiday` and
 *           `shippingSnapshot.holiday = { shipsFrom, message }`.
 * Orders the team enters in the dashboard are never refused.
 *
 * Shopper: GET /store/:ws → `store.holiday`, null while the store is open as usual.
 *
 * All exported names are prefixed `holiday` / `Holiday` / `HOLIDAY`.
 */
import type { ApiClient } from "../client";
import { apiErrorDetails, isApiErrorCode } from "../errors";

export type HolidayMode = "pause" | "delay";

export interface HolidayMessage {
  ar?: string;
  en?: string;
}

export interface HolidayModeInput {
  enabled: boolean;
  mode: HolidayMode;
  /** ISO; null = from now. */
  from?: string | null;
  /** ISO; null = until it is switched off. */
  until?: string | null;
  /** ISO; when orders taken during a "delay" holiday start shipping. null = the day it ends. */
  shipsFrom?: string | null;
  message?: HolidayMessage | null;
}

export interface HolidayModeSettings {
  enabled: boolean;
  mode: HolidayMode;
  from: string | null;
  until: string | null;
  shipsFrom: string | null;
  message: HolidayMessage | null;
  /** The holiday is in force right now (enabled, and inside its dates). */
  activeNow: boolean;
}

/** Each language's message, at most this long. */
export const HOLIDAY_MESSAGE_MAX = 500;

/** The tag an order placed during a "delay" holiday carries. */
export const HOLIDAY_ORDER_TAG = "holiday";

export function holidayModeGet(client: ApiClient, workspaceId: string): Promise<HolidayModeSettings> {
  return client.request<HolidayModeSettings>(`/workspaces/${workspaceId}/holiday-mode`);
}

export function holidayModeSave(client: ApiClient, workspaceId: string, body: HolidayModeInput): Promise<HolidayModeSettings> {
  return client.request<HolidayModeSettings>(`/workspaces/${workspaceId}/holiday-mode`, { method: "PUT", body });
}

// -------------------------------------------------------------- shopper --

/** The holiday in force, as the storefront sees it. */
export interface StorefrontHoliday {
  mode: HolidayMode;
  /** ISO; null when the store set no end. */
  until: string | null;
  /** ISO; when orders ship again (the holiday's end when the store set no date of its own). */
  shipsFrom: string | null;
  message: HolidayMessage | null;
}

function readHoliday(value: unknown): StorefrontHoliday | null {
  const h = value as Partial<StorefrontHoliday> | null | undefined;
  if (!h || typeof h !== "object" || (h.mode !== "pause" && h.mode !== "delay")) return null;
  const date = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const message = h.message && typeof h.message === "object" ? { ar: text(h.message.ar), en: text(h.message.en) } : null;
  return {
    mode: h.mode,
    until: date(h.until),
    shipsFrom: date(h.shipsFrom),
    message: message && (message.ar || message.en) ? message : null,
  };
}

/** `store.holiday` from GET /store/:ws, read defensively: an older API without it is an open store. */
export function storefrontHolidayOf(store: unknown): StorefrontHoliday | null {
  return readHoliday((store as { holiday?: unknown } | null | undefined)?.holiday);
}

/**
 * The checkout's 423 STORE_ON_HOLIDAY: the holiday it names (`error.details.holiday`), so the
 * page can say until when. `{ mode: "pause" }` with no dates when the answer carries none;
 * null for any other error.
 */
export function holidayRefusalOf(err: unknown): StorefrontHoliday | null {
  if (!isApiErrorCode(err, "STORE_ON_HOLIDAY")) return null;
  const named = readHoliday(apiErrorDetails<{ holiday?: unknown }>(err)?.holiday);
  return named ?? { mode: "pause", until: null, shipsFrom: null, message: null };
}

/** What an order placed during a "delay" holiday keeps (`shippingSnapshot.holiday`); null otherwise. */
export interface OrderHolidayNote {
  /** ISO; when the store said it ships again. */
  shipsFrom: string | null;
  message: HolidayMessage | null;
}

export function orderHolidayOf(order: unknown): OrderHolidayNote | null {
  const raw = (order as { shippingSnapshot?: { holiday?: unknown } | null } | null | undefined)?.shippingSnapshot?.holiday as
    | { shipsFrom?: unknown; message?: unknown }
    | null
    | undefined;
  if (!raw || typeof raw !== "object") return null;
  const shipsFrom = typeof raw.shipsFrom === "string" && !Number.isNaN(Date.parse(raw.shipsFrom)) ? raw.shipsFrom : null;
  const message = raw.message && typeof raw.message === "object" ? (raw.message as HolidayMessage) : null;
  return { shipsFrom, message };
}
