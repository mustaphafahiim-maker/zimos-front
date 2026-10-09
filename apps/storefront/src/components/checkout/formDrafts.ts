"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { OrderFormField, OrderFormValues } from "@/lib/orderForm";

/**
 * What the shopper is typing right now, kept out of the page's state.
 *
 * The checkout page holds the order form's values, and a dozen things hang
 * on them: the shipping quote, the store's places, the saved addresses, the
 * deposit check, the progress steps. Setting them on every keystroke redraws
 * all of that for each letter of a name. So a field that is typed in keeps
 * its own text here while the shopper types:
 *
 *   - the keystroke goes to `type()`: the field (and only the field) redraws
 *     with it at once — it reads `useDraft()`;
 *   - once typing pauses (`delayMs`), or the field is left, or the order
 *     button is pressed, the text is handed to the form (`connect`) and the
 *     page's values follow, exactly as if it had been typed in one go;
 *   - when the values have caught up (`settle`), the draft is let go.
 *
 * A draft always wins over the form's value for its field while it exists,
 * so a hand-over that lands a moment after another keystroke can never put
 * older text back into the box. Nothing is ever lost on the way to an order:
 * `merge()` gives the values with whatever is still being typed laid over
 * them, and the page reads that when the order is placed.
 *
 * A form that does not pass drafts to <OrderFormFields> (the product page's
 * quick form, a funnel's checkout) works as it always did.
 */
export interface OrderFormDrafts {
  /** A field's text as typed, while it runs ahead of the form's value; undefined otherwise. */
  get(field: OrderFormField): string | undefined;
  subscribe(field: OrderFormField, listener: () => void): () => void;
  /** A keystroke: shown in its field at once, handed to the form after a pause. */
  type(field: OrderFormField, value: string): void;
  /** Hands over now what was typed since the last hand-over (a field left, a finished number, the order button). */
  flush(): void;
  /** The values with what is still being typed laid over them — what the shopper sees in the boxes. */
  merge(values: OrderFormValues): OrderFormValues;
  /** The same, as an object that reads the freshest text each time a field of it is read (for code that looks later). */
  live(values: OrderFormValues): OrderFormValues;
  /** The form set this field itself (a picked place, a saved address): what was being typed there gives way to it. */
  override(field: OrderFormField, value: string): void;
  /** After the form's values changed: the drafts they caught up with are let go. */
  settle(values: OrderFormValues): void;
  /** Where the typed text is handed to — the page's own setter. Returns the disconnect. */
  connect(receive: (typed: Partial<OrderFormValues>) => void): () => void;
}

/** How long typing pauses before the page's values follow. Leaving the field does not wait for it. */
const HAND_OVER_MS = 250;

export function createOrderFormDrafts(delayMs = HAND_OVER_MS): OrderFormDrafts {
  const drafts = new Map<OrderFormField, string>();
  const listeners = new Map<OrderFormField, Set<() => void>>();
  /** The fields typed in since the last hand-over. */
  const waiting = new Set<OrderFormField>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let receive: ((typed: Partial<OrderFormValues>) => void) | null = null;

  function tell(field: OrderFormField) {
    const set = listeners.get(field);
    if (set) for (const listener of Array.from(set)) listener();
  }

  function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (waiting.size === 0 || !receive) return;
    const typed: Partial<OrderFormValues> = {};
    for (const field of waiting) {
      const text = drafts.get(field);
      if (text !== undefined) typed[field] = text;
    }
    waiting.clear();
    receive(typed);
  }

  return {
    get: (field) => drafts.get(field),

    subscribe(field, listener) {
      let set = listeners.get(field);
      if (!set) {
        set = new Set();
        listeners.set(field, set);
      }
      set.add(listener);
      return () => {
        listeners.get(field)?.delete(listener);
      };
    },

    type(field, value) {
      drafts.set(field, value);
      waiting.add(field);
      tell(field);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, delayMs);
    },

    flush,

    merge(values) {
      if (drafts.size === 0) return values;
      const merged = { ...values };
      for (const [field, text] of drafts) merged[field] = text;
      return merged;
    },

    live(values) {
      const view = {} as OrderFormValues;
      for (const field of Object.keys(values) as OrderFormField[]) {
        Object.defineProperty(view, field, { enumerable: true, get: () => drafts.get(field) ?? values[field] });
      }
      return view;
    },

    override(field, value) {
      waiting.delete(field);
      if (!drafts.has(field)) return;
      drafts.set(field, value);
      tell(field);
    },

    settle(values) {
      for (const [field, text] of Array.from(drafts)) {
        if (waiting.has(field) || values[field] !== text) continue;
        drafts.delete(field);
        tell(field);
      }
    },

    connect(next) {
      receive = next;
      return () => {
        if (receive !== next) return;
        receive = null;
        if (timer) clearTimeout(timer);
        timer = null;
      };
    },
  };
}

const NOTHING_TO_HEAR = () => {};
const NO_DRAFT = () => undefined;

/**
 * A field's draft, re-read whenever it changes — and only then: this is what
 * lets a keystroke redraw one field instead of the page. Undefined when the
 * form keeps no drafts, and whenever the field's text is the form's own.
 */
export function useDraft(drafts: OrderFormDrafts | null | undefined, field: OrderFormField): string | undefined {
  const subscribe = useCallback(
    (listener: () => void) => (drafts ? drafts.subscribe(field, listener) : NOTHING_TO_HEAR),
    [drafts, field]
  );
  const read = useCallback(() => drafts?.get(field), [drafts, field]);
  return useSyncExternalStore(subscribe, read, NO_DRAFT);
}
