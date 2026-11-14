"use client";

import { botGuardFields } from "./botGuard";
import { adMatchFields } from "./adMatch";
import { withCheckoutOtp } from "./checkoutOtp";
import { useEffect, useState, useSyncExternalStore } from "react";
import { storefrontPaymentMethodsFor, type ApiClient, type CheckoutPayload, type CheckoutResult, type StorefrontPaymentMethod } from "@store-builder/api-client";
import { saveOrderSnapshot, snapshotFromOrder } from "./commerce";
import { storeHref } from "./storeHref";

/**
 * Online payments on the storefront: which methods the store offers, the
 * shopper's payment token for each unpaid order, and the store-preview flag
 * that lets the merchant try test-mode payments.
 *
 * Everything here lives in this browser only. The payment token is the
 * shopper's key to their unpaid order's payment page (status, resume, retry,
 * switch to cash on delivery); it is handed out once by the checkout.
 */

const COD_ONLY: StorefrontPaymentMethod[] = [{ id: "cod", provider: null, method: "cod", mode: "live" }];

// --------------------------------------------------------------- preview

const previewKey = (workspaceId: string) => `zimos_payments_preview_${workspaceId}`;

/** The merchant's payments preview token for this store, if this tab has one. */
export function getPreviewToken(workspaceId: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage.getItem(previewKey(workspaceId)) ?? undefined;
  } catch {
    return undefined;
  }
}

const PREVIEW_EVENT = "zimos-payments-preview";

export function setPreviewToken(workspaceId: string, token: string | null) {
  try {
    if (token) window.sessionStorage.setItem(previewKey(workspaceId), token);
    else window.sessionStorage.removeItem(previewKey(workspaceId));
  } catch {
    /* storage disabled: preview only lasts for this page */
  }
  window.dispatchEvent(new Event(PREVIEW_EVENT));
}

function subscribePreview(onChange: () => void) {
  window.addEventListener(PREVIEW_EVENT, onChange);
  return () => window.removeEventListener(PREVIEW_EVENT, onChange);
}

/** The preview token, re-read whenever setPreviewToken changes it. Undefined during SSR. */
export function usePreviewToken(workspaceId: string): string | undefined {
  return useSyncExternalStore(
    subscribePreview,
    () => getPreviewToken(workspaceId),
    () => undefined
  );
}

// ---------------------------------------------------------- payment tokens

const tokensKey = (workspaceId: string) => `zimos_payment_tokens_${workspaceId}`;

function readTokens(workspaceId: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(tokensKey(workspaceId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function savePaymentToken(workspaceId: string, orderId: string, token: string) {
  try {
    const entries = Object.entries(readTokens(workspaceId)).filter(([id]) => id !== orderId);
    const next = Object.fromEntries([[orderId, token], ...entries].slice(0, 20));
    window.localStorage.setItem(tokensKey(workspaceId), JSON.stringify(next));
  } catch {
    /* storage disabled */
  }
}

export function getPaymentToken(workspaceId: string, orderId: string): string | null {
  if (typeof window === "undefined") return null;
  return readTokens(workspaceId)[orderId] ?? null;
}

// Where the payment page sends the shopper on once the order is paid: back into
// the funnel the order was placed in. A store-relative path only.
const backKey = (workspaceId: string, orderId: string) => `zimos_pay_back_${workspaceId}_${orderId}`;

export function savePaymentReturn(workspaceId: string, orderId: string, path: string) {
  try {
    if (path.startsWith("/") && !path.startsWith("//")) window.localStorage.setItem(backKey(workspaceId, orderId), path);
  } catch {
    /* storage disabled */
  }
}

export function getPaymentReturn(workspaceId: string, orderId: string): string | null {
  try {
    const path = window.localStorage.getItem(backKey(workspaceId, orderId));
    return path && path.startsWith("/") && !path.startsWith("//") ? path : null;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------- methods

/**
 * The methods the store offers at checkout. Starts (and falls back to) cash on
 * delivery only, so a store without online payments renders exactly as before.
 */
export function usePaymentMethods(client: ApiClient, workspaceId: string, funnelId?: string) {
  const [methods, setMethods] = useState<StorefrontPaymentMethod[]>(COD_ONLY);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    let live = true;
    // A funnel offers its own list (payment rules → methods per funnel).
    (funnelId
      ? storefrontPaymentMethodsFor(client, workspaceId, { funnelId, previewToken: getPreviewToken(workspaceId) })
      : client.getStorefrontPaymentMethods(workspaceId, getPreviewToken(workspaceId))
    )
      .then((res) => {
        if (!live) return;
        setMethods(res.methods.length ? res.methods : COD_ONLY);
        setPreview(res.preview);
      })
      .catch(() => {
        /* keep cash on delivery */
      });
    return () => {
      live = false;
    };
  }, [client, workspaceId, funnelId]);
  return { methods, preview };
}

/** The page a gateway sends the shopper back to, on this store's own address. */
export function paymentPageUrl(basePath: string, orderId: string): string {
  return `${window.location.origin}${storeHref(basePath, `/pay/${orderId}`)}`;
}

/**
 * Places an order paid online and returns where to send the shopper: the
 * gateway's page, or — when the gateway could not start the payment — our own
 * payment page, which offers a retry or cash on delivery.
 */
export async function placeOnlineOrder({
  client,
  workspaceId,
  basePath,
  payload,
  method,
  cartToken,
  visitorId,
  returnTo,
  shopperToken,
}: {
  client: ApiClient;
  workspaceId: string;
  basePath: string;
  payload: CheckoutPayload;
  method: StorefrontPaymentMethod;
  cartToken?: string;
  /** Owns any photo answering a product's custom field. */
  visitorId?: string;
  /** A store-relative path the payment page sends the shopper on to once paid (a funnel's next step). */
  returnTo?: string;
  /** The signed-in shopper's token, when the order uses their level or invite; nothing is sent without one. */
  shopperToken?: string | null;
}): Promise<{ result: CheckoutResult; next: string; external: boolean }> {
  const previewToken = getPreviewToken(workspaceId);
  const token = cartToken;
  const body: CheckoutPayload = {
    ...payload,
    paymentMethod: method.method,
    ...(method.provider ? { paymentProvider: method.provider } : {}),
    // The bot guard's token and honeypot (lib/botGuard).
    ...(await botGuardFields(client, workspaceId)),
    // The ad platforms' browser ids, for the server-side Purchase (lib/adMatch).
    ...adMatchFields(workspaceId),
  };
  // The return URL names the order, which only exists once the checkout
  // answers: the server fills in the {orderId} placeholder.
  const result = await withCheckoutOtp(workspaceId, body.contact.phone, (otp) =>
    client.placeCheckout(
      workspaceId,
      { ...body, ...otp, returnUrl: paymentPageUrl(basePath, "{orderId}") },
      { cartToken: token, previewToken, visitorId, shopperToken }
    )
  );

  const order = result.order;
  saveOrderSnapshot(workspaceId, snapshotFromOrder(order, body.contact.phone));
  if (result.paymentToken) savePaymentToken(workspaceId, order.id, result.paymentToken);
  if (returnTo) savePaymentReturn(workspaceId, order.id, returnTo);

  const redirect = result.payment?.redirectUrl;
  if (redirect) return { result, next: redirect, external: true };
  return { result, next: storeHref(basePath, `/pay/${order.id}`), external: false };
}
