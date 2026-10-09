import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { IconStore, IconWarning } from "@/components/icons";
import { Alert, Button, buttonVariants, cn } from "@store-builder/ui";
import {
  apiErrorDetails,
  domainPurchaseCreateWithOwner,
  isApiErrorCode,
  type DomainPrice,
  type DomainPriceChangedDetails,
  type DomainPurchase,
  type DomainSearchResult,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { PURCHASE_STRINGS, formatDomainPrice, yearsLabel } from "./domainPurchaseStrings";
import { isDomainPurchaseUnavailable, useDomainNameRefusal } from "./DomainPurchaseAvailability";
// Handoff 326 / 325: the «صاحب الدومين» step where the registrar needs it, and the registrar's and price's refusals.
import { useDomainOwnerStep, useDomainPurchaseErrorMessage } from "./DomainOwnerStep";

/** The lengths offered when buying (handoff item 176: 1–5 years). */
const YEARS = [1, 2, 3, 4, 5] as const;

interface BuyDomainDialogProps {
  open: boolean;
  /** The search result being bought; the dialog is keyed by it, so it starts fresh each time. */
  result: DomainSearchResult;
  onClose: () => void;
  onBought: (purchase: DomainPurchase) => void;
  /** The registrar quoted another price at purchase time (409 DOMAIN_PRICE_CHANGED). */
  onPriceChanged: (domain: string, price: DomainPrice | null) => void;
  /** The domain was taken in the meantime (409 DOMAIN_UNAVAILABLE). */
  onUnavailable: (domain: string) => void;
  /** Bought, but connecting it to the store failed (502 DOMAIN_CONNECT_FAILED): support finishes it. */
  onConnectFailed: (domain: string) => void;
  /** Any other failure: the attempt may be on record as a failed purchase with its last error. */
  onFailed: () => void;
  /** No registrar on this server (503 DOMAIN_PURCHASE_UNAVAILABLE, handoff 305): nothing was attempted; the section says so. */
  onPurchaseUnavailable: (err: unknown) => void;
}

/**
 * The explicit purchase step: the domain, a length (1–5 years), the
 * auto-renew switch, and the registrar's price exactly as quoted, shown as
 * "price / year × length" — no total is computed here. Confirming sends the
 * price the merchant saw (`acceptPrice`); if the registrar now quotes another,
 * the new price is shown and the merchant confirms again. A store without a
 * website is told to set one up first (nothing is bought); a domain bought
 * but not connected (502 DOMAIN_CONNECT_FAILED) is handed to the section,
 * which says so instead of "nothing was charged".
 */
export function BuyDomainDialog({ open, result, onClose, onBought, onPriceChanged, onUnavailable, onConnectFailed, onFailed, onPurchaseUnavailable }: BuyDomainDialogProps) {
  const t = useT(PURCHASE_STRINGS);
  const nameRefusal = useDomainNameRefusal();
  const { intlLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const errorMessage = useDomainPurchaseErrorMessage();
  const autoRenewHintId = useId();
  const [years, setYears] = useState(1);
  const [autoRenew, setAutoRenew] = useState(true);
  // The price the merchant is confirming: the search quote, or the newer one after a 409.
  const [price, setPrice] = useState<DomainPrice | null>(result.price);
  const [priceChanged, setPriceChanged] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  // 409 STORE_NOT_SET_UP: checked before anything is bought; the merchant sets up a website first.
  const [notSetUp, setNotSetUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const owner = useDomainOwnerStep({ busy });

  const length = yearsLabel(t, years, intlLocale);

  async function confirm() {
    if (busy || unavailable || notSetUp) return;
    // The owner's details, where the registrar needs them; a form with mistakes stops here, on its step.
    const who = owner.contact();
    if (!who.ok) return;
    setBusy(true);
    setError(null);
    try {
      const purchase = await domainPurchaseCreateWithOwner(apiClient, workspaceId, {
        domain: result.domain,
        years,
        autoRenew,
        acceptPrice: price,
        contact: who.contact,
      });
      onBought(purchase);
    } catch (err) {
      if (owner.refused(err)) {
        // Said on the owner step, under the field it is about.
      } else if (isApiErrorCode(err, "DOMAIN_PRICE_CHANGED")) {
        const next = apiErrorDetails<DomainPriceChangedDetails>(err)?.price ?? null;
        setPrice(next);
        setPriceChanged(true);
        onPriceChanged(result.domain, next);
        owner.back();
      } else if (isApiErrorCode(err, "DOMAIN_UNAVAILABLE")) {
        setUnavailable(true);
        setError(errorMessage(err));
        onUnavailable(result.domain);
        owner.back();
      } else if (isApiErrorCode(err, "STORE_NOT_SET_UP")) {
        setNotSetUp(true);
        owner.back();
      } else if (isApiErrorCode(err, "DOMAIN_CONNECT_FAILED")) {
        // The domain WAS bought: never "nothing was charged", and never offer to buy it again.
        onConnectFailed(result.domain);
      } else if (isDomainPurchaseUnavailable(err)) {
        onPurchaseUnavailable(err);
      } else {
        // A name that can't be bought here (422 on `domain`) is said in the merchant's words.
        setError(nameRefusal(err) ?? errorMessage(err));
        onFailed();
      }
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t.dialogTitle}
      description={t.dialogDescription}
      footer={
        <>
          <Button type="button" variant="outline" className="min-h-11 sm:min-h-0" disabled={busy} onClick={owner.onStep ? owner.back : close}>
            {owner.onStep ? owner.labels.back : t.cancel}
          </Button>
          <Button
            type="button"
            className="min-h-11 sm:min-h-0"
            disabled={busy || unavailable || notSetUp || owner.loading}
            onClick={() => (owner.required && !owner.onStep ? owner.begin() : void confirm())}
          >
            {busy ? t.buying : owner.required && !owner.onStep ? owner.labels.next : t.confirm}
          </Button>
        </>
      }
    >
      {owner.onStep && (
        <div className="space-y-4">
          {owner.node}
          {error && <Alert variant="danger">{error}</Alert>}
        </div>
      )}
      <div className={cn("space-y-4", owner.onStep && "hidden")}>
        <div className="rounded-[var(--radius-card)] bg-paper-sunken px-4 py-3">
          <p className="text-xs text-ink-soft">{t.domain}</p>
          <p className="break-words text-lg font-semibold text-ink">
            <bdi dir="ltr">{result.domain}</bdi>
          </p>
        </div>

        <Field label={t.length}>
          {({ id }) => (
            <Select id={id} value={years} disabled={busy} onChange={(e) => setYears(Number(e.target.value))} className="min-h-11 sm:min-h-10">
              {YEARS.map((n) => (
                <option key={n} value={n}>
                  {yearsLabel(t, n, intlLocale)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="space-y-1">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              role="switch"
              className="size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
              checked={autoRenew}
              disabled={busy}
              aria-describedby={autoRenewHintId}
              onChange={(e) => setAutoRenew(e.target.checked)}
            />
            {t.autoRenew}
          </label>
          <p id={autoRenewHintId} className="text-xs text-ink-soft">
            {t.autoRenewHint}
            {/* After a new quote only the first-year price is known again, so the old renewal price is not repeated. */}
            {autoRenew && result.renewalPrice && !priceChanged && (
              <>
                {" "}
                {fmt(t.renewalPrice, { price: formatDomainPrice(result.renewalPrice) })}
              </>
            )}
          </p>
        </div>

        {priceChanged && (
          <Alert className="border-accent/40 bg-accent-soft text-accent-dark">
            <IconWarning aria-hidden />
            <p className="font-medium">{t.priceChanged}</p>
          </Alert>
        )}

        <dl
          className={cn(
            "flex items-start justify-between gap-3 rounded-[var(--radius-card)] px-4 py-3 ring-1",
            priceChanged ? "bg-accent-soft ring-accent/40" : "bg-paper-raised ring-line"
          )}
          aria-live="polite"
        >
          <dt className="text-sm text-ink-soft">{t.price}</dt>
          <dd className="text-end text-[15px] font-semibold text-ink">
            {price ? (
              <bdi className="tabular-nums">{fmt(t.priceTimesYears, { price: formatDomainPrice(price), years: length })}</bdi>
            ) : (
              <>
                {t.priceOnRequest}
                <span className="block text-xs font-normal text-ink-soft">{length}</span>
              </>
            )}
          </dd>
        </dl>

        {notSetUp && (
          <Alert className="border-accent/40 bg-accent-soft text-accent-dark">
            <IconWarning aria-hidden />
            <div className="space-y-2">
              <p className="font-medium">{t.storeNotSetUp}</p>
              <Link to="/website" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11 bg-paper-raised sm:min-h-8")}>
                <IconStore className="size-4" aria-hidden />
                {t.setUpWebsite}
              </Link>
            </div>
          </Alert>
        )}

        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
