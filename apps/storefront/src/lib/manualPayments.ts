"use client";

import { useEffect, useState } from "react";
import type { ApiClient, CheckoutPayload, Order, StorefrontManualMethod } from "@store-builder/api-client";
import { botGuardFields } from "./botGuard";
import { adMatchFields } from "./adMatch";
import { withCheckoutOtp } from "./checkoutOtp";
import { savePaymentToken } from "./payments";

/**
 * The store's own manual methods (InstaPay, a mobile wallet): listed at
 * checkout next to cash on delivery. The order is placed unpaid; the shopper
 * proves the transfer with the number they paid from and a screenshot, sent
 * with the order's payment token (kept in this browser, lib/payments).
 */

/** Picker ids for manual methods, so they never clash with the gateway list. */
export const MANUAL_PREFIX = "manual:";
export const manualPickerId = (id: string) => `${MANUAL_PREFIX}${id}`;
export const manualIdOf = (pickerId: string) => (pickerId.startsWith(MANUAL_PREFIX) ? pickerId.slice(MANUAL_PREFIX.length) : null);

/** Active manual methods; an empty list (nothing shown) on any failure. */
export function useManualMethods(client: ApiClient, workspaceId: string) {
  const [methods, setMethods] = useState<StorefrontManualMethod[]>([]);
  useEffect(() => {
    let live = true;
    client
      .getStoreManualPaymentMethods(workspaceId)
      .then((list) => live && setMethods(list))
      .catch(() => {
        /* cash on delivery stays */
      });
    return () => {
      live = false;
    };
  }, [client, workspaceId]);
  return methods;
}

/** The same checks the server makes, so the shopper hears about a typo at once. */
export function validPayerNumber(value: string): boolean {
  const compact = value.trim().replace(/[\s-]/g, "");
  return /^\+?\d{8,15}$/.test(compact) || /^[A-Za-z0-9._-]{2,40}@[A-Za-z0-9._-]{2,20}$/.test(compact);
}

export const PROOF_MAX_BYTES = 15 * 1024 * 1024;
export const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface ProofDraft {
  payerNumber: string;
  file: File | null;
}

/**
 * Places the order with the chosen manual method, keeps its payment token,
 * and sends the proof at once when the shopper filled it in. A proof that
 * fails to send does not undo the order: the thank-you page asks again.
 */
export async function placeManualOrder({
  client,
  workspaceId,
  payload,
  manualPaymentMethodId,
  proof,
  cartToken,
  visitorId,
}: {
  client: ApiClient;
  workspaceId: string;
  payload: CheckoutPayload;
  manualPaymentMethodId: string;
  proof: ProofDraft;
  cartToken?: string;
  visitorId?: string;
}): Promise<{ order: Order; proofSent: boolean }> {
  const body: CheckoutPayload = {
    ...payload,
    paymentMethod: "bank_transfer",
    manualPaymentMethodId,
    ...(await botGuardFields(client, workspaceId)),
    ...adMatchFields(workspaceId),
  };
  const result = await withCheckoutOtp(workspaceId, body.contact.phone, (otp) =>
    client.placeCheckout(workspaceId, { ...body, ...otp }, { cartToken, visitorId })
  );
  const order = result.order;
  if (result.paymentToken) savePaymentToken(workspaceId, order.id, result.paymentToken);

  let proofSent = false;
  if (result.paymentToken && proof.file && validPayerNumber(proof.payerNumber)) {
    try {
      await client.submitManualPaymentProof(workspaceId, order.id, result.paymentToken, {
        payerNumber: proof.payerNumber,
        file: proof.file,
      });
      proofSent = true;
    } catch {
      /* asked again on the thank-you page */
    }
  }
  return { order, proofSent };
}
