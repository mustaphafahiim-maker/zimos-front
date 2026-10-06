import { useId, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  apiErrorDetails,
  domainPurchaseCreate,
  isApiErrorCode,
  type DomainPrice,
  type DomainPriceChangedDetails,
  type DomainPurchase,
  type DomainSearchResult,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { PURCHASE_STRINGS, formatDomainPrice, yearsLabel } from "./domainPurchaseStrings";

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
  /** Any other failure: the attempt may be on record as a failed purchase with its last error. */
  onFailed: () => void;
}

/**
 * The explicit purchase step: the domain, a length (1–5 years), the
 * auto-renew switch, and the registrar's price exactly as quoted, shown as
 * "price / year × length" — no total is computed here. Confirming sends the
 * price the merchant saw (`acceptPrice`); if the registrar now quotes another,
 * the new price is shown and the merchant confirms again.
 */
export function BuyDomainDialog({ open, result, onClose, onBought, onPriceChanged, onUnavailable, onFailed }: BuyDomainDialogProps) {
  const t = useT(PURCHASE_STRINGS);
  const { intlLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const autoRenewHintId = useId();
  const [years, setYears] = useState(1);
  const [autoRenew, setAutoRenew] = useState(true);
  // The price the merchant is confirming: the search quote, or the newer one after a 409.
  const [price, setPrice] = useState<DomainPrice | null>(result.price);
  const [priceChanged, setPriceChanged] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const length = yearsLabel(t, years, intlLocale);

  async function confirm() {
    if (busy || unavailable) return;
    setBusy(true);
    setError(null);
    try {
      const purchase = await domainPurchaseCreate(apiClient, workspaceId, {
        domain: result.domain,
        years,
        autoRenew,
        acceptPrice: price,
      });
      onBought(purchase);
    } catch (err) {
      if (isApiErrorCode(err, "DOMAIN_PRICE_CHANGED")) {
        const next = apiErrorDetails<DomainPriceChangedDetails>(err)?.price ?? null;
        setPrice(next);
        setPriceChanged(true);
        onPriceChanged(result.domain, next);
      } else if (isApiErrorCode(err, "DOMAIN_UNAVAILABLE")) {
        setUnavailable(true);
        setError(errorMessage(err));
        onUnavailable(result.domain);
      } else {
        setError(errorMessage(err));
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
          <Button type="button" variant="outline" className="min-h-11 sm:min-h-0" disabled={busy} onClick={close}>
            {t.cancel}
          </Button>
          <Button type="button" className="min-h-11 sm:min-h-0" disabled={busy || unavailable} onClick={() => void confirm()}>
            {busy ? t.buying : t.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
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
            <AlertTriangle aria-hidden />
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

        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
