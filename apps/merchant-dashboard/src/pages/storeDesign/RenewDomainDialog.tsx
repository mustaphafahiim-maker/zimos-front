import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, Button, Spinner, cn } from "@store-builder/ui";
import {
  apiErrorDetails,
  domainPurchaseRenew,
  domainPurchaseRenewQuote,
  isApiErrorCode,
  type DomainPriceChangedDetails,
  type DomainPurchase,
  type DomainRenewQuote,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { PURCHASE_STRINGS, formatDomainPrice, placeNode, yearsLabel } from "./domainPurchaseStrings";

/** Renewal lengths: everything the API accepts (1–10 years). */
const YEARS = Array.from({ length: 10 }, (_, i) => i + 1);

interface RenewDomainDialogProps {
  /** The bought domain being renewed; the dialog is keyed by it, so it starts fresh each time. */
  purchase: DomainPurchase;
  onClose: () => void;
  onRenewed: (purchase: DomainPurchase) => void;
  /** The purchase is no longer renewable (409 DOMAIN_NOT_ACTIVE) or a renewal failed: read the list again. */
  onStale: () => void;
}

type QuoteState =
  | { state: "loading" }
  | { state: "ready"; quote: DomainRenewQuote }
  | { state: "error"; message: string };

/**
 * "Renew now" on a bought domain (frontend request 2026-10-06): pick a length
 * (1–10 years), see the registrar's quote — «جدّد بـ {price} لحد {date}» — and
 * confirm. Confirming sends the quoted price back (`acceptPrice`); if the
 * registrar now asks another, the new price is shown and the merchant
 * confirms again. A null quote is "Price on request", as when buying.
 */
export function RenewDomainDialog({ purchase, onClose, onRenewed, onStale }: RenewDomainDialogProps) {
  const t = useT(PURCHASE_STRINGS);
  const { intlLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [years, setYears] = useState(1);
  const [quote, setQuote] = useState<QuoteState>({ state: "loading" });
  const [quoteRun, setQuoteRun] = useState(0);
  const [priceChanged, setPriceChanged] = useState(false);
  const [notActive, setNotActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const quoteId = useRef(0);

  // Each length has its own quote; a slower answer for a length no longer chosen is dropped.
  useEffect(() => {
    const id = ++quoteId.current;
    setQuote({ state: "loading" });
    setPriceChanged(false);
    setError(null);
    domainPurchaseRenewQuote(apiClient, workspaceId, purchase.id, years).then(
      (next) => {
        if (id === quoteId.current) setQuote({ state: "ready", quote: next });
      },
      (err) => {
        if (id !== quoteId.current) return;
        if (isApiErrorCode(err, "DOMAIN_NOT_ACTIVE")) {
          setNotActive(true);
          onStale();
        }
        setQuote({ state: "error", message: errorMessage(err, { DOMAIN_NOT_ACTIVE: t.renewNotActive }) });
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-quoted when the length changes or on "Try again"
  }, [workspaceId, purchase.id, years, quoteRun]);

  async function confirm() {
    if (busy || quote.state !== "ready" || notActive) return;
    setBusy(true);
    setError(null);
    try {
      const renewed = await domainPurchaseRenew(apiClient, workspaceId, purchase.id, years, quote.quote.price);
      onRenewed(renewed);
    } catch (err) {
      if (isApiErrorCode(err, "DOMAIN_PRICE_CHANGED")) {
        // The new quote is for the same length, so the new expiry date still holds.
        const price = apiErrorDetails<DomainPriceChangedDetails>(err)?.price ?? null;
        setQuote({ state: "ready", quote: { ...quote.quote, price } });
        setPriceChanged(true);
      } else {
        if (isApiErrorCode(err, "DOMAIN_NOT_ACTIVE")) setNotActive(true);
        setError(errorMessage(err, { DOMAIN_NOT_ACTIVE: t.renewNotActive }));
        // A failed renewal is recorded as the purchase's last error; a stale one has another status now.
        onStale();
      }
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    if (!busy) onClose();
  };

  const ready = quote.state === "ready" ? quote.quote : null;
  // Isolated (as in the buy dialog) so the amount keeps its own order inside the sentence.
  const priceNode = (text: string) => <bdi className="tabular-nums">{text}</bdi>;

  return (
    <Modal
      open
      onClose={close}
      title={t.renewTitle}
      footer={
        <>
          <Button type="button" variant="outline" className="min-h-11 sm:min-h-0" disabled={busy} onClick={close}>
            {t.cancel}
          </Button>
          <Button type="button" className="min-h-11 sm:min-h-0" disabled={busy || !ready || notActive} onClick={() => void confirm()}>
            {busy ? t.renewing : t.renewNow}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          {placeNode(
            fmt(t.renewBody, { date: formatDate(purchase.expiresAt), domain: "{domain}" }),
            "domain",
            <bdi dir="ltr" className="font-medium text-ink">
              {purchase.hostname}
            </bdi>
          )}
        </p>

        <Field label={t.renewFor}>
          {({ id }) => (
            <Select
              id={id}
              value={years}
              disabled={busy || notActive}
              onChange={(e) => setYears(Number(e.target.value))}
              className="min-h-11 sm:min-h-10"
            >
              {YEARS.map((n) => (
                <option key={n} value={n}>
                  {yearsLabel(t, n, intlLocale)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {priceChanged && (
          <Alert className="border-accent/40 bg-accent-soft text-accent-dark">
            <AlertTriangle aria-hidden />
            <p className="font-medium">{t.priceChanged}</p>
          </Alert>
        )}

        <div aria-live="polite" aria-busy={quote.state === "loading"}>
          {quote.state === "loading" && (
            <p className="flex min-h-16 items-center gap-2 rounded-[var(--radius-card)] bg-paper-sunken px-4 py-3 text-sm text-ink-soft">
              <Spinner className="size-4" aria-hidden />
              {t.quoteLoading}
            </p>
          )}
          {quote.state === "error" && (
            <div className="space-y-2">
              <Alert variant={notActive ? "default" : "danger"}>{quote.message}</Alert>
              {!notActive && (
                <Button type="button" size="sm" variant="outline" className="min-h-11 sm:min-h-8" onClick={() => setQuoteRun((n) => n + 1)}>
                  {t.retry}
                </Button>
              )}
            </div>
          )}
          {ready && (
            <div
              className={cn(
                "rounded-[var(--radius-card)] px-4 py-3 ring-1",
                priceChanged ? "bg-accent-soft ring-accent/40" : "bg-paper-raised ring-line"
              )}
            >
              {ready.price ? (
                <p className="text-[15px] font-semibold text-ink">
                  {placeNode(fmt(t.renewQuote, { date: formatDate(ready.expiresAt), price: "{price}" }), "price", priceNode(formatDomainPrice(ready.price)))}
                </p>
              ) : (
                <>
                  <p className="text-[15px] font-semibold text-ink">{fmt(t.renewQuoteNoPrice, { date: formatDate(ready.expiresAt) })}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{t.renewPriceLater}</p>
                </>
              )}
            </div>
          )}
        </div>

        {error && <Alert variant={notActive ? "default" : "danger"}>{error}</Alert>}
      </div>
    </Modal>
  );
}
