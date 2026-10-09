import { Button } from "@store-builder/ui";
import { quoteGet, type Quote, type QuoteSummary } from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import { IconCancelled, IconOrders } from "@/components/icons";
import { QuickLook } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { dialablePhone } from "@/pages/home/today/OrderQuickLook";
import { variantDetail } from "@/pages/inventory/inventoryText";
import { InlineBone } from "@/pages/returns/rowkit/RowBits";
import { BlockLabel, FactList, Well } from "./kit/Facts";
import { QUOTE_STATUS_KEY, QUOTE_STATUS_TONE, QUOTE_STRINGS, isQuoteOpen } from "./quoteStrings";

/** Both actions of the footer share one height with the "open fully" pill beside them. */
const FOOTER_PILL = "h-11 rounded-full px-4 text-[13px] pointer-fine:h-10";

/** Where a quote's full record is kept between the preview and its page: both read the same entry. */
export function quoteCacheKey(workspaceId: string, quoteId: string): string {
  return `quote:${workspaceId}:${quoteId}`;
}

export interface QuoteQuickLookProps {
  /** The request being looked at. Null draws nothing (keep the last one while the panel closes). */
  quote: QuoteSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** This role may answer and cancel quotes. */
  canManage: boolean;
  onCancel: () => void;
}

/**
 * A quote request at a glance, without leaving the inbox: who asked and how
 * to reach them, what they wrote, what they asked for, and — once priced —
 * what the offer comes to. The inbox row only knows how many products there
 * are, so the request itself is read when the preview opens (and kept: "open
 * fully" then shows the page at once). The lines hold their room while it is
 * on its way.
 */
export function QuoteQuickLook({ quote, open, onOpenChange, canManage, onCancel }: QuoteQuickLookProps) {
  const t = useT(QUOTE_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const quoteId = quote?.id ?? null;
  const loaded = useCachedAsync<Quote | null>(
    quoteId ? quoteCacheKey(workspaceId, quoteId) : null,
    () => (quoteId ? quoteGet(apiClient, workspaceId, quoteId) : Promise.resolve(null)),
    [workspaceId, quoteId]
  );
  if (!quote) return null;

  // The hook keeps the last answer until the next one lands: only the record of THIS request is shown.
  const full = loaded.data && loaded.data.id === quote.id ? loaded.data : null;
  const status = full?.status ?? quote.status;
  const name = quote.contact.fullName.trim();
  const company = quote.contact.company?.trim() || "";
  const rawPhone = quote.contact.phone?.trim() || "";
  const phone = dialablePhone(rawPhone);
  const currency = full?.currency ?? currentWorkspace?.defaultCurrency ?? "EGP";
  const priced = full ? full.totalAmount !== null : false;
  const cancellable = canManage && isQuoteOpen(status);

  return (
    <QuickLook
      open={open}
      onOpenChange={onOpenChange}
      title={<bdi dir="ltr">{quote.number}</bdi>}
      subtitle={<bdi>{name}</bdi>}
      status={<StatusBadge value={status} tone={QUOTE_STATUS_TONE[status]} text={t[QUOTE_STATUS_KEY[status]]} />}
      to={`/quotes/${quote.id}`}
      // A new request is opened to price it: the button says so.
      openLabel={status === "new" && canManage ? t.setPrices : undefined}
      actions={
        quote.orderId || cancellable ? (
          <>
            {cancellable && (
              <Button type="button" variant="outline" className={`${FOOTER_PILL} text-danger hover:text-danger`} onClick={onCancel}>
                <IconCancelled className="size-4" weight="bold" aria-hidden />
                {t.cancelQuote}
              </Button>
            )}
            {quote.orderId && (
              <Button asChild variant="outline" className={FOOTER_PILL}>
                <ViewLink to={`/orders/${quote.orderId}`}>
                  <IconOrders className="size-4" weight="bold" aria-hidden />
                  {t.openOrder}
                </ViewLink>
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-ink-soft">
          <time dateTime={quote.createdAt} title={formatDateTime(quote.createdAt)}>
            {fmt(t.receivedAgo, { when: formatRelativeTime(quote.createdAt) })}
          </time>
          <span aria-hidden>·</span>
          <span>{formatDate(quote.createdAt)}</span>
        </p>

        <section>
          <BlockLabel>{t.customerTitle}</BlockLabel>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
            <div className="min-w-0">
              <p className="truncate text-[15px] leading-6 font-medium text-ink">
                <bdi>{name}</bdi>
                {company && (
                  <span className="font-normal text-ink-soft">
                    {" · "}
                    <bdi>{company}</bdi>
                  </span>
                )}
              </p>
              <p className="text-sm leading-5 text-ink-soft tabular-nums">
                <bdi dir="ltr">{rawPhone}</bdi>
              </p>
              {quote.contact.email && (
                <a
                  href={`mailto:${quote.contact.email}`}
                  className="inline-flex min-h-11 items-center text-sm break-all text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary pointer-fine:min-h-0"
                >
                  <bdi dir="ltr">{quote.contact.email}</bdi>
                </a>
              )}
            </div>
            {phone && <ContactActions phone={phone} name={name || undefined} />}
          </div>
        </section>

        {full?.message && <Well caption={t.messageTitle}>{full.message}</Well>}

        <section>
          <BlockLabel>
            {t.qlAsked} · {countOf("item", quote.lineCount)}
          </BlockLabel>
          {full ? (
            <ul className="space-y-1">
              {full.lines.map((line) => {
                const detail = variantDetail(line.optionValues, line.sku);
                const leftOut = priced && line.unitPrice === null;
                return (
                  <li key={line.variantId} className="flex min-h-12 items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm leading-5 font-medium text-ink">
                        <bdi>{line.productName ?? t.unknownProduct}</bdi>
                      </p>
                      <p className="truncate text-xs leading-4 text-ink-soft">
                        {detail && (
                          <>
                            <bdi>{detail}</bdi>
                            {" · "}
                          </>
                        )}
                        {leftOut ? t.qlNotOffered : fmt(t.requested, { pieces: countOf("piece", line.requestedQuantity) })}
                      </p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-sm leading-5 font-semibold text-ink tabular-nums">
                        {priced && line.lineTotal !== null ? (
                          <bdi dir="ltr">{formatMoney(line.lineTotal, currency)}</bdi>
                        ) : (
                          <bdi dir="ltr">{fmt(t.qlTimes, { n: line.requestedQuantity })}</bdi>
                        )}
                      </p>
                      {priced && line.unitPrice !== null && (
                        <p className="text-xs leading-4 text-ink-soft tabular-nums">
                          <bdi dir="ltr">
                            {fmt(t.qlTimes, { n: line.quantity })} · {formatMoney(line.unitPrice, currency)}
                          </bdi>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : loaded.error ? (
            <p role="alert" className="text-sm leading-6 text-ink-soft">
              {t.qlLinesFailed}
            </p>
          ) : (
            // As many lines as the row said there are (three at most), each as tall as a real one.
            <ul aria-hidden className="space-y-1">
              {Array.from({ length: Math.min(Math.max(quote.lineCount, 1), 3) }, (_, index) => (
                <li key={index} className="flex min-h-12 flex-col justify-center gap-1 text-sm leading-5">
                  <InlineBone className="w-40" />
                  <InlineBone className="h-2.5 w-24" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <FactList
          rows={[
            full && full.totalAmount !== null && {
              label: t.total,
              value: (
                <bdi dir="ltr" className="tabular-nums">
                  {formatMoney(full.totalAmount, currency)}
                </bdi>
              ),
            },
            full?.quotedAt ? { label: t.quotedOn, value: formatDateTime(full.quotedAt) } : null,
            quote.validUntil ? { label: t.validUntil, value: formatDate(quote.validUntil) } : null,
          ]}
        />

        {full?.quotedNote && <Well caption={t.note}>{full.quotedNote}</Well>}
      </div>
    </QuickLook>
  );
}
