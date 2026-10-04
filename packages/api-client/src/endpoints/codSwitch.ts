/**
 * "Switch to cash on delivery" on the pay page, with the checks a COD order
 * meets at checkout (backend: src/modules/payments/codSwitchChecks.js). All
 * exported names in this file are prefixed with `codSwitch` / `CodSwitch`.
 *
 * Notable answers: 428 OTP_REQUIRED (a code went to the order's phone; send it
 * back as `otpCode` — the same call without it asks for another code),
 * INVALID_CODE / EXPIRED / TOO_MANY_ATTEMPTS, 422 DEPOSIT_REQUIRED (send
 * `transfer`; the status names the deposit up front), 422
 * PAYMENT_METHOD_UNAVAILABLE (the funnel or the store does not take cash on
 * delivery), ORDER_REJECTED.
 */
import type { ApiClient } from "../client";
import type { ShopperPaymentStatus } from "../types";
import type { ManualTransferCheckoutDetails, ManualTransferStoreMethod } from "./manualTransfers";

/** The deposit by transfer the switch needs, as the shopper's payment status names it. */
export interface CodSwitchDeposit {
  amountType: "shipping" | "fixed";
  amount: number;
  currency: string;
  methods: ManualTransferStoreMethod[];
}

export interface CodSwitchPayload {
  otpCode?: string;
  transfer?: ManualTransferCheckoutDetails;
}

/** The deposit the switch asks for, or null. */
export function codSwitchDeposit(status: ShopperPaymentStatus): CodSwitchDeposit | null {
  return (status as ShopperPaymentStatus & { codDeposit?: CodSwitchDeposit | null }).codDeposit ?? null;
}

/** POST /store/:ws/orders/:orderId/payment/switch-to-cod with the order's payment token. */
export async function codSwitchToCod(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  paymentToken: string,
  payload: CodSwitchPayload,
  opts: { previewToken?: string; visitorId?: string } = {}
): Promise<ShopperPaymentStatus> {
  const headers: Record<string, string> = { "X-Payment-Token": paymentToken };
  if (opts.previewToken) headers["X-Store-Preview"] = opts.previewToken;
  // The deposit's receipt photo belongs to the visitor who uploaded it.
  if (opts.visitorId) headers["X-Visitor-Id"] = opts.visitorId;
  const { payment } = await client.request<{ payment: ShopperPaymentStatus }>(
    `/store/${workspaceId}/orders/${orderId}/payment/switch-to-cod`,
    { method: "POST", body: payload, auth: false, headers }
  );
  return payment;
}
