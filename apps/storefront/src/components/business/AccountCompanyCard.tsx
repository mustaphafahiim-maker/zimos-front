"use client";

import { useState, type FormEvent } from "react";
import { BUSINESS_LIMITS, shopperBusiness, type ShopperBusiness } from "@store-builder/api-client";
import { useAccount } from "@/components/account/AccountShell";
import { useShopperRead } from "@/components/account/AccountWalletTabs";
import { CheckIcon } from "@/components/Icons";
import { useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimary, btnSecondary, card, input, label, skeleton } from "@/components/ui";
import { isShopperSignedOutError } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";
import { useBusinessCopy } from "./businessCopy";
import { saveCompanyDetails } from "./saveCompanyDetails";

/** Its place in the profile page's grid: under the profile form, beside nothing — the sign-out card keeps the side column. */
const PLACE = "lg:col-start-1 lg:row-start-2";

/**
 * «بيانات الشركة» on the account's profile page (handoff 228): the company
 * name and tax ID the shopper buys under (GET / PUT /account/business), and
 * the «معفى من الضريبة» badge when the store exempted them. Only the store
 * gives the exemption; a changed tax ID pauses it until the store looks again,
 * and the card says so before the save.
 */
export function AccountCompanyCard() {
  const { t } = useStore();
  const copy = useBusinessCopy();
  const { api } = useAccount();
  const [state, reload] = useShopperRead<ShopperBusiness>(api, shopperBusiness);

  if (state.status === "loading") {
    return (
      <div className={`${card} ${PLACE} space-y-3 p-5 sm:p-6`} aria-hidden>
        <div className={`${skeleton} h-5 w-40`} />
        <div className={`${skeleton} h-11 w-full`} />
        <div className={`${skeleton} h-11 w-full`} />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className={`${card} ${PLACE} flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6`}>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{copy.companyTitle}</h2>
          <p className="mt-1 text-sm text-danger">{t.account.loadFailed}</p>
        </div>
        <button type="button" onClick={reload} className={btnSecondary}>
          {t.account.retry}
        </button>
      </div>
    );
  }
  return <CompanyForm initial={state.data} />;
}

function CompanyForm({ initial }: { initial: ShopperBusiness }) {
  const { t, locale } = useStore();
  const copy = useBusinessCopy();
  const { api } = useAccount();
  const basePath = useStoreBasePath();
  const [saved, setSaved] = useState(initial);
  const [companyName, setCompanyName] = useState(initial.companyName ?? "");
  const [taxId, setTaxId] = useState(initial.taxId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const taxIdChanged = taxId.trim() !== (saved.taxId ?? "");
  const dirty = companyName.trim() !== (saved.companyName ?? "") || taxIdChanged;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !dirty) return;
    setBusy(true);
    setMessage(null);
    try {
      const next = await saveCompanyDetails(api, { basePath, locale }, { companyName: companyName.trim(), taxId: taxId.trim() });
      const paused = saved.taxExempt && !next.taxExempt;
      setSaved(next);
      setCompanyName(next.companyName ?? "");
      setTaxId(next.taxId ?? "");
      setMessage({ tone: "ok", text: paused ? copy.exemptionPaused : copy.saved });
    } catch (err) {
      // A 401 has already dropped the token: the sign-in shows by itself.
      if (!isShopperSignedOutError(err)) setMessage({ tone: "error", text: copy.saveFailed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className={`${card} ${PLACE} space-y-4 p-5 sm:p-6`} aria-labelledby="company-title">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 id="company-title" className="text-base font-semibold text-ink">
            {copy.companyTitle}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{copy.companyHint}</p>
        </div>
        {saved.taxExempt && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
            <CheckIcon size={14} />
            {copy.taxExempt}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="company-name" className={label}>
          {copy.companyName}
          <span className="ms-1 text-xs font-normal text-ink-soft">({t.common.optional})</span>
        </label>
        <input
          id="company-name"
          type="text"
          autoComplete="organization"
          dir="auto"
          maxLength={BUSINESS_LIMITS.companyName}
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className={input}
        />
      </div>
      <div>
        <label htmlFor="company-tax-id" className={label}>
          {copy.taxId}
          <span className="ms-1 text-xs font-normal text-ink-soft">({t.common.optional})</span>
        </label>
        <input
          id="company-tax-id"
          type="text"
          autoComplete="off"
          dir="ltr"
          maxLength={BUSINESS_LIMITS.taxId}
          value={taxId}
          onChange={(e) => setTaxId(e.target.value)}
          aria-describedby={saved.taxExempt ? "company-tax-id-note" : undefined}
          className={`${input} text-start rtl:text-end`}
        />
        {saved.taxExempt && (
          <p id="company-tax-id-note" className={`mt-1 text-xs ${taxIdChanged ? "font-medium text-accent-dark" : "text-ink-soft"}`}>
            {taxIdChanged ? copy.taxIdWarning : copy.taxExemptHint}
          </p>
        )}
      </div>

      <div aria-live="polite" className="empty:hidden">
        {message && (
          <p className={`rounded-xl px-4 py-3 text-sm ${message.tone === "ok" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
            {message.text}
          </p>
        )}
      </div>

      <button type="submit" disabled={busy || !dirty} className={`${btnPrimary} w-full sm:w-auto`}>
        {busy ? copy.saving : copy.save}
      </button>
    </form>
  );
}
