"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ApiError,
  checkoutHardeningConfirm,
  checkoutHardeningConfirmState,
  type CheckoutHardeningConfirmState,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { CheckIcon } from "./Icons";
import { btnPrimaryLg, card, skeleton } from "./ui";

/*
 * The shopper confirms a cash-on-delivery order from the store's link
 * (frontend-handoff 388): `…/track?t=<tracking token>&confirm=1`. The tracking
 * page opens the order from `t` as it always does; with `confirm=1` this card
 * sits above the order, by the server's `confirmState`
 * (GET /store/:ws/orders/:orderId/self-service?token=…), and «تأكيد الطلب»
 * posts /confirm with the same token. `closed` — the option is off, the order
 * is not cash on delivery, or it no longer waits — shows no card at all.
 */

const TEXT = {
  en: {
    title: "Confirm your order",
    summary: (number: string, total: string) => `Order ${number}, ${total} — paid on delivery`,
    confirm: "Confirm order",
    confirming: "Confirming…",
    soon: "You can confirm your order in a moment",
    confirmed: "Your order is confirmed, thank you! We'll prepare and ship it",
    review: "We'll review your order and contact you to confirm it",
    cancelled: "This order was cancelled",
    shipped: "Your order is on its way",
    notYet: "Your order is still being prepared, try again in a few minutes",
    tooMany: "Too many tries, try again shortly",
    failed: "We couldn't confirm your order. Try again.",
    loading: "Loading…",
  },
  ar: {
    title: "أكّد طلبك",
    summary: (number: string, total: string) => `طلب رقم ${number} بإجمالي ${total} — هيتدفع عند الاستلام`,
    confirm: "تأكيد الطلب",
    confirming: "جارٍ التأكيد…",
    soon: "ثواني وتقدر تأكّد طلبك",
    confirmed: "تم تأكيد طلبك، شكرًا لك! هنجهّزه ونبعتهولك",
    review: "هنراجع طلبك ونتواصل معاك لتأكيده",
    cancelled: "الطلب ده اتلغى",
    shipped: "طلبك في الطريق",
    notYet: "لسه بنجهّز طلبك، جرّب تاني بعد دقايق",
    tooMany: "محاولات كتير، جرّب بعد شوية",
    failed: "مقدرناش نأكّد طلبك. جرّب تاني.",
    loading: "جارٍ التحميل…",
  },
};

/** The state a refused confirmation leaves the card in; null when the card stays as it is with a message. */
function stateOfRefusal(code: string): CheckoutHardeningConfirmState | null {
  if (code === "CONFIRM_NEEDS_REVIEW") return "review";
  if (code === "ORDER_CANCELLED") return "cancelled";
  if (code === "CONFIRM_NOT_ALLOWED") return "shipped";
  if (code === "CONFIRM_NOT_OFFERED" || code === "NOT_FOUND") return "closed";
  return null;
}

export function OrderConfirmFromLink({
  workspaceId,
  token,
  orderNumber,
  total,
  className = "",
}: {
  workspaceId: string;
  /** The order's tracking token (the link's `t`). */
  token: string | null;
  orderNumber: string;
  /** The order's total, already formatted in its own currency. */
  total: string;
  className?: string;
}) {
  const search = useSearchParams();
  const asked = search.get("confirm") === "1";
  const linkToken = token ?? search.get("t");
  const { locale } = useStore();
  const text = pickText(TEXT, locale);
  const client = useMemo(() => createStorefrontApiClient(), []);
  const [state, setState] = useState<CheckoutHardeningConfirmState | "loading">("loading");
  const [availableAt, setAvailableAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!asked || !linkToken) return;
    let live = true;
    checkoutHardeningConfirmState(client, workspaceId, linkToken)
      .then((answer) => {
        if (!live) return;
        setState(answer?.confirmState ?? "closed");
        setAvailableAt(answer?.confirmAvailableAt ? new Date(answer.confirmAvailableAt).getTime() : null);
      })
      .catch(() => {
        // The order shows as usual below; nothing to confirm from here.
        if (live) setState("closed");
      });
    return () => {
      live = false;
    };
  }, [asked, client, linkToken, workspaceId]);

  // A funnel's offer window still open: the button opens by itself when it ends.
  const waiting = availableAt !== null && availableAt > now;
  useEffect(() => {
    if (!waiting || availableAt === null) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(Math.max(availableAt - Date.now(), 0) + 250, 60_000));
    return () => window.clearTimeout(timer);
  }, [waiting, availableAt, now]);

  if (!asked || !linkToken || state === "closed") return null;

  async function confirm() {
    if (busy || !linkToken) return;
    setBusy(true);
    setError(null);
    try {
      await checkoutHardeningConfirm(client, workspaceId, linkToken);
      setState("confirmed");
    } catch (err) {
      const code = err instanceof ApiError ? String(err.code ?? "") : "";
      const next = stateOfRefusal(code);
      if (next) setState(next);
      else if (code === "CONFIRM_NOT_YET") setError(text.notYet);
      else if (err instanceof ApiError && err.status === 429) setError(text.tooMany);
      else setError(text.failed);
    } finally {
      setBusy(false);
    }
  }

  const frame = `${card} p-5 sm:p-6 ${className}`.trimEnd();

  if (state === "loading") {
    return (
      <section className={frame} role="status" aria-busy="true" aria-label={text.loading}>
        <span className={`${skeleton} block h-5 w-1/2`} />
        <span className={`${skeleton} mt-3 block h-4 w-3/4`} />
        <span className={`${skeleton} mt-4 block h-12 w-full`} />
      </section>
    );
  }

  if (state === "available") {
    return (
      <section className={`${frame} border-2 border-primary/25`} aria-labelledby="confirm-order-title" data-confirm-state="available">
        <h2 id="confirm-order-title" className="text-lg font-bold text-ink">
          {text.title}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {text.summary(orderNumber, total)}
        </p>
        <button type="button" onClick={confirm} disabled={busy || waiting} aria-busy={busy} className={`${btnPrimaryLg} mt-4`}>
          {busy ? text.confirming : text.confirm}
        </button>
        {waiting && <p className="mt-2 text-sm text-ink-soft">{text.soon}</p>}
        <div role="alert" aria-live="assertive" className="empty:hidden">
          {error && <p className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{error}</p>}
        </div>
      </section>
    );
  }

  const message =
    state === "confirmed" ? text.confirmed : state === "review" ? text.review : state === "cancelled" ? text.cancelled : text.shipped;
  const tone = state === "confirmed" ? "bg-success-soft text-success" : state === "cancelled" ? "bg-danger-soft text-danger" : "bg-primary-soft text-ink";
  return (
    <section className={`${className}`.trimEnd()} data-confirm-state={state}>
      <p role="status" className={`flex items-start gap-2 rounded-2xl px-4 py-4 text-sm font-semibold ${tone}`}>
        {state === "confirmed" && <CheckIcon size={18} className="mt-0.5 shrink-0" />}
        <span>{message}</span>
      </p>
    </section>
  );
}
