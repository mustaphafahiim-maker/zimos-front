import { useCallback, useRef } from "react";
import { ApiError, isApiErrorCode, ordersRefundOnce, type OrderRefundOnceBody, type Refund } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { inProgress: "The refund is being processed — wait a few seconds" },
  ar: { inProgress: "الاسترجاع بيتنفذ — استنى ثواني" },
} satisfies Messages;

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * The refund dialog's sender (handoff 320): one Idempotency-Key for the dialog,
 * made when it opens and sent with the request and with a retry of that same
 * request, so a double click or a retry after a lost answer makes one refund.
 *
 * The server refuses a key that comes back with another body, and a key whose
 * request failed there is spent. So the key is replaced when the form's
 * request changes, or after the server refused it; it is kept after a network
 * failure and after "still being processed".
 */
export function useRefundOnce(workspaceId: string, orderId: string) {
  const t = useT(STRINGS);
  const held = useRef<{ key: string; body: string | null }>({ key: "", body: null });
  if (!held.current.key) held.current = { key: newKey(), body: null };

  return useCallback(
    async (body: OrderRefundOnceBody): Promise<Refund> => {
      const sent = JSON.stringify(body);
      if (held.current.body !== null && held.current.body !== sent) held.current = { key: newKey(), body: sent };
      else held.current.body = sent;
      try {
        return await ordersRefundOnce(apiClient, workspaceId, orderId, body, held.current.key);
      } catch (err) {
        if (isApiErrorCode(err, "IDEMPOTENCY_KEY_IN_PROGRESS")) throw new Error(t.inProgress);
        // An answer from the server (not a lost connection): this key is spent.
        if (err instanceof ApiError && err.status > 0) held.current = { key: newKey(), body: null };
        throw err;
      }
    },
    [workspaceId, orderId, t]
  );
}
