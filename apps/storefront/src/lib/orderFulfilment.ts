import { deliverySlotOf, orderPickupOf, type OrderDeliverySlot, type OrderPickupPlace, type PickupPlace } from "@store-builder/api-client";

/**
 * What the checkout's answer says about how the order reaches the shopper,
 * kept on this device for the thank-you page and the tracking page — like the
 * order's snapshot (lib/commerce) and its buy notes (lib/buyInfo):
 *
 *   deliverySlot   the day and time slot chosen (handoff 221) — on the order
 *                  itself, `shippingSnapshot.deliverySlot`;
 *   pickupPlace    the place a click-and-collect order is collected from
 *                  (handoff 225) — on the order, `shippingSnapshot.pickup`;
 *   pickup         its code and the place's hours and instructions — beside
 *                  the order in the answer (`pickup`), shown once;
 *   trackingToken  the order's signed token, the shopper's proof when the
 *                  pickup's state is read again later.
 *
 * `saveOrderFulfilment` takes the checkout's answer (lib/placeOrder and
 * lib/payments call it for every order placed). What is saved for an order
 * is added to, never dropped; an order with none of the above is kept as
 * such, which tells the tracking page it is an ordinary delivery.
 */
export interface OrderFulfilmentNotes {
  orderId: string;
  deliverySlot?: OrderDeliverySlot | null;
  pickupPlace?: OrderPickupPlace | null;
  pickup?: { code: string; location: PickupPlace } | null;
  trackingToken?: string | null;
}

/** The parts of the checkout's 201 this reads. */
export interface FulfilmentCheckoutAnswer {
  order: { id: string; shippingSnapshot?: unknown };
  pickup?: { code?: unknown; location?: unknown } | null;
  trackingToken?: unknown;
}

const key = (workspaceId: string) => `zimos_order_fulfilment_${workspaceId}`;
const KEPT = 20;

function readAll(workspaceId: string): OrderFulfilmentNotes[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(workspaceId));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as OrderFulfilmentNotes[]) : [];
  } catch {
    return [];
  }
}

function readPickup(value: FulfilmentCheckoutAnswer["pickup"]): OrderFulfilmentNotes["pickup"] {
  const location = value?.location as Partial<PickupPlace> | null | undefined;
  if (!value || typeof value.code !== "string" || !location || typeof location !== "object" || typeof location.name !== "string") return null;
  return {
    code: value.code,
    location: {
      id: typeof location.id === "string" ? location.id : "",
      name: location.name,
      address: typeof location.address === "string" && location.address ? location.address : null,
      instructions: location.instructions ?? null,
      hours: location.hours ?? null,
    },
  };
}

export function saveOrderFulfilment(workspaceId: string, answer: FulfilmentCheckoutAnswer | null | undefined): void {
  if (typeof window === "undefined" || !answer?.order?.id) return;
  const orderId = answer.order.id;
  const deliverySlot = deliverySlotOf(answer.order);
  const pickupPlace = orderPickupOf(answer.order);
  const pickup = readPickup(answer.pickup);
  const trackingToken = typeof answer.trackingToken === "string" && answer.trackingToken ? answer.trackingToken : null;
  // An ordinary delivery is kept too, with nothing in it: the tracking page then knows, on this
  // device, that the order is not a pickup and does not ask the API about one (it would answer 404).
  try {
    const all = readAll(workspaceId);
    const known = all.find((n) => n.orderId === orderId);
    const next: OrderFulfilmentNotes = {
      orderId,
      deliverySlot: deliverySlot ?? known?.deliverySlot ?? null,
      pickupPlace: pickupPlace ?? known?.pickupPlace ?? null,
      pickup: pickup ?? known?.pickup ?? null,
      trackingToken: trackingToken ?? known?.trackingToken ?? null,
    };
    window.localStorage.setItem(key(workspaceId), JSON.stringify([next, ...all.filter((n) => n.orderId !== orderId)].slice(0, KEPT)));
  } catch {
    /* storage disabled: the thank-you page simply says less */
  }
}

export function getOrderFulfilment(workspaceId: string, orderId: string | null | undefined): OrderFulfilmentNotes | null {
  if (!orderId) return null;
  return readAll(workspaceId).find((n) => n.orderId === orderId) ?? null;
}
