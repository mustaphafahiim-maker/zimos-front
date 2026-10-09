"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkoutDeliverySlotProblemOf,
  storefrontDeliverySlots,
  type ApiClient,
  type DeliverySlotCheckoutFields,
  type StorefrontDeliverySlots,
} from "@store-builder/api-client";
import { useFulfilmentCopy } from "@/lib/fulfilmentCopy";
import { slotDayParts, slotDayText, slotTimeText } from "@/lib/fulfilmentDates";
import { deliverySlotProblemText } from "@/lib/fulfilmentErrors";
import { arOrEn } from "@/lib/i18n";
import { isKnownOff, rememberOff } from "@/lib/offFeatures";
import { useStore } from "@/lib/StoreContext";
import { card } from "../ui";

// One read per store at a time, however many times the effect runs.
const reading = new Map<string, Promise<StorefrontDeliverySlots | null>>();

function readSlots(client: ApiClient, workspaceId: string): Promise<StorefrontDeliverySlots | null> {
  let request = reading.get(workspaceId);
  if (!request) {
    request = storefrontDeliverySlots(client, workspaceId).finally(() => reading.delete(workspaceId));
    reading.set(workspaceId, request);
  }
  return request;
}

/**
 * The checkout's delivery day and time slot (handoff 221). The store's days
 * and slots are read fresh from GET /store/:ws/delivery-slots (never cached;
 * 404 while the store offers none — then nothing is drawn and nothing is
 * sent). The choice rides on the checkout as `deliverySlot: { date, slotId }`.
 *
 *   const slot = useDeliverySlot({ client, workspaceId });
 *   if (slot.check()) return;                 // before sending: a required slot not chosen yet
 *   payload = { ...payload, ...slot.payload };
 *   const refused = slot.onError(err);        // after a refusal: the shopper's words, slots read again
 *   <DeliverySlotPicker state={slot} idPrefix="checkout" />
 *
 * `requiredOnly`: a short form (the product page's own order form) shows the
 * picker only when the store refuses an order without a slot.
 * `lazy`: nothing is read until the shopper first touches the form the picker
 * sits in (the picker listens for that itself) — on a page most visitors only
 * look at, a store without slots is then not asked on every view.
 * `pickup`: the shopper collects the order in store — the picker then shows
 * only when the store requires a slot (the API asks for one on every order),
 * worded as the pickup day and time.
 */
export function useDeliverySlot({
  client,
  workspaceId,
  requiredOnly = false,
  lazy = false,
  pickup = false,
  enabled = true,
}: {
  client: ApiClient;
  workspaceId: string;
  requiredOnly?: boolean;
  lazy?: boolean;
  pickup?: boolean;
  /** false: the form is not on this page (no request is made). */
  enabled?: boolean;
}) {
  const copy = useFulfilmentCopy();
  const [view, setView] = useState<StorefrontDeliverySlots | null>(null);
  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [reads, setReads] = useState(0);
  const [started, setStarted] = useState(!lazy);
  const start = useCallback(() => setStarted(true), []);

  useEffect(() => {
    if (!enabled || !started) return;
    // A store just seen without slots is not asked again for a few minutes — unless an order was refused (reads > 0).
    if (reads === 0 && isKnownOff("delivery-slots", workspaceId)) return;
    let cancelled = false;
    readSlots(client, workspaceId)
      .then((next) => {
        rememberOff("delivery-slots", workspaceId, next === null);
        if (cancelled) return;
        setView(next);
      })
      .catch(() => {
        // Not known: the form goes on without the picker, and a store that needs a slot says so at checkout (onError then reads again).
      });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId, enabled, started, reads]);

  const reload = useCallback(() => {
    setStarted(true);
    setReads((n) => n + 1);
  }, []);

  const required = view?.required === true;
  // Shown where a choice means something: see `requiredOnly` and `pickup` above.
  const shown = Boolean(view) && (required || (!requiredOnly && !pickup));
  // A choice the fresh list no longer offers counts as none.
  const day = view?.days.find((d) => d.date === date) ?? null;
  const slot = day?.slots.find((s) => s.id === slotId && s.available) ?? null;
  const anchorId = "delivery-slot";

  const payload: DeliverySlotCheckoutFields = shown && day && slot ? { deliverySlot: { date: day.date, slotId: slot.id } } : {};

  /** Before the order is sent: the shopper's words when a required slot is missing (and the picker takes focus), else null. */
  function check(): string | null {
    if (!shown || !required || slot) return null;
    // Worded as the picker is titled: the pickup day and time for an order collected in store.
    const message = pickup ? copy.slotRequiredPickup : copy.slotRequired;
    setProblem(message);
    const el = typeof document !== "undefined" ? document.getElementById(anchorId) : null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector<HTMLElement>("input:not(:disabled)")?.focus({ preventScroll: true });
    return message;
  }

  /** After a refused order: the shopper's words for a slot refusal (the slots are read again), or null when it was something else. */
  function onError(err: unknown): string | null {
    const kind = checkoutDeliverySlotProblemOf(err);
    if (!kind) return null;
    const message = kind === "required" && pickup ? copy.slotRequiredPickup : deliverySlotProblemText(kind, copy);
    // The day stays; the slot that was refused does not.
    if (kind !== "required") setSlotId("");
    setProblem(message);
    reload();
    return message;
  }

  return {
    view,
    shown,
    required,
    pickup,
    date: day ? day.date : "",
    slotId: slot ? slot.id : "",
    chooseDay(next: string) {
      setDate(next);
      setSlotId("");
      setProblem(null);
    },
    chooseSlot(next: string) {
      setSlotId(next);
      setProblem(null);
    },
    clear() {
      setDate("");
      setSlotId("");
      setProblem(null);
    },
    payload,
    check,
    onError,
    problem,
    reload,
    /** A lazy picker that has not read the slots yet: `start` reads them. */
    waiting: enabled && !started,
    start,
    anchorId,
  };
}

export type DeliverySlotChoice = ReturnType<typeof useDeliverySlot>;

const chip = (selected: boolean, disabled: boolean) =>
  `zt-pill relative flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl border-2 px-3.5 py-1.5 text-center text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
    disabled
      ? "cursor-not-allowed border-line bg-paper text-ink-soft"
      : selected
        ? "border-primary bg-primary-soft text-primary"
        : "border-line bg-paper-raised text-ink hover:border-primary"
  }`;

/**
 * Day chips («الخميس 9 أكتوبر»), then that day's slot chips («10:00 – 14:00»);
 * a full one is off and says «محجوز». The store's note sits under them.
 * `frame="plain"` drops the card, for a form that is already inside one.
 */
export function DeliverySlotPicker({
  state,
  idPrefix = "checkout",
  frame = "card",
  className = "",
}: {
  state: DeliverySlotChoice;
  idPrefix?: string;
  frame?: "card" | "plain";
  className?: string;
}) {
  const { t, locale, intlLocale } = useStore();
  const copy = useFulfilmentCopy();
  const { view, waiting, start } = state;
  // A lazy picker reads the slots when its form is first touched.
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!waiting) return;
    const form = marker.current?.closest("form");
    if (!form) {
      start();
      return;
    }
    form.addEventListener("focusin", start, { once: true });
    return () => form.removeEventListener("focusin", start);
  }, [waiting, start]);
  if (!state.shown || !view) return waiting ? <span ref={marker} hidden /> : null;

  const titleId = `${idPrefix}-slot-title`;
  const problemId = `${idPrefix}-slot-problem`;
  const day = view.days.find((d) => d.date === state.date) ?? null;
  const note = (view.note?.[arOrEn(locale)] || view.note?.[arOrEn(locale) === "ar" ? "en" : "ar"] || "").trim();
  const title = state.pickup ? copy.slotTitlePickup : copy.slotTitle;

  return (
    <section
      id={state.anchorId}
      className={`${frame === "card" ? `${card} p-5 sm:p-6` : ""} scroll-mt-24 ${className}`}
      aria-labelledby={titleId}
      aria-describedby={state.problem ? problemId : undefined}
    >
      <h2 id={titleId} className={frame === "card" ? "text-lg font-semibold text-ink" : "text-sm font-semibold text-ink"}>
        {title}
        {state.required ? (
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
        ) : (
          <span className="ms-1 text-xs font-normal text-ink-soft">({t.common.optional})</span>
        )}
      </h2>

      {view.days.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft" role="status">
          {state.required ? copy.slotNoneRequired : copy.slotNone}
        </p>
      ) : (
        <>
          <fieldset className="mt-3">
            <legend className="mb-2 text-sm font-medium text-ink-soft">{copy.slotDay}</legend>
            <div className="flex flex-wrap gap-2">
              {view.days.map((d) => {
                const open = d.slots.some((s) => s.available);
                const selected = d.date === state.date;
                const parts = slotDayParts(d.date, intlLocale);
                return (
                  <label key={d.date} className={chip(selected, !open)}>
                    <input
                      type="radio"
                      name={`${idPrefix}-slot-day`}
                      value={d.date}
                      checked={selected}
                      disabled={!open}
                      aria-label={open ? slotDayText(d.date, intlLocale) : `${slotDayText(d.date, intlLocale)} — ${copy.slotFull}`}
                      onChange={() => state.chooseDay(d.date)}
                      className="sr-only"
                    />
                    <span className="font-semibold leading-tight">{parts.weekday}</span>
                    <span className="text-xs leading-tight">{open ? parts.day : copy.slotFull}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-medium text-ink-soft">{copy.slotTime}</legend>
            {!day ? (
              <p className="text-sm text-ink-soft">{copy.slotPickDay}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {day.slots.map((s) => {
                  const selected = s.id === state.slotId;
                  const range = copy.slotRange(slotTimeText(s.from, intlLocale), slotTimeText(s.to, intlLocale));
                  return (
                    <label key={s.id} className={chip(selected, !s.available)}>
                      <input
                        type="radio"
                        name={`${idPrefix}-slot-time`}
                        value={s.id}
                        checked={selected}
                        disabled={!s.available}
                        aria-label={s.available ? range : `${range} — ${copy.slotFull}`}
                        onChange={() => state.chooseSlot(s.id)}
                        className="sr-only"
                      />
                      <span className={`font-semibold tabular-nums leading-tight ${s.available ? "" : "line-through"}`}>{range}</span>
                      {!s.available && <span className="text-xs leading-tight">{copy.slotFull}</span>}
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          {!state.required && state.slotId && (
            <button type="button" onClick={state.clear} className="mt-2 min-h-11 cursor-pointer text-sm font-medium text-ink-soft underline hover:text-primary">
              {copy.slotClear}
            </button>
          )}
        </>
      )}

      {/* The store's note is about delivering: not said over a pickup's day and time. */}
      {note && !state.pickup && <p className="mt-3 text-sm text-ink-soft">{note}</p>}

      <div id={problemId} role="alert" aria-live="assertive" className="empty:hidden">
        {state.problem && <p className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{state.problem}</p>}
      </div>
    </section>
  );
}
