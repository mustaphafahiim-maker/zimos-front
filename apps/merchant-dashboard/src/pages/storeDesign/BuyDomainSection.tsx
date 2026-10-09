import { useRef, useState, type FormEvent } from "react";
import { IconCart, IconSearch, IconSuccess, IconWarning } from "@/components/icons";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  domainRegistrantGet,
  domainSearch,
  isApiErrorCode,
  storeDesignCheckDomainSsl,
  type DomainPrice,
  type DomainPurchase,
  type DomainSearchResponse,
  type DomainSearchResult,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDate } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { Section } from "@/components/Section";
import { Field } from "@/components/Field";
import { StatusBadge } from "@/components/StatusBadge";
import { BuyDomainDialog } from "./BuyDomainDialog";
import { PURCHASE_STRINGS, formatDomainPrice, placeNode } from "./domainPurchaseStrings";
// Handoff 305: no registrar on this server, and the endings a name can be bought on.
import { DomainPurchaseUnavailableNotice, useDomainPurchaseAvailability } from "./DomainPurchaseAvailability";
import { useDomainPurchaseErrorMessage } from "./DomainOwnerStep";

interface BuyDomainSectionProps {
  /** A domain was bought: it is now one of the store's domains and a bought domain. */
  onBought: (purchase: DomainPurchase) => void;
  /**
   * A purchase attempt failed; it may be listed as a failed purchase now (and,
   * when it was bought but not connected, the domain may be among the store's).
   */
  onPurchaseFailed: () => void;
}

/**
 * Store settings → Domains → "Buy a domain" (handoff item 176): search a name,
 * see each candidate's availability and the registrar's price per year as
 * quoted (or "Price on request"), buy one in a confirmation dialog. After the
 * purchase the store is connected to it with its DNS set by the platform.
 */
export function BuyDomainSection({ onBought, onPurchaseFailed }: BuyDomainSectionProps) {
  const t = useT(PURCHASE_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useDomainPurchaseErrorMessage();
  // Handoff 325: a name the registrar did not price can't be bought. Only the development sandbox — the one
  // registrar that asks for no owner details (`required: false`) — sells without a price, so there «اشتري» stays on.
  const registrant = useAsync(() => domainRegistrantGet(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const sandboxRegistrar = registrant.data?.required === false;
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [response, setResponse] = useState<DomainSearchResponse | null>(null);
  const [buying, setBuying] = useState<DomainSearchResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRun, setDialogRun] = useState(0);
  const [bought, setBought] = useState<DomainPurchase | null>(null);
  // Bought, but not connected yet (502 DOMAIN_CONNECT_FAILED): support finishes it.
  const [notConnected, setNotConnected] = useState<string | null>(null);
  const availability = useDomainPurchaseAvailability();
  const searchId = useRef(0);

  async function search(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const id = ++searchId.current;
    setSearching(true);
    setQueryError(null);
    setSearchError(null);
    try {
      const found = await domainSearch(apiClient, workspaceId, q);
      if (id === searchId.current) setResponse(found);
    } catch (err) {
      if (id !== searchId.current) return;
      setResponse(null);
      if (availability.refused(err)) return;
      if (isApiErrorCode(err, "VALIDATION_ERROR")) setQueryError(t.badQuery);
      else setSearchError(errorMessage(err));
    } finally {
      if (id === searchId.current) setSearching(false);
    }
  }

  /** Keeps a listed name in step with what the purchase attempt learned from the registrar. */
  function updateResult(domain: string, patch: Partial<DomainSearchResult>) {
    setResponse((prev) => prev && { ...prev, results: prev.results.map((r) => (r.domain === domain ? { ...r, ...patch } : r)) });
    setBuying((prev) => (prev && prev.domain === domain ? { ...prev, ...patch } : prev));
  }

  function openBuy(result: DomainSearchResult) {
    setBuying(result);
    setDialogRun((n) => n + 1);
    setDialogOpen(true);
  }

  async function handleBought(purchase: DomainPurchase) {
    setDialogOpen(false);
    setBought(purchase);
    setResponse(null);
    setQuery("");
    // Like a domain verified by hand, a bought one (verified at once: we hold its DNS) asks for its certificate straight away.
    if (purchase.domainId) await storeDesignCheckDomainSsl(apiClient, workspaceId, purchase.domainId).catch(() => undefined);
    onBought(purchase);
  }

  function handleConnectFailed(domain: string) {
    setDialogOpen(false);
    setNotConnected(domain);
    setResponse(null);
    setQuery("");
    onPurchaseFailed();
  }

  const domainNode = (domain: string) => (
    <bdi dir="ltr" className="break-words">
      {domain}
    </bdi>
  );

  if (bought) {
    return (
      <Section title={t.buyTitle}>
        <div role="status" className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] bg-success-soft px-4 py-4 sm:flex-row sm:items-center">
          <IconSuccess className="size-6 shrink-0 text-success" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">{placeNode(t.liveOn, "domain", domainNode(bought.hostname))}</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {t.sslSoon}
              {bought.expiresAt && <> {fmt(t.registeredUntil, { date: formatDate(bought.expiresAt) })}</>}
            </p>
          </div>
          <Button type="button" variant="outline" className="min-h-11 sm:min-h-0" onClick={() => setBought(null)}>
            {t.buyAnother}
          </Button>
        </div>
      </Section>
    );
  }

  if (notConnected) {
    return (
      <Section title={t.buyTitle}>
        <div role="status" className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] bg-accent-soft px-4 py-4 sm:flex-row sm:items-center">
          <IconWarning className="size-6 shrink-0 text-accent-dark" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">{placeNode(t.connectFailedTitle, "domain", domainNode(notConnected))}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{t.connectFailedBody}</p>
          </div>
          <Button type="button" variant="outline" className="min-h-11 bg-paper-raised sm:min-h-0" onClick={() => setNotConnected(null)}>
            {t.buyAnother}
          </Button>
        </div>
      </Section>
    );
  }

  if (availability.unavailable) {
    return (
      <Section title={t.buyTitle}>
        <DomainPurchaseUnavailableNotice />
      </Section>
    );
  }

  const results = response?.results ?? [];

  return (
    // Bought once in a while: folded to one row. Kept mounted, so the name being searched survives a fold.
    <AccordionSection title={t.buyTitle} summary={t.buyDescription} icon={IconCart} persistKey="store-settings:domains:buy" keepMounted>
      <p className="mb-3 text-[13px] leading-5 text-ink-soft">{t.buyDescription}</p>
      <form onSubmit={search} className="flex flex-wrap items-start gap-2" role="search">
        <Field label={t.searchLabel} error={queryError ?? undefined} hint={availability.endingsHint} labelHidden className="min-w-0 flex-1 basis-48">
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="search"
              dir="ltr"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-11 sm:min-h-10"
            />
          )}
        </Field>
        <Button type="submit" className="min-h-11 rounded-full px-5 sm:min-h-10" disabled={searching || !query.trim()}>
          <IconSearch className="size-4" aria-hidden />
          {searching ? t.searching : t.search}
        </Button>
      </form>

      {searchError && (
        <Alert variant="danger" className="mt-3">
          {searchError}
        </Alert>
      )}

      <div aria-live="polite" aria-busy={searching}>
        {response && (
          <div className="mt-4">
            <p className="text-xs text-ink-soft">
              {placeNode(t.resultsFor, "query", <bdi>{response.query}</bdi>)}
            </p>
            {results.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">{t.noResults}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {results.map((result) => (
                  <li key={result.domain} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="text-[15px] font-medium text-ink">{domainNode(result.domain)}</p>
                      {result.available && (
                        <p className="mt-0.5 text-sm text-ink-soft">
                          {result.price ? (
                            <bdi className="tabular-nums">{fmt(t.perYear, { price: formatDomainPrice(result.price) })}</bdi>
                          ) : (
                            t.priceUnavailable
                          )}
                        </p>
                      )}
                    </div>
                    <StatusBadge
                      value={result.available ? "available" : "taken"}
                      tone={result.available ? "success" : "neutral"}
                      text={result.available ? t.available : t.taken}
                    />
                    {result.available && (
                      <Button
                        type="button"
                        className="min-h-11 sm:min-h-0"
                        aria-label={fmt(t.buyNamed, { domain: result.domain })}
                        disabled={!result.price && !sandboxRegistrar}
                        onClick={() => openBuy(result)}
                      >
                        {t.buy}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {buying && (
        <BuyDomainDialog
          key={`${buying.domain}:${dialogRun}`}
          open={dialogOpen}
          result={buying}
          onClose={() => setDialogOpen(false)}
          onBought={(purchase) => void handleBought(purchase)}
          onPriceChanged={(domain, price: DomainPrice | null) => updateResult(domain, { price })}
          onUnavailable={(domain) => updateResult(domain, { available: false, price: null, renewalPrice: null })}
          onConnectFailed={handleConnectFailed}
          onFailed={onPurchaseFailed}
          onPurchaseUnavailable={(err) => {
            setDialogOpen(false);
            availability.refused(err);
          }}
        />
      )}
    </AccordionSection>
  );
}
