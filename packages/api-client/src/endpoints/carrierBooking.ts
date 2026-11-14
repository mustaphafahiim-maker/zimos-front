/**
 * How a connected courier books (backend: src/modules/shipping/carrierBooking.js).
 *
 * Mounted at PATCH /workspaces/:workspaceId/carriers/:code/booking
 * (shipping.manage). GET /carriers carries the same object on each
 * connection as `connection.booking`. All exported names are prefixed
 * `carrierBooking` / `CarrierBooking`.
 *
 * Automatic booking happens once an order is confirmed (`confirmed`) or paid
 * (`paid`), with the default courier (or the only one set to book on its
 * own), and is never retried: when it cannot book, the merchant gets a
 * notification linking to the order and books it by hand.
 */
import type { ApiClient } from "../client";

export type CarrierAutoCreateOn = "never" | "confirmed" | "paid";

export interface CarrierBooking {
  isDefault: boolean;
  autoCreateOn: CarrierAutoCreateOn;
  /** The customer may open the parcel before accepting it (passed to the courier). */
  allowInspection: boolean;
  /** Notes every booking carries for the courier, unless the booking brings its own. */
  courierNotes: string | null;
}

export type CarrierBookingPayload = Partial<CarrierBooking>;

/** The booking settings on a connection from GET /carriers (defaults when absent). */
export function carrierBookingOf(connection: unknown): CarrierBooking {
  const b = (connection && typeof connection === "object" ? (connection as { booking?: Partial<CarrierBooking> }).booking : null) ?? {};
  return {
    isDefault: Boolean(b.isDefault),
    autoCreateOn: b.autoCreateOn ?? "never",
    allowInspection: Boolean(b.allowInspection),
    courierNotes: b.courierNotes ?? null,
  };
}

export async function carrierBookingUpdate(
  client: ApiClient,
  workspaceId: string,
  carrierCode: string,
  payload: CarrierBookingPayload
): Promise<CarrierBooking & { carrierCode: string }> {
  const { booking } = await client.request<{ booking: CarrierBooking & { carrierCode: string } }>(
    `/workspaces/${workspaceId}/carriers/${encodeURIComponent(carrierCode)}/booking`,
    { method: "PATCH", body: payload }
  );
  return booking;
}
