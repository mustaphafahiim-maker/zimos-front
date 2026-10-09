"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  checkoutHardeningConsentOf,
  checkoutHardeningTermsRefused,
  type ApiClient,
  type CheckoutHardeningConsent,
} from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { focusRing } from "@/components/ui";
import { CHECKOUT_REFUSAL_TEXT } from "@/lib/checkoutRefusals";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";

/*
 * The checkout's two boxes (frontend-handoff 374), each shown only when the
 * merchant switched it on (GET /store/:ws → store.checkout.consent):
 * «ابعتلي العروض والجديد» — never pre-ticked — and «أوافق على الشروط», which
 * must be ticked before the order goes. Their state rides the order as
 * `acceptsMarketing` / `acceptsTerms`; a box the store does not show sends
 * nothing. One hook and one component for the checkout page, the product
 * page's own form and a funnel's checkout.
 */

const TEXT = {
  en: {
    marketing: "Send me news and offers",
    terms: "I agree to the terms of service and privacy policy",
    read: "Read:",
  },
  ar: {
    marketing: "ابعتلي العروض والجديد على الإيميل والواتساب",
    terms: "أوافق على الشروط والأحكام وسياسة الخصوصية",
    read: "اقرأ:",
  },
};

const OFF: CheckoutHardeningConsent = checkoutHardeningConsentOf(null);

export interface CheckoutConsentState {
  consent: CheckoutHardeningConsent;
  marketing: boolean;
  terms: boolean;
  setMarketing: (on: boolean) => void;
  setTerms: (on: boolean) => void;
  /** Said under the terms box. */
  error: string | null;
  /** The required box is shown and not ticked: the order button waits for it. */
  blocked: boolean;
  /** Spread into the checkout body. */
  payload: { acceptsMarketing?: boolean; acceptsTerms?: boolean };
  /** Before the order is sent: the message when the terms are not ticked (the box takes the focus), else null. */
  check: (idPrefix: string) => string | null;
  /** After a refused order: the message when the server named the terms box, else null. */
  onError: (err: unknown) => string | null;
}

export const consentTermsId = (idPrefix: string) => `${idPrefix}-accepts-terms`;

export function useCheckoutConsent({ client, workspaceId }: { client: ApiClient; workspaceId: string }): CheckoutConsentState {
  const { locale } = useStore();
  const refusal = pickText(CHECKOUT_REFUSAL_TEXT, locale);
  const [consent, setConsent] = useState<CheckoutHardeningConsent>(OFF);
  const [marketing, setMarketingOn] = useState(false);
  const [terms, setTermsOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read fresh when the form opens, like the form's own settings (lib/useOrderFormFields): a store that
  // switched a box on since the shopper started browsing still shows it.
  useEffect(() => {
    let live = true;
    client
      .getStorefrontMeta(workspaceId)
      .then((meta) => {
        if (live) setConsent(checkoutHardeningConsentOf((meta as { checkout?: unknown }).checkout));
      })
      .catch(() => {
        /* no boxes: the server still refuses an order that needed the terms */
      });
    return () => {
      live = false;
    };
  }, [client, workspaceId]);

  const setMarketing = useCallback((on: boolean) => setMarketingOn(on), []);
  const setTerms = useCallback((on: boolean) => {
    setTermsOn(on);
    if (on) setError(null);
  }, []);

  const needsTerms = consent.terms.enabled && consent.terms.required;
  const blocked = needsTerms && !terms;

  const payload = useMemo(
    () => ({
      ...(consent.marketing.enabled ? { acceptsMarketing: marketing } : {}),
      ...(consent.terms.enabled ? { acceptsTerms: terms } : {}),
    }),
    [consent, marketing, terms]
  );

  const check = useCallback(
    (idPrefix: string) => {
      if (!blocked) return null;
      setError(refusal.terms);
      document.getElementById(consentTermsId(idPrefix))?.focus();
      return refusal.terms;
    },
    [blocked, refusal.terms]
  );

  const onError = useCallback(
    (err: unknown) => {
      if (!checkoutHardeningTermsRefused(err)) return null;
      // The store switched the box on after this form was read: show it now.
      setConsent((prev) => (prev.terms.enabled && prev.terms.required ? prev : { ...prev, terms: { ...prev.terms, enabled: true, required: true } }));
      setError(refusal.terms);
      return refusal.terms;
    },
    [refusal.terms]
  );

  return { consent, marketing, terms, setMarketing, setTerms, error, blocked, payload, check, onError };
}

const row = "flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm text-ink";
const box = `mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-line-strong accent-[var(--color-primary)] ${focusRing}`;

/** The boxes themselves; nothing at all for a store that shows neither. */
export function CheckoutConsentBoxes({ state, idPrefix, className = "" }: { state: CheckoutConsentState; idPrefix: string; className?: string }) {
  const { locale, t } = useStore();
  const text = pickText(TEXT, locale);
  const { consent } = state;
  if (!consent.marketing.enabled && !consent.terms.enabled) return null;
  const own = (label: { ar: string; en: string }) => (locale === "ar" ? label.ar : label.en).trim();
  const termsId = consentTermsId(idPrefix);
  const policyNames = t.policies as unknown as Record<string, string | undefined>;

  return (
    <div className={className} data-checkout-consent="">
      {consent.marketing.enabled && (
        <label className={row}>
          <input
            type="checkbox"
            id={`${idPrefix}-accepts-marketing`}
            checked={state.marketing}
            onChange={(e) => state.setMarketing(e.target.checked)}
            className={box}
          />
          <span>{own(consent.marketing.label) || text.marketing}</span>
        </label>
      )}
      {consent.terms.enabled && (
        <div>
          <label className={row}>
            <input
              type="checkbox"
              id={termsId}
              checked={state.terms}
              required={consent.terms.required}
              aria-required={consent.terms.required || undefined}
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? `${termsId}-error` : undefined}
              onChange={(e) => state.setTerms(e.target.checked)}
              className={box}
            />
            <span>
              {own(consent.terms.label) || text.terms}
              {consent.terms.required && (
                <span aria-hidden="true" className="ms-1 text-danger">
                  *
                </span>
              )}
            </span>
          </label>
          {consent.terms.policies.length > 0 && (
            <p className="ms-8 flex flex-wrap items-center gap-x-4 text-xs text-ink-soft">
              <span>{text.read}</span>
              {consent.terms.policies.map((key) => (
                <StoreLink
                  key={key}
                  href={`/policies/${key.replace(/_/g, "-")}`}
                  target="_blank"
                  className={`inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-primary underline-offset-4 hover:underline ${focusRing}`}
                >
                  {policyNames[key] ?? key.replace(/_/g, " ")}
                </StoreLink>
              ))}
            </p>
          )}
          <p id={`${termsId}-error`} role="alert" className="ms-8 text-sm font-medium text-danger empty:hidden">
            {state.error}
          </p>
        </div>
      )}
    </div>
  );
}
