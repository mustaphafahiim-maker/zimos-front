"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkoutHardeningDepositQuote,
  checkoutHardeningDepositRequired,
  type ApiClient,
  type ManualTransferDepositQuote,
  type ManualTransferStoreMethod,
  type StorefrontPaymentMethod,
} from "@store-builder/api-client";
import { onPhoneVerified } from "@/lib/checkoutOtp";
import { asTransferMethod } from "./TransferDetails";

/**
 * Whether a cash-on-delivery order needs a deposit by transfer first
 * (frontend-handoff 362; before it, TransferDetails `useDepositQuote`).
 *
 * The quote is asked once when the shopper picks cash on delivery — not as
 * the phone is typed — and again after the code step, with the `otpToken` the
 * step gave for that phone (lib/checkoutOtp). A "risky shoppers only" rule
 * answers `decidedAtCheckout` without that proof: no box and no warning, the
 * checkout decides. When it then answers 422 DEPOSIT_REQUIRED, `onError`
 * opens the transfer box with the store's transfer methods (GET
 * /payment-methods) and the form stays filled; the order is placed again with
 * the transfer. A quote that fails (429 RATE_LIMITED too) is ignored quietly.
 */
export function useCheckoutDeposit(
  client: ApiClient,
  workspaceId: string,
  phone: string,
  enabled: boolean,
  methods: readonly StorefrontPaymentMethod[]
) {
  const [quote, setQuote] = useState<ManualTransferDepositQuote | null>(null);
  // What the checkout itself asked for (DEPOSIT_REQUIRED), for the phone it was asked of.
  const [asked, setAsked] = useState<{ phone: string; amountType: "shipping" | "fixed"; fixedAmount: number | null } | null>(null);
  const live = useRef({ phone, enabled });
  useEffect(() => {
    live.current = { phone, enabled };
  }, [phone, enabled]);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const typed = live.current.phone;
    checkoutHardeningDepositQuote(client, workspaceId, { phone: typed.replace(/\D/g, "").length >= 10 ? typed : "" })
      .then((q) => current && setQuote(q))
      .catch(() => {
        /* the checkout decides */
      });
    return () => {
      current = false;
    };
  }, [client, workspaceId, enabled]);

  // After the code step: the real answer for this verified phone.
  useEffect(
    () =>
      onPhoneVerified((verified) => {
        if (verified.workspaceId !== workspaceId || !live.current.enabled) return;
        checkoutHardeningDepositQuote(client, workspaceId, { phone: verified.phone, otpToken: verified.otpToken })
          .then((q) => setQuote(q))
          .catch(() => {
            /* the checkout decides */
          });
      }),
    [client, workspaceId]
  );

  /** A refused order that needs a deposit: the transfer box opens. True when it was that refusal. */
  const onError = useCallback(
    (err: unknown): boolean => {
      const required = checkoutHardeningDepositRequired(err);
      if (!required) return false;
      setAsked({ phone: live.current.phone, ...required });
      return true;
    },
    []
  );

  if (!enabled) return { quote: null, onError };
  if (quote?.required) return { quote, onError };
  if (asked && asked.phone === phone) {
    const transferMethods = methods.map((m) => asTransferMethod(m)).filter((m): m is ManualTransferStoreMethod => m !== null);
    if (transferMethods.length > 0) {
      const forced: ManualTransferDepositQuote = { required: true, amountType: asked.amountType, fixedAmount: asked.fixedAmount, methods: transferMethods };
      return { quote: forced, onError };
    }
  }
  return { quote: null, onError };
}
