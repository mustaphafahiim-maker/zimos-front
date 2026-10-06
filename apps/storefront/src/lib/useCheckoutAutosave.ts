"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ApiClient, CaptureCheckoutSessionPayload } from "@store-builder/api-client";
import { botGuardAutosaveFields } from "./botGuard";
import { isEgyptianMobile, normalizePhone } from "./egypt";
import { isEgyptForm, type OrderFormValues } from "./orderForm";
import { currentTouches } from "./touches";
import { getVisitorId } from "./visitorId";

// SPEC §6.2: a lost order is captured once typing pauses for 800 ms.
const DEBOUNCE_MS = 800;
const INTL_PHONE = /^\+?\d{8,15}$/;
/** How long submit waits for an autosave already on the wire. */
const FLUSH_WAIT_MS = 2000;
const MAX_LINES = 20;
const MAX_QTY = 100;

export interface AutosaveLine {
  variantId: string;
  offerId?: string | null;
  quantity: number;
}

/**
 * Autosaves the checkout form for abandoned-checkout recovery.
 *
 * Nothing is sent until there is at least one line and either a name (two
 * letters or more) or a phone that is valid for the form's country (an
 * Egyptian mobile on an Egyptian form); after that, every change is saved
 * once typing pauses. A number still being typed is left out of the save,
 * and the server keeps the last valid one it has. The backend
 * upserts on the visitor id, so repeats are harmless. Failures are silent —
 * the autosave must never get in the way of the order.
 *
 * Call `stop()` right before placing the order: it cancels any pending save,
 * waits briefly for one already in flight (so it can't land after the order
 * and open a fresh session), and returns the session id to send as
 * `checkoutSessionId`. Call `resume()` if the order then fails.
 */
export function useCheckoutAutosave({
  client,
  workspaceId,
  values,
  lines,
  source = "store",
}: {
  client: ApiClient;
  workspaceId: string;
  values: OrderFormValues;
  lines: AutosaveLine[];
  /** Where the checkout is happening — a funnel's checkout step reports "funnel". */
  source?: CaptureCheckoutSessionPayload["source"];
}) {
  const stopped = useRef(false);
  const sessionId = useRef<string | undefined>(undefined);
  const lastSaved = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const phoneValid = isEgyptForm(values) ? isEgyptianMobile(values.phone) : INTL_PHONE.test(normalizePhone(values.phone));
  const phone = phoneValid ? normalizePhone(values.phone) : "";
  const fullName = values.fullName.trim().slice(0, 200);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) ? values.email.trim() : "";
  const linesKey = JSON.stringify(
    lines
      .slice(0, MAX_LINES)
      .map((l) => [l.variantId, l.offerId ?? null, Math.min(Math.max(1, l.quantity), MAX_QTY)])
  );

  const { payloadKey, items } = useMemo(() => {
    const parsed = JSON.parse(linesKey) as Array<[string, string | null, number]>;
    return {
      payloadKey: JSON.stringify([phone, fullName, email, linesKey]),
      items: parsed.map(([variantId, offerId, quantity]) => ({
        variantId,
        ...(offerId ? { offerId } : {}),
        quantity,
      })),
    };
  }, [phone, fullName, email, linesKey]);

  useEffect(() => {
    if (!workspaceId || (!phone && fullName.length < 2) || items.length === 0) return;
    if (stopped.current || payloadKey === lastSaved.current) return;

    const payload: CaptureCheckoutSessionPayload = {
      contact: { ...(phone ? { phone } : {}), ...(fullName ? { fullName } : {}), ...(email ? { email } : {}) },
      items,
      source,
      visitorId: getVisitorId(workspaceId),
    };

    timer.current = setTimeout(() => {
      timer.current = null;
      if (stopped.current) return;
      // Chained so saves reach the server in the order they were made.
      inflight.current = (inflight.current ?? Promise.resolve()).then(async () => {
        if (stopped.current) return;
        try {
          // The bot guard's token and honeypot (SPEC §5.1): without them a guarded store stores nothing.
          const guard = await botGuardAutosaveFields(client, workspaceId);
          if (stopped.current) return;
          // How the shopper came (first / last touch, lib/touches.ts): kept on the lost order and the order it becomes.
          const attribution = currentTouches();
          const session = await client.captureCheckoutSession(workspaceId, { ...payload, ...guard, ...(attribution ? { attribution } : {}) });
          sessionId.current = session.id;
          lastSaved.current = payloadKey;
        } catch (err) {
          if (process.env.NODE_ENV !== "production") console.debug("checkout autosave failed", err);
        }
      });
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [client, workspaceId, phone, fullName, email, items, payloadKey, source]);

  const stop = useCallback(async (): Promise<string | undefined> => {
    stopped.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inflight.current) {
      await Promise.race([inflight.current, new Promise((r) => setTimeout(r, FLUSH_WAIT_MS))]);
    }
    return sessionId.current;
  }, []);

  const resume = useCallback(() => {
    stopped.current = false;
    // Let the next change (or the current values, if unsaved) go out again.
    lastSaved.current = null;
  }, []);

  return { stop, resume };
}
