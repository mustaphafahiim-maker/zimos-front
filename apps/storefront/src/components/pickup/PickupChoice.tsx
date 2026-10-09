"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  checkoutPickupProblemOf,
  storefrontPickupLocations,
  type ApiClient,
  type PickupCheckoutFields,
  type StorefrontPickupLocation,
} from "@store-builder/api-client";
import { useFulfilmentCopy } from "@/lib/fulfilmentCopy";
import { pickupProblemText } from "@/lib/fulfilmentErrors";
import { arOrEn } from "@/lib/i18n";
import type { OrderFormFieldModes } from "@/lib/orderForm";
import { isKnownOff, rememberOff } from "@/lib/offFeatures";
import { pickupFormFields } from "@/lib/pickupForm";
import { useStore } from "@/lib/StoreContext";
import { TruckIcon } from "../Icons";
import { PickupPlaceIcon } from "./PickupCard";

// One read per store and set of variants at a time, however many times the effect runs.
const reading = new Map<string, Promise<StorefrontPickupLocation[] | null>>();

function readPlaces(client: ApiClient, workspaceId: string, variantKey: string): Promise<StorefrontPickupLocation[] | null> {
  const id = `${workspaceId}|${variantKey}`;
  let request = reading.get(id);
  if (!request) {
    request = storefrontPickupLocations(client, workspaceId, variantKey ? variantKey.split(",") : []).finally(() => reading.delete(id));
    reading.set(id, request);
  }
  return request;
}

/**
 * The checkout's «توصيل» / «استلام من الفرع» choice (handoff 225). The
 * store's pickup places are read from GET /store/:ws/pickup/locations for the
 * variants being bought (404 while the store offers none — then nothing is
 * drawn, and the checkout is the delivery checkout it always was). A place
 * that does not hold every item is listed, off, as «مش متوفر هنا».
 *
 *   const pickup = usePickupChoice({ client, workspaceId, variantIds, fields: storeFields });
 *   const fields = pickup.fields;                  // the store's form, without the address for a pickup
 *   if (pickup.check()) return;                    // pickup chosen, no place yet
 *   payload = { ...payload, ...pickup.payload };   // pickupLocationId; the API drops the address
 *   const refused = pickup.onError(err);           // the shopper's words; the places are read again
 *   <PickupChoice state={pickup} idPrefix="checkout" />
 *
 * While `isPickup`: the address form is not shown and not required, shipping
 * is free (`freeLabel`, «مجانًا») and the shipping option does not apply.
 */
export function usePickupChoice({
  client,
  workspaceId,
  variantIds,
  fields,
}: {
  client: ApiClient;
  workspaceId: string;
  variantIds: readonly string[];
  /** The store's purchase form (lib/useOrderFormFields); it comes back as `fields`, shortened for a pickup. */
  fields: OrderFormFieldModes;
}) {
  const copy = useFulfilmentCopy();
  // One request per set of variants, whatever order the lines are in.
  const key = [...new Set(variantIds)].sort().join(",");
  const [locations, setLocations] = useState<StorefrontPickupLocation[] | null>(null);
  const [mode, setMode] = useState<"delivery" | "pickup">("delivery");
  const [picked, setPicked] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [reads, setReads] = useState(0);

  useEffect(() => {
    // A store just seen without pickup is not asked again for a few minutes — unless an order was refused (reads > 0).
    if (reads === 0 && isKnownOff("pickup", workspaceId)) return;
    let cancelled = false;
    readPlaces(client, workspaceId, key)
      .then((list) => {
        rememberOff("pickup", workspaceId, list === null);
        if (!cancelled) setLocations(list);
      })
      .catch(() => {
        /* no pickup choice this time: the checkout delivers, as before */
      });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId, key, reads]);

  const reload = useCallback(() => setReads((n) => n + 1), []);

  const offered = locations !== null && locations.length > 0;
  const isPickup = offered && mode === "pickup";
  const usable = (locations ?? []).filter((l) => l.available !== false);
  // The one place a shopper can pick up from is chosen for them.
  const chosen = isPickup ? (usable.find((l) => l.id === picked) ?? (usable.length === 1 ? usable[0] : null)) : null;
  const anchorId = "pickup-choice";
  // The same object while nothing changes: the form's own hooks key on it.
  const formFields = useMemo(() => (isPickup ? pickupFormFields(fields) : fields), [isPickup, fields]);

  const payload: PickupCheckoutFields = chosen ? { pickupLocationId: chosen.id } : {};

  /** Before the order is sent: the shopper's words when pickup is chosen without a place (the choice takes focus), else null. */
  function check(): string | null {
    if (!isPickup || chosen) return null;
    const message = usable.length === 0 ? copy.pickupNowhere : copy.pickupChoosePlace;
    setProblem(message);
    const el = typeof document !== "undefined" ? document.getElementById(anchorId) : null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector<HTMLElement>("input:not(:disabled)")?.focus({ preventScroll: true });
    return message;
  }

  /** After a refused order: the shopper's words for a pickup refusal (the places are read again), or null when it was something else. */
  function onError(err: unknown): string | null {
    const refusal = checkoutPickupProblemOf(err);
    if (!refusal) return null;
    const message = pickupProblemText(refusal, copy);
    setPicked("");
    setProblem(message);
    reload();
    return message;
  }

  return {
    offered,
    locations: locations ?? [],
    mode: isPickup ? ("pickup" as const) : ("delivery" as const),
    isPickup,
    locationId: chosen ? chosen.id : "",
    chooseMode(next: "delivery" | "pickup") {
      setMode(next);
      setProblem(null);
    },
    choosePlace(id: string) {
      setPicked(id);
      setProblem(null);
    },
    /** The purchase form as this order needs it: the store's, without the address fields for a pickup. */
    fields: formFields,
    payload,
    /** What the summary's shipping row says for a pickup («مجانًا»); null for a delivery. */
    freeLabel: isPickup ? copy.pickupFree : null,
    check,
    onError,
    problem,
    reload,
    anchorId,
  };
}

export type PickupChoiceState = ReturnType<typeof usePickupChoice>;

const option = (checked: boolean, disabled = false) =>
  `flex min-h-14 items-start gap-3 rounded-xl border-2 px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
    disabled
      ? "cursor-not-allowed border-line bg-paper"
      : checked
        ? "cursor-pointer border-primary bg-primary-soft"
        : "cursor-pointer border-line bg-paper-raised hover:border-primary/50"
  }`;

/**
 * «توصيل» or «استلام من الفرع», and for a pickup the list of places — address,
 * hours and how to collect — with the ones that do not hold every item off as
 * «مش متوفر هنا». No address form is needed for a pickup; the checkout hides
 * its own (see usePickupChoice).
 */
export function PickupChoice({ state, idPrefix = "checkout", className = "" }: { state: PickupChoiceState; idPrefix?: string; className?: string }) {
  const { locale } = useStore();
  const copy = useFulfilmentCopy();
  if (!state.offered) return null;
  const lang = arOrEn(locale);
  const text = (value: { ar?: string; en?: string } | null | undefined) => (value?.[lang] || value?.[lang === "ar" ? "en" : "ar"] || "").trim();
  const problemId = `${idPrefix}-pickup-problem`;

  return (
    <div id={state.anchorId} className={`scroll-mt-24 ${className}`}>
      <fieldset aria-describedby={state.problem ? problemId : undefined}>
        <legend className="mb-2 text-sm font-semibold text-ink">{copy.howTitle}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["delivery", "pickup"] as const).map((mode) => {
            const checked = state.mode === mode;
            const Icon = mode === "delivery" ? TruckIcon : PickupPlaceIcon;
            return (
              <label key={mode} htmlFor={`${idPrefix}-how-${mode}`} className={option(checked)}>
                <input
                  id={`${idPrefix}-how-${mode}`}
                  type="radio"
                  name={`${idPrefix}-how`}
                  value={mode}
                  checked={checked}
                  onChange={() => state.chooseMode(mode)}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <Icon className="mt-0.5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{mode === "delivery" ? copy.delivery : copy.pickup}</span>
                  <span className="block text-xs text-ink-soft">{mode === "delivery" ? copy.deliveryHint : copy.pickupHint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {state.isPickup && (
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-semibold text-ink">{copy.pickupPlaces}</legend>
          <div className="space-y-2">
            {state.locations.map((place) => {
              const off = place.available === false;
              const checked = !off && state.locationId === place.id;
              const hours = text(place.hours);
              const how = text(place.instructions);
              return (
                <label key={place.id} htmlFor={`${idPrefix}-place-${place.id}`} className={option(checked, off)}>
                  <input
                    id={`${idPrefix}-place-${place.id}`}
                    type="radio"
                    name={`${idPrefix}-place`}
                    value={place.id}
                    checked={checked}
                    disabled={off}
                    onChange={() => state.choosePlace(place.id)}
                    className="mt-1 size-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-semibold ${off ? "text-ink-soft" : "text-ink"}`}>{place.name}</span>
                      {off && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">{copy.pickupUnavailableHere}</span>}
                    </span>
                    {place.address && <span className="mt-0.5 block text-sm text-ink-soft">{place.address}</span>}
                    {hours && (
                      <span className="mt-0.5 block text-xs text-ink-soft">
                        <span className="font-medium">{copy.pickupHours}:</span> {hours}
                      </span>
                    )}
                    {how && !off && <span className="mt-0.5 block text-xs text-ink-soft">{how}</span>}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-soft">{copy.pickupNoAddress}</p>
        </fieldset>
      )}

      <div id={problemId} role="alert" aria-live="assertive" className="empty:hidden">
        {state.problem && <p className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{state.problem}</p>}
      </div>
    </div>
  );
}
