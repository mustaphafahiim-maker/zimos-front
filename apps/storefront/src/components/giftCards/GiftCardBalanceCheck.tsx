"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { giftCardCheck, normalizeGiftCardCode, type GiftCardBalance } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary, card, container } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { GiftCardCodeInput, giftCardCheckError } from "./GiftCardField";

const STATE_TONE: Record<GiftCardBalance["state"], string> = {
  active: "bg-success-soft text-success",
  empty: "bg-line/60 text-ink-soft",
  expired: "bg-accent-soft text-accent-dark",
  disabled: "bg-danger-soft text-danger",
};

/**
 * "Check your gift card balance" (/gift-card): the shopper types
 * the code from the email and sees what is left on it, until when, and how to
 * spend it. POST /store/:ws/gift-cards/check, rate-limited like tracking.
 */
export function GiftCardBalanceCheck() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { t, money, intlLocale, locale } = useStore();
  const copy = t.giftCards;
  const client = useMemo(() => createStorefrontApiClient(), [locale]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GiftCardBalance | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const code = normalizeGiftCardCode(draft);
    setResult(null);
    if (!code) {
      setError(copy.codeRequired);
      return;
    }
    if (code.length !== 16) {
      setError(copy.notFound);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await giftCardCheck(client, workspaceId, code));
    } catch (err) {
      setError(giftCardCheckError(err, copy));
    } finally {
      setBusy(false);
    }
  }

  const stateText = result
    ? { active: copy.stateActive, empty: copy.stateEmpty, expired: copy.stateExpired, disabled: copy.stateDisabled }[result.state]
    : "";
  const date = (iso: string) => new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

  return (
    <main className={`${container} flex-1 py-8 sm:py-12`}>
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{copy.checkBalance}</h1>
        <p className="mt-2 text-sm text-ink-soft">{copy.checkHint}</p>

        <form onSubmit={submit} noValidate className={`${card} mt-6 p-5 sm:p-6`}>
          <GiftCardCodeInput
            id="gift-card-code"
            errorId="gift-card-code-error"
            label={copy.code}
            value={draft}
            onChange={(value) => {
              setDraft(value);
              if (error) setError(null);
            }}
            error={error}
            busy={busy}
            applyLabel={busy ? copy.checking : copy.check}
            submit
          />
        </form>

        <div aria-live="polite">
          {result && (
            <section className={`${card} mt-4 p-5 sm:p-6`} aria-labelledby="gift-card-balance-title">
              <div className="flex items-center justify-between gap-3">
                <h2 id="gift-card-balance-title" className="text-sm font-medium text-ink-soft">
                  {copy.balance} · <bdi dir="ltr">••••{result.last4}</bdi>
                </h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATE_TONE[result.state]}`}>{stateText}</span>
              </div>
              <p className="mt-2 text-3xl font-bold text-ink tabular-nums">{money(result.balanceAmount, result.currency)}</p>
              <p className="mt-1 text-sm text-ink-soft">{result.expiresAt ? copy.validUntil(date(result.expiresAt)) : copy.noExpiry}</p>
              {result.state === "active" && (
                <>
                  <p className="mt-4 text-sm text-ink">{copy.useAtCheckout}</p>
                  <StoreLink href="/" className={`${btnPrimary} mt-4 w-full`}>
                    {copy.shop}
                  </StoreLink>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
