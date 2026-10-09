"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deliverySlotOf,
  orderSelfServiceOrderId,
  orderTrackingExtras,
  storefrontPickupOrder,
  type OrderDeliverySlot,
  type PickupOrderProof,
  type StorefrontPickup,
  type TrackResult,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useFulfilmentCopy } from "@/lib/fulfilmentCopy";
import { slotDayText, slotTimeText } from "@/lib/fulfilmentDates";
import { getOrderFulfilment } from "@/lib/orderFulfilment";
import { readToken } from "@/lib/shopperSession";
import { getTrackingToken } from "@/lib/trackingTokens";
import { useStore } from "@/lib/StoreContext";
import { useIsClient } from "@/lib/useIsClient";
import { TruckIcon } from "../Icons";
import { PickupCard, PickupPlaceIcon, type PickupCardData } from "../pickup/PickupCard";
import { card } from "../ui";

const api = createStorefrontApiClient();

/** «هيوصلك يوم الخميس 9 أكتوبر بين 10:00 و 14:00» — or, for a pickup, the day and time to collect. */
function useSlotSentence(slot: OrderDeliverySlot | null | undefined, pickup: boolean): string {
  const { intlLocale } = useStore();
  const copy = useFulfilmentCopy();
  if (!slot) return "";
  const day = slotDayText(slot.date, intlLocale);
  if (!day) return "";
  const from = slotTimeText(slot.from, intlLocale);
  const to = slotTimeText(slot.to, intlLocale);
  return pickup ? copy.collectOn(day, from, to) : copy.arriving(day, from, to);
}

// Orders the API said are not pickups (it answers 404 for them): not asked about again while the page lives.
const notPickups = new Set<string>();
// One request per order and state at a time, however many times the effect runs.
const asking = new Map<string, Promise<StorefrontPickup | null>>();

/** The pickup of one order, read from the API with the shopper's proof; null until it answers, or when the order is not a pickup. */
function usePickup(workspaceId: string, orderId: string | null, proof: PickupOrderProof | null, refreshKey = ""): StorefrontPickup | null {
  const [answer, setAnswer] = useState<{ key: string; pickup: StorefrontPickup | null } | null>(null);
  const proofKey = proof ? ("token" in proof ? `t:${proof.token}` : `s:${proof.shopperToken}`) : "";
  const key = orderId && proofKey ? `${workspaceId}|${orderId}|${proofKey}|${refreshKey}` : "";
  useEffect(() => {
    if (!key || !orderId || !proof || notPickups.has(orderId)) return;
    let cancelled = false;
    let request = asking.get(key);
    if (!request) {
      request = storefrontPickupOrder(api, workspaceId, orderId, proof).finally(() => asking.delete(key));
      asking.set(key, request);
    }
    request
      .then((pickup) => {
        if (!pickup) notPickups.add(orderId);
        if (!cancelled) setAnswer({ key, pickup });
      })
      // Not readable right now: the page shows what it already has.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // `proof` is named by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, workspaceId, orderId]);
  return answer && answer.key === key ? answer.pickup : null;
}

/**
 * Thank-you page: how this order reaches the shopper, from what the checkout
 * answered on this device (lib/orderFulfilment) —
 *   the delivery day and slot (handoff 221): «هيوصلك يوم … بين … و …»;
 *   a click-and-collect order (handoff 225): the pickup code in large digits,
 *   the place with its hours and instructions, and how far the pickup is —
 *   read again from the API, so a reopened page shows «جاهز للاستلام».
 * Nothing for an order that has neither.
 */
export function ThankYouFulfilment({ workspaceId, orderId }: { workspaceId: string; orderId: string }) {
  const { store } = useStore();
  const copy = useFulfilmentCopy();
  // localStorage, read once hydrated so the server and the first render agree.
  const isClient = useIsClient();
  const saved = useMemo(() => (isClient ? getOrderFulfilment(workspaceId, orderId) : null), [isClient, workspaceId, orderId]);
  const isPickup = Boolean(saved?.pickup || saved?.pickupPlace);
  // The order's own token, kept from the checkout's answer (lib/trackingTokens); a signed-in shopper's account otherwise.
  const proof = useMemo<PickupOrderProof | null>(() => {
    if (!isPickup) return null;
    const token = getTrackingToken(workspaceId, orderId) ?? saved?.trackingToken;
    if (token) return { token };
    const shopperToken = readToken(store?.id ?? "");
    return shopperToken ? { shopperToken } : null;
  }, [isPickup, workspaceId, orderId, saved?.trackingToken, store?.id]);
  const live = usePickup(workspaceId, isPickup ? orderId : null, proof);
  // A pickup already collected (or cancelled) has no day and time left to come for.
  const over = live?.status === "collected" || live?.status === "cancelled";
  const sentence = useSlotSentence(over ? null : saved?.deliverySlot, isPickup);

  if (!saved) return null;
  const pickup: PickupCardData | null = live
    ? { status: live.status, code: live.code, location: live.location }
    : saved.pickup
      ? { status: "pending", code: saved.pickup.code, location: saved.pickup.location }
      : null;
  if (!sentence && !pickup && !saved.pickupPlace) return null;

  return (
    <>
      {pickup ? (
        <PickupCard pickup={pickup} className="mt-6" />
      ) : saved.pickupPlace ? (
        // The place alone, when neither the code nor a proof to ask for it is on this device.
        <section className={`${card} mt-6 p-5 text-sm`}>
          <p className="flex items-start gap-2">
            <PickupPlaceIcon size={18} className="mt-0.5 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-ink-soft">{copy.pickupFrom}</span>
              <span className="font-semibold text-ink">{saved.pickupPlace.name}</span>
              {saved.pickupPlace.address && <span className="block text-ink-soft">{saved.pickupPlace.address}</span>}
            </span>
          </p>
        </section>
      ) : null}
      {sentence && (
        <section className={`${card} mt-6 p-5 text-sm`}>
          <p className="flex items-start gap-2">
            {isPickup ? <PickupPlaceIcon size={18} className="mt-0.5 shrink-0 text-primary" /> : <TruckIcon size={18} className="mt-0.5 shrink-0 text-primary" />}
            <span className="font-semibold text-ink">{sentence}</span>
          </p>
        </section>
      )}
    </>
  );
}

/**
 * Order tracking: the same two things for the order on screen.
 *   The delivery day and slot — from the tracking answer when the API sends
 *   it, else from what this device kept when it placed the order — while the
 *   order is still on its way.
 *   A click-and-collect order's code, place and state, asked from the API
 *   with the order's own tracking token (nothing for a delivered order: 404).
 */
export function TrackOrderFulfilment({ result, workspaceId }: { result: TrackResult; workspaceId: string }) {
  const { trackingToken, state, shipment } = orderTrackingExtras(result);
  const token = trackingToken ?? null;
  const orderId = token ? orderSelfServiceOrderId(token) : null;
  const isClient = useIsClient();
  const saved = useMemo(() => (isClient ? getOrderFulfilment(workspaceId, orderId) : null), [isClient, workspaceId, orderId]);
  const proof = useMemo<PickupOrderProof | null>(() => (token ? { token } : null), [token]);
  // The tracking answer does not say whether the order is a pickup, and the pickup call answers 404
  // for one that is not — so it is only asked where a pickup is possible: this device placed it as
  // one, or — for an order this device knows nothing about — it paid no shipping and no courier
  // has it (both always true of a pickup). An order this device placed as a delivery is not asked about.
  const maybePickup = saved ? Boolean(saved.pickup || saved.pickupPlace) : Number(result.shippingAmount) === 0 && !shipment;
  // Asked again whenever the order moves (a refresh after "ready", a cancellation).
  const pickup = usePickup(workspaceId, maybePickup ? orderId : null, proof, `${result.stage}:${result.updatedAt ?? ""}:${state ?? ""}`);
  const slot = deliverySlotOf(result) ?? saved?.deliverySlot ?? null;
  const moving = result.stage < 3 && (!state || state === "active");
  const sentence = useSlotSentence(moving ? slot : null, Boolean(pickup));

  if (!sentence && !pickup) return null;
  return (
    <>
      {sentence && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-primary-soft px-3.5 py-2.5 text-sm">
          {pickup ? <PickupPlaceIcon size={18} className="mt-0.5 shrink-0 text-primary" /> : <TruckIcon size={18} className="mt-0.5 shrink-0 text-primary" />}
          <span className="font-semibold text-ink">{sentence}</span>
        </p>
      )}
      {pickup && <PickupCard pickup={{ status: pickup.status, code: pickup.code, location: pickup.location }} frame="plain" className="mt-6 border-t border-line pt-5" />}
    </>
  );
}
