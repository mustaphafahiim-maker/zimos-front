"use client";

import { useEffect, useState } from "react";
import { ApiError, subscriptionPortalCancel, subscriptionPortalGet, type SubscriptionPortal as Portal } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { btnPrimary, btnSecondary, card, container } from "./ui";
import { SubscriptionCardPanel } from "./SubscriptionCard";

const STRINGS = {
  en: {
    loading: "Loading your subscription…",
    notFound: "This link is not valid.",
    error: "We could not load your subscription. Please try again.",
    retry: "Try again",
    each: { week: "every week", month: "every month", year: "every year" },
    nextCharge: "Next charge",
    paidSoFar: (made: number, total: number) => `${made} of ${total} payments made`,
    payments: (made: number) => `${made} payments made`,
    status: {
      trialing: "Trial",
      active: "Active",
      past_due: "The last payment failed — we will try again.",
      paused: "Paused",
      cancelled: "Cancelled",
      completed: "Paid in full",
    },
    cancel: "Cancel subscription",
    confirm: "Yes, cancel it",
    keep: "Keep it",
    confirmText: "You will not be charged again. This cannot be undone here.",
    cancelling: "Cancelling…",
    cancelled: "Your subscription is cancelled.",
  },
  ar: {
    loading: "جارٍ تحميل اشتراكك…",
    notFound: "الرابط ده مش صحيح.",
    error: "مقدرناش نحمّل اشتراكك. حاول تاني.",
    retry: "حاول تاني",
    each: { week: "كل أسبوع", month: "كل شهر", year: "كل سنة" },
    nextCharge: "الخصم الجاي",
    paidSoFar: (made: number, total: number) => `اتدفع ${made} من ${total} دفعات`,
    payments: (made: number) => `اتدفع ${made} مرة`,
    status: {
      trialing: "تجربة",
      active: "نشط",
      past_due: "آخر دفعة فشلت — هنحاول تاني.",
      paused: "متوقف",
      cancelled: "ملغي",
      completed: "اتدفع بالكامل",
    },
    cancel: "إلغاء الاشتراك",
    confirm: "أيوه، الغيه",
    keep: "خليه",
    confirmText: "مش هيتخصم منك تاني. الإلغاء مينفعش يترجع من هنا.",
    cancelling: "جارٍ الإلغاء…",
    cancelled: "اشتراكك اتلغى.",
  },
};

/**
 * The customer's page for one subscription or installment plan (SPEC §18.1):
 * what it charges, when, the card it is charged to (and changing it), and a
 * cancel button for subscriptions. The token in
 * the address is the credential.
 */
export function SubscriptionPortal({ workspaceId, token }: { workspaceId: string; token: string }) {
  const { intlLocale, money } = useStore();
  const t = intlLocale.startsWith("ar") ? STRINGS.ar : STRINGS.en;
  const [sub, setSub] = useState<Portal | null>(null);
  const [problem, setProblem] = useState<"notFound" | "error" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setProblem(null);
    subscriptionPortalGet(createStorefrontApiClient(), workspaceId, token)
      .then((found) => {
        if (!cancelled) setSub(found);
      })
      .catch((err) => {
        if (!cancelled) setProblem(err instanceof ApiError && err.status === 404 ? "notFound" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, token, attempt]);

  async function cancel() {
    setBusy(true);
    try {
      setSub(await subscriptionPortalCancel(createStorefrontApiClient(), workspaceId, token));
      setConfirming(false);
    } catch {
      setProblem("error");
    } finally {
      setBusy(false);
    }
  }

  const when = new Intl.DateTimeFormat(intlLocale, { dateStyle: "long" });

  return (
    <div className={`${container} py-10`}>
      <div className={`${card} mx-auto max-w-xl p-6`}>
        {problem ? (
          <div className="space-y-4 text-center">
            <p role="alert" className="text-sm text-ink">
              {problem === "notFound" ? t.notFound : t.error}
            </p>
            {problem === "error" && (
              <button type="button" className={btnPrimary} onClick={() => setAttempt((n) => n + 1)}>
                {t.retry}
              </button>
            )}
          </div>
        ) : !sub ? (
          <p role="status" className="text-center text-sm text-ink-soft">
            {t.loading}
          </p>
        ) : (
          <div className="space-y-5">
            <div>
              <h1 dir="auto" className="text-xl font-semibold text-ink">
                {sub.productName}
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                <span className="font-semibold text-ink">{money(sub.amount, sub.currency)}</span> {t.each[sub.interval]}
              </p>
            </div>

            <p role="status" className="rounded-xl bg-paper px-4 py-3 text-sm font-medium text-ink">
              {sub.status === "cancelled" ? t.cancelled : t.status[sub.status]}
            </p>

            <dl className="space-y-2 text-sm">
              {sub.nextRenewalAt && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-soft">{t.nextCharge}</dt>
                  <dd className="font-medium text-ink">{when.format(new Date(sub.nextRenewalAt))}</dd>
                </div>
              )}
              <div className="text-ink-soft">
                {sub.installmentsTotal ? t.paidSoFar(sub.paymentsMade, sub.installmentsTotal) : t.payments(sub.paymentsMade)}
              </div>
            </dl>

            {/* The card renewals are charged to, and changing it (SubscriptionCard.tsx). */}
            <SubscriptionCardPanel workspaceId={workspaceId} token={token} sub={sub} onChange={setSub} />

            {sub.canCancel &&
              (confirming ? (
                <div className="space-y-3 border-t border-line pt-4">
                  <p className="text-sm text-ink">{t.confirmText}</p>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" disabled={busy} className={btnPrimary} onClick={() => void cancel()}>
                      {busy ? t.cancelling : t.confirm}
                    </button>
                    <button type="button" disabled={busy} className={btnSecondary} onClick={() => setConfirming(false)}>
                      {t.keep}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className={btnSecondary} onClick={() => setConfirming(true)}>
                  {t.cancel}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
