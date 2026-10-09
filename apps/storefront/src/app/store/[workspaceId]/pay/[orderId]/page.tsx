"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { codSwitchDeposit, paymentTenderHolds, type ShopperPaymentStatus, type StorefrontPaymentMethod } from "@store-builder/api-client";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { DeviceMobileIcon } from "@phosphor-icons/react/dist/ssr/DeviceMobile";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { XCircleIcon } from "@phosphor-icons/react/dist/ssr/XCircle";
import { PaymentHeldLines } from "@/components/tenders/PaymentHeldLines";
import { CodSwitch } from "@/components/payment/CodSwitch";
import { ManualPaymentProof, useManualPayment } from "@/components/payment/StoreMethodPay";
import { PaySkeleton, PayStateOutline } from "@/components/payment/PaySkeleton";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnGhost, btnPrimaryLg, btnSecondary, card, container } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { pickText } from "@/lib/i18n";
import { getPaymentReturn, getPaymentToken, paymentPageUrl, savePaymentToken, usePreviewToken } from "@/lib/payments";
import { useIsClient } from "@/lib/useIsClient";
import { orderErrorMessage } from "@/lib/placeOrder";
import { useStore } from "@/lib/StoreContext";
import { storeHref } from "@/lib/storeHref";
import { usePaymentMethodText } from "@/lib/paymentMethodText";

// While the latest attempt is open, ask again this often, for this long. Each
// ask may make the server check with the gateway (throttled there too).
const POLL_MS = 3000;
const POLL_FOR_MS = 2 * 60 * 1000;

/**
 * Signed fields a gateway puts on the redirect (Paymob: hmac / id; Kashier:
 * signature / paymentStatus; the sandbox gateway: sbx_sig); their presence
 * means "just came back". The server works out which gateway signed them.
 */
// sbx_setup_sig: the sandbox's "save a card" page, for a free trial with nothing to pay.
// token / PayerID: PayPal (handoff 183) — nothing signed, the return makes the server ask PayPal (and capture).
const GATEWAY_REDIRECT_MARKERS = ["hmac", "id", "signature", "paymentStatus", "sbx_sig", "sbx_setup_sig", "token", "PayerID"];

function gatewayQuery(search: URLSearchParams): Record<string, string> | null {
  if (!GATEWAY_REDIRECT_MARKERS.some((key) => search.has(key))) return null;
  const out: Record<string, string> = {};
  search.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

// This page's own words; the rest come from the store's dictionary (`t.payment`).
const TEXT = {
  en: {
    order: "Order",
    waitingTitle: "Waiting for your payment",
    checkAgain: "Check again",
    checking: "Checking…",
    otherWays: "Or pay another way",
    errorTitle: "We couldn't check your payment",
    tryAgain: "Try again",
    noTokenTitle: "We can't show this payment here",
    track: "Track your order",
  },
  ar: {
    order: "طلب رقم",
    waitingTitle: "مستنيين تأكيد الدفع",
    checkAgain: "حدّث الحالة",
    checking: "بنتأكد…",
    otherWays: "أو ادفع بطريقة تانية",
    errorTitle: "معرفناش نتأكد من الدفع",
    tryAgain: "جرّب تاني",
    noTokenTitle: "مش هنقدر نعرض الدفع هنا",
    track: "تابع طلبك",
  },
  fr: {
    order: "Commande n°",
    waitingTitle: "En attente de votre paiement",
    checkAgain: "Vérifier à nouveau",
    checking: "Vérification…",
    otherWays: "Ou payez autrement",
    errorTitle: "Impossible de vérifier votre paiement",
    tryAgain: "Réessayer",
    noTokenTitle: "Ce paiement ne peut pas s'afficher ici",
    track: "Suivre ma commande",
  },
};

const TONE = {
  ok: "bg-success-soft text-success",
  wait: "bg-primary-soft text-primary",
  bad: "bg-danger-soft text-danger",
  quiet: "bg-paper text-ink-soft",
};

/**
 * The one thing the page is saying right now — waiting, paid, failed… — as a
 * mark, a title and a line or two. It is the page's status for a screen
 * reader too: when the payment moves on, the new state is read out.
 */
function StateHead({ tone, icon, title, children }: { tone: keyof typeof TONE; icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center text-center">
      <span className={`flex h-14 w-14 items-center justify-center rounded-full ${TONE[tone]}`}>{icon}</span>
      <h2 className="mt-3 text-lg font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}

const hint = "mt-1 text-sm text-ink-soft";
// Every button on this page is 48px or more: the big primary, and the others raised to it.
const btnOther = `${btnSecondary} min-h-12 w-full`;

/**
 * /pay/:orderId — where the gateway sends the shopper back, and where an
 * unpaid online order can be resumed, retried with another method, or turned
 * into cash on delivery. Needs the order's payment token, which only the
 * browser that placed the order holds.
 *
 * One state at a time: checking → waiting for the gateway / paid / the
 * payment failed (try again, another way, cash on delivery) / switched to
 * cash on delivery / expired or cancelled.
 */
function PaymentPage() {
  const { workspaceId, orderId } = useParams<{ workspaceId: string; orderId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const basePath = useStoreBasePath();
  const { t, money, locale, intlLocale, store } = useStore();
  const x = pickText(TEXT, locale);
  const [client] = useState(() => createStorefrontApiClient());

  // undefined until hydrated; null when this browser holds no token for the order.
  const isClient = useIsClient();
  const token = useMemo(
    () => {
      if (!isClient) return undefined;
      // A "try again" link from the store carries a fresh token: keep it like the one checkout gave.
      const fromLink = search.get("t");
      if (fromLink && /^[A-Za-z0-9_-]{20,200}$/.test(fromLink)) savePaymentToken(workspaceId, orderId, fromLink);
      return getPaymentToken(workspaceId, orderId);
    },
    [isClient, workspaceId, orderId, search]
  );
  const [status, setStatus] = useState<ShopperPaymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const startedAt = useRef<number | null>(null);
  const preview = usePreviewToken(workspaceId);
  const manual = useManualPayment(client, workspaceId, orderId, token, status);

  const load = useCallback(
    async (refresh: boolean) => {
      if (!token) return;
      try {
        setStatus(await client.getOrderPayment(workspaceId, orderId, token, { refresh, previewToken: preview }));
        setError(null);
      } catch (err) {
        setError(orderErrorMessage(err, t.form.errors));
      }
    },
    [client, workspaceId, orderId, token, preview, t]
  );

  // First load: hand the gateway's redirect to the server (it verifies the
  // signature), then drop it from the address bar.
  useEffect(() => {
    if (!token) return;
    startedAt.current = Date.now();
    const query = gatewayQuery(new URLSearchParams(search.toString()));
    (async () => {
      if (query) {
        try {
          setStatus(await client.returnFromPayment(workspaceId, orderId, token, query, preview));
        } catch (err) {
          setError(orderErrorMessage(err, t.form.errors));
        }
        router.replace(storeHref(basePath, `/pay/${orderId}`));
      } else {
        await load(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Keep asking while the latest attempt is still open.
  const open = status?.status === "awaiting_payment" && status.attempt?.status === "initialized";
  useEffect(() => {
    if (!open || startedAt.current === null || Date.now() - startedAt.current > POLL_FOR_MS) return;
    const timer = window.setTimeout(() => void load(true), POLL_MS);
    return () => window.clearTimeout(timer);
  }, [open, status, load]);

  async function act(key: string, fn: () => Promise<ShopperPaymentStatus>) {
    setBusy(key);
    setError(null);
    try {
      const next = await fn();
      setStatus(next);
      return next;
    } catch (err) {
      setError(orderErrorMessage(err, t.form.errors));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function retry(method: StorefrontPaymentMethod) {
    if (!token) return;
    const next = await act(method.id, () =>
      client.retryOrderPayment(
        workspaceId,
        orderId,
        token,
        {
          paymentMethod: method.method === "cod" ? "card" : method.method,
          ...(method.provider ? { paymentProvider: method.provider } : {}),
          returnUrl: paymentPageUrl(basePath, orderId),
        },
        preview
      )
    );
    const url = next?.attempt?.redirectUrl;
    if (url) {
      setBusy("redirect");
      window.location.assign(url);
    }
  }

  // The shopper asks again by hand — the same read the page makes by itself (after the two
  // minutes of asking are over, this is the way to see a payment that arrived late).
  const [checking, setChecking] = useState(false);
  async function recheck() {
    if (checking) return;
    setChecking(true);
    await load(true);
    setChecking(false);
  }

  // An order placed in a funnel goes back into it once paid (lib/payments savePaymentReturn).
  const funnelReturn = isClient ? getPaymentReturn(workspaceId, orderId) : null;
  const more = usePaymentMethodText();
  const methodName = (m: StorefrontPaymentMethod) =>
    m.method === "wallet" ? t.payment.wallet : m.method === "valu" ? more.valu : m.method === "kiosk" ? more.kiosk : (m.method as string) === "paypal" ? t.express.paypal : t.payment.card;
  const thankYou = storeHref(basePath, `/orders/${orderId}?number=${encodeURIComponent(status?.orderNumber ?? "")}`);
  const expiresAt = status?.expiresAt && new Intl.DateTimeFormat(intlLocale, { timeStyle: "short" }).format(new Date(status.expiresAt));
  // A store that wrote its own "Order #…" line (dashboard → Store texts) keeps it.
  const ownOrderLine = !(store?.storefrontTexts?.[locale]?.["payment.orderNumber"] ?? "").trim();

  let view: ReactNode;
  if (token === null) {
    view = (
      <div className="space-y-5">
        <StateHead tone="quiet" icon={<DeviceMobileIcon size={30} aria-hidden />} title={x.noTokenTitle}>
          <p className={hint}>{t.payment.noToken}</p>
        </StateHead>
        <div className="grid gap-2">
          <StoreLink href="/track" className={btnPrimaryLg}>
            {x.track}
          </StoreLink>
          <StoreLink href="/" className={`${btnGhost} min-h-12 w-full`}>
            {t.payment.backToStore}
          </StoreLink>
        </div>
      </div>
    );
  } else if (!status) {
    view = error ? (
      // The first read failed: say so, with the way to ask again.
      <div className="space-y-5">
        <StateHead tone="bad" icon={<WarningCircleIcon size={32} aria-hidden />} title={x.errorTitle}>
          <p className={hint}>{error}</p>
        </StateHead>
        <button type="button" onClick={() => void recheck()} disabled={checking} aria-busy={checking} className={btnPrimaryLg}>
          {checking ? x.checking : x.tryAgain}
        </button>
      </div>
    ) : (
      <div role="status" aria-busy="true" aria-label={t.payment.checking}>
        <PayStateOutline />
      </div>
    );
  } else if (manual.pending) {
    // A transfer order: whether it is paid to the store's InstaPay / wallet number is being read.
    view = (
      <div role="status" aria-busy="true" aria-label={t.payment.checking}>
        <PayStateOutline />
      </div>
    );
  } else if (manual.payment && token) {
    // Paid to the store's own number (handoff 340): the number, then the screenshot.
    view = <ManualPaymentProof client={client} workspaceId={workspaceId} orderId={orderId} token={token} payment={manual.payment} onChange={manual.setPayment} onReload={manual.reload} />;
  } else if (status.status === "paid") {
    view = (
      <div className="space-y-5">
        <StateHead tone="ok" icon={<CheckCircleIcon size={34} weight="fill" aria-hidden />} title={t.payment.paid}>
          <p className={hint}>{t.payment.paidHint}</p>
        </StateHead>
        {funnelReturn ? (
          <StoreLink href={funnelReturn} className={btnPrimaryLg}>
            {t.funnel.continue}
          </StoreLink>
        ) : (
          <StoreLink href={`/orders/${orderId}?number=${encodeURIComponent(status.orderNumber)}`} className={btnPrimaryLg}>
            {t.payment.viewOrder}
          </StoreLink>
        )}
      </div>
    );
  } else if (status.status === "cod") {
    view = (
      <div className="space-y-5">
        <StateHead tone="ok" icon={<CheckCircleIcon size={34} weight="fill" aria-hidden />} title={t.payment.codDone}>
          <p className={hint}>{t.payment.codDoneHint}</p>
        </StateHead>
        <PaymentHeldLines workspaceId={workspaceId} status={status} />
        {funnelReturn ? (
          <StoreLink href={funnelReturn} className={btnPrimaryLg}>
            {t.funnel.continue}
          </StoreLink>
        ) : (
          <a href={thankYou} className={btnPrimaryLg}>
            {t.payment.viewOrder}
          </a>
        )}
      </div>
    );
  } else if (status.status === "expired" || status.status === "cancelled") {
    view = (
      <div className="space-y-5">
        <StateHead tone="quiet" icon={<XCircleIcon size={32} aria-hidden />} title={status.status === "expired" ? t.payment.expired : t.payment.cancelled}>
          {status.status === "expired" && <p className={hint}>{t.payment.expiredHint}</p>}
        </StateHead>
        <PaymentHeldLines workspaceId={workspaceId} status={status} />
        <StoreLink href="/" className={btnOther}>
          {t.payment.backToStore}
        </StoreLink>
      </div>
    );
  } else {
    const resumeUrl = status.attempt?.redirectUrl;
    const retries = status.canRetry ? status.methods : [];
    const canCod = Boolean(status.canSwitchToCod && token);
    // With nothing to resume, a failed payment's first way to try again is the page's main button.
    const leadRetry = !open && !resumeUrl;
    view = (
      <div className="space-y-5">
        {open ? (
          <StateHead tone="wait" icon={<CircleNotchIcon size={30} aria-hidden className="animate-spin motion-reduce:animate-none" />} title={x.waitingTitle}>
            <p className={hint}>{t.payment.waiting}</p>
            {expiresAt && <p className="mt-2 text-xs text-ink-soft">{t.payment.expiresAt(expiresAt)}</p>}
          </StateHead>
        ) : (
          <StateHead tone="bad" icon={<WarningCircleIcon size={32} aria-hidden />} title={t.payment.failed}>
            {status.attempt?.failureReason && <p className={hint}>{t.payment.failedReason(status.attempt.failureReason)}</p>}
            {expiresAt && <p className="mt-2 text-xs text-ink-soft">{t.payment.expiresAt(expiresAt)}</p>}
          </StateHead>
        )}
        <PaymentHeldLines workspaceId={workspaceId} status={status} />

        {(resumeUrl || open) && (
          <div className="grid gap-2">
            {resumeUrl && (
              <a href={resumeUrl} className={btnPrimaryLg}>
                {t.payment.resume}
              </a>
            )}
            {open && (
              <button type="button" onClick={() => void recheck()} disabled={checking} aria-busy={checking} className={`${btnGhost} min-h-12 w-full`}>
                {checking ? x.checking : x.checkAgain}
              </button>
            )}
          </div>
        )}

        {(retries.length > 0 || canCod) && (
          <div className="grid gap-3">
            {!leadRetry && <p className="text-center text-xs font-medium text-ink-soft">{x.otherWays}</p>}
            {retries.map((m, i) => (
              <button
                key={m.id}
                type="button"
                disabled={busy !== null}
                aria-busy={busy === m.id || busy === "redirect"}
                onClick={() => void retry(m)}
                className={leadRetry && i === 0 ? btnPrimaryLg : btnOther}
              >
                {busy === m.id || busy === "redirect" ? t.payment.redirecting : t.payment.retryWith(methodName(m))}
              </button>
            ))}
            {status.canSwitchToCod && token && (
              <CodSwitch
                client={client}
                workspaceId={workspaceId}
                orderId={orderId}
                token={token}
                previewToken={preview}
                deposit={codSwitchDeposit(status)}
                disabled={busy !== null && busy !== "cod"}
                label={t.payment.switchToCod}
                busyLabel={t.payment.switching}
                onBusy={(on) => setBusy(on ? "cod" : null)}
                onDone={setStatus}
                errorText={(err) => orderErrorMessage(err, t.form.errors)}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className={`${container} flex-1 py-8 sm:py-14`}>
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t.payment.title}</h1>
        {/* The line is held while the order is read, so the card under it does not move when it arrives. */}
        <p className="mt-1 min-h-5 text-sm text-ink-soft">
          {status && (
            <>
              {ownOrderLine ? (
                <>
                  {x.order}{" "}
                  <bdi dir="ltr" className="font-medium text-ink">
                    {status.orderNumber}
                  </bdi>
                </>
              ) : (
                t.payment.orderNumber(status.orderNumber)
              )}{" "}
              · {/* What is left to pay: the total less what is paid and what a gift card, points or store credit hold (handoff 201). */}
              {money(status.status === "awaiting_payment" ? paymentTenderHolds(status).amountDue : status.totalAmount, status.currency)}
            </>
          )}
        </p>

        <section className={`${card} mt-6 p-5 sm:p-6`}>
          {view}
          {error && status && (
            <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<PaySkeleton />}>
      <PaymentPage />
    </Suspense>
  );
}
