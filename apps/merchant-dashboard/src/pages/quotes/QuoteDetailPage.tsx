import { useState } from "react";
import { useParams } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import { isApiErrorCode, quoteCancel, quoteGet, type Quote, type QuoteLine } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { invalidateCached, useCachedAsync } from "@/lib/useCachedAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { canManageOrders } from "@/lib/inventoryAccess";
import { UnsavedGuardProvider, useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { useViewNavigate } from "@/lib/viewTransition";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { storeUrl } from "@/lib/storeAddress";
import { countOf } from "@/lib/plural";
import { fmt, useT } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ContactActions } from "@/components/ContactActions";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { CopyButton } from "@/components/CopyButton";
import { CardSkeleton, DataState } from "@/components/DataState";
import { IconCancelled, IconCopy, IconCustomers, IconOrders, IconQuotes } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { LeaveGuard } from "@/pages/catalog/product/LeaveGuard";
import { dialablePhone } from "@/pages/home/today/OrderQuickLook";
import { variantDetail } from "@/pages/inventory/inventoryText";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { FactList, Well } from "./kit/Facts";
import { MoreMenu } from "./kit/MoreMenu";
import { QuoteEditor } from "./QuoteEditor";
import { quoteCacheKey } from "./QuoteQuickLook";
import { QUOTE_STATUS_KEY, QUOTE_STATUS_TONE, QUOTE_STRINGS, isQuoteOpen } from "./quoteStrings";

/** A quote number is read left to right wherever it stands; the title is plain text, so the marks do what <bdi> would. */
const isolate = (value: string) => `⁦${value}⁩`;

/**
 * Keyed by the quote in the URL, so moving between two requests starts clean —
 * and each gets its own unsaved-changes guard: prices typed but not sent arm
 * the browser's "leave?" question, and the links of the page ask first.
 */
export function QuoteDetailPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const workspaceId = useWorkspaceId();
  return (
    <UnsavedGuardProvider key={`${workspaceId}:${quoteId}`}>
      <QuoteView quoteId={quoteId ?? ""} />
    </UnsavedGuardProvider>
  );
}

/**
 * One quote request (handoff 219, 275): who asked and for what, and — while
 * it is open — the editor that sets the prices and sends them. Once the
 * shopper answered it is read only, with the order it became. The new-request
 * notification links here (/quotes/:id).
 *
 * Top to bottom on a phone: the header (number, status, «…» with what is done
 * rarely), who asked and how to reach them, then the products. A request
 * already seen in the inbox's preview is on screen from the first frame and is
 * read again behind.
 */
function QuoteView({ quoteId }: { quoteId: string }) {
  const t = useT(QUOTE_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageOrders(currentWorkspace?.role);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const navigate = useViewNavigate();
  const copy = useCopy();
  const { confirmLeave } = useUnsavedGuard();

  const quote = useCachedAsync<Quote>(quoteCacheKey(workspaceId, quoteId), () => quoteGet(apiClient, workspaceId, quoteId), [workspaceId, quoteId]);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // The hook keeps the last answer until the next one lands: only the record of THIS request is shown.
  const q = quote.data && quote.data.id === quoteId ? quote.data : null;
  const open = q ? isQuoteOpen(q.status) : false;
  const currency = q?.currency ?? currentWorkspace?.defaultCurrency ?? "EGP";
  const shopperLink = q && open && q.quotedAt && currentWorkspace?.slug ? `${storeUrl(currentWorkspace.slug)}/quotes/${q.id}` : null;

  /** The inbox keeps its lists for the session: after a change here they are read again. */
  const forgetLists = () => invalidateCached(`quotes:${workspaceId}:`);

  /** The shopper answered (or a teammate cancelled) meanwhile: say so and show the quote as it is now. */
  function closedMeanwhile() {
    setNotice(t.closedNotice);
    forgetLists();
    void quote.refresh({ silent: true });
  }

  async function confirmCancel() {
    if (!q) return;
    try {
      quote.setData(await quoteCancel(apiClient, workspaceId, q.id));
    } catch (err) {
      if (isApiErrorCode(err, "QUOTE_CLOSED")) {
        setCancelling(false);
        closedMeanwhile();
        return;
      }
      throw new Error(errorMessage(err));
    }
    forgetLists();
    setCancelling(false);
    setNotice(null);
    toast.success(t.cancelledToast);
  }

  const menu: ContextMenuItem[] = [];
  if (q) {
    const customerId = q.customerId;
    if (shopperLink) menu.push({ id: "copy-link", label: t.copyShopperLink, icon: IconCopy, onSelect: () => copy(shopperLink, t.copiedShopperLink) });
    menu.push({ id: "copy-number", label: t.menuCopyNumber, icon: IconCopy, onSelect: () => copy(q.number, t.copiedNumber) });
    if (customerId) {
      menu.push({
        id: "customer",
        label: t.openCustomer,
        icon: IconCustomers,
        // Prices typed but not sent are asked about before the page is left.
        onSelect: () => void confirmLeave().then((leave) => leave && navigate(`/customers/${customerId}`)),
      });
    }
    if (open && canManage) {
      menu.push({ id: "cancel", label: t.cancelQuote, icon: IconCancelled, destructive: true, separatorBefore: true, onSelect: () => setCancelling(true) });
    }
  }

  const closedNote = q
    ? { accepted: t.acceptedNote, declined: t.declinedNote, cancelled: t.cancelledNote, expired: t.expiredNote, new: null, quoted: null }[q.status]
    : null;

  return (
    <LeaveGuard className="max-w-5xl">
      <div data-vt-target>
        <PageHeader
          back={{ to: "/quotes", label: t.back }}
          title={q ? isolate(q.number) : t.fallbackTitle}
          titleBadge={
            q ? (
              <span data-vt-part="status">
                <StatusBadge value={q.status} tone={QUOTE_STATUS_TONE[q.status]} text={t[QUOTE_STATUS_KEY[q.status]]} />
              </span>
            ) : undefined
          }
          description={q ? fmt(t.receivedOn, { date: formatDateTime(q.createdAt) }) : undefined}
          actions={q ? <MoreMenu items={menu} label={t.tools} /> : undefined}
          // An accepted quote leads to its order: in the header from md up, in the bar above the dock on a phone.
          primaryAction={
            q?.orderId ? (
              <Button asChild className="min-h-11 rounded-full px-5">
                <ViewLink to={`/orders/${q.orderId}`}>
                  <IconOrders className="size-4" weight="bold" aria-hidden />
                  {t.openOrder}
                </ViewLink>
              </Button>
            ) : undefined
          }
        />

        <DataState
          loading={quote.loading || (!q && !quote.error)}
          error={q ? null : quote.error}
          onRetry={() => void quote.refresh()}
          skeleton={<QuoteSkeleton />}
        >
          {q && (
            <div className="grid gap-[var(--bento-gap)] lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
              <div className="order-2 flex min-w-0 flex-col gap-[var(--bento-gap)] lg:order-1">
                {notice && <Alert>{notice}</Alert>}
                {closedNote && <Alert variant={q.status === "accepted" ? "success" : undefined}>{closedNote}</Alert>}
                {open && canManage ? (
                  <QuoteEditor
                    // A sent quote starts the form again from what was sent.
                    key={`${q.id}:${q.quotedAt ?? "new"}`}
                    quote={q}
                    currency={currency}
                    onClosed={closedMeanwhile}
                    onSaved={(saved, first) => {
                      quote.setData(saved);
                      forgetLists();
                      setNotice(null);
                      toast.success(first ? t.sentToast : t.updatedToast);
                    }}
                  />
                ) : (
                  <QuoteLines quote={q} currency={currency} viewOnly={open && !canManage} />
                )}
              </div>

              <div className="order-1 flex min-w-0 flex-col gap-[var(--bento-gap)] lg:order-2">
                <CustomerCard quote={q} />
                <QuoteFacts quote={q} shopperLink={shopperLink} />
              </div>
            </div>
          )}
        </DataState>
      </div>

      {q && (
        <ConfirmDialog
          open={cancelling}
          title={fmt(t.cancelTitle, { number: q.number })}
          description={t.cancelBody}
          confirmLabel={t.cancelConfirm}
          cancelLabel={t.keep}
          busyLabel={t.working}
          destructive
          onCancel={() => setCancelling(false)}
          onConfirm={confirmCancel}
        />
      )}
    </LeaveGuard>
  );
}

/** The page while the request loads: the same two columns, each as a card of lines. */
function QuoteSkeleton() {
  return (
    <div className="grid gap-[var(--bento-gap)] lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="order-2 lg:order-1">
        <CardSkeleton lines={6} />
      </div>
      <div className="order-1 lg:order-2">
        <CardSkeleton lines={3} />
      </div>
    </div>
  );
}

/** Who asked: name, company, a tap to call or message, the email, and what they wrote. */
function CustomerCard({ quote }: { quote: Quote }) {
  const t = useT(QUOTE_STRINGS);
  const { contact } = quote;
  const name = contact.fullName.trim();
  const rawPhone = contact.phone?.trim() || "";
  // A masked number is shown as it came, and never dialled.
  const phone = dialablePhone(rawPhone);
  return (
    <Section title={t.customerTitle}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
        <div className="min-w-0">
          <p className="truncate text-[17px] leading-6 font-semibold text-ink">
            <bdi data-vt-part="title">{name}</bdi>
          </p>
          {contact.company && (
            <p className="truncate text-sm leading-5 text-ink-soft">
              <bdi>{contact.company}</bdi>
            </p>
          )}
          <p className="text-sm leading-6 text-ink tabular-nums">
            <bdi dir="ltr">{rawPhone}</bdi>
          </p>
        </div>
        {phone && <ContactActions phone={phone} name={name || undefined} />}
      </div>

      <FactList
        className="mt-3 border-t border-line"
        rows={[
          {
            label: t.email,
            value: contact.email ? (
              <a
                href={`mailto:${contact.email}`}
                className="inline-flex min-h-11 items-center break-all text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary pointer-fine:min-h-0"
              >
                <bdi dir="ltr">{contact.email}</bdi>
              </a>
            ) : (
              <span className="font-normal text-ink-soft">{t.noEmail}</span>
            ),
          },
          quote.customerId
            ? {
                label: t.hasAccount,
                value: (
                  <ViewLink
                    to={`/customers/${quote.customerId}`}
                    className="inline-flex min-h-11 items-center text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary pointer-fine:min-h-0"
                  >
                    {t.openCustomer}
                  </ViewLink>
                ),
              }
            : null,
        ]}
      />

      {quote.message && (
        <Well caption={t.messageTitle} className="mt-3">
          {quote.message}
        </Well>
      )}
    </Section>
  );
}

/** The quote's own facts once it has prices: when it was sent, until when it holds, its order, and the shopper's link. */
function QuoteFacts({ quote, shopperLink }: { quote: Quote; shopperLink: string | null }) {
  const t = useT(QUOTE_STRINGS);
  if (!quote.quotedAt) return null;
  const sent = formatDate(quote.quotedAt);
  return (
    <AccordionSection
      title={t.detailsTitle}
      icon={IconQuotes}
      persistKey="quote:facts"
      summary={quote.validUntil ? fmt(t.factsSummary, { sent, until: formatDate(quote.validUntil) }) : fmt(t.factsSummaryNoDate, { sent })}
    >
      <FactList
        rows={[
          { label: t.quotedOn, value: formatDateTime(quote.quotedAt) },
          { label: t.validUntil, value: quote.validUntil ? formatDate(quote.validUntil) : t.notSet },
          quote.orderId
            ? {
                label: t.order,
                value: (
                  <ViewLink
                    to={`/orders/${quote.orderId}`}
                    className="inline-flex min-h-11 items-center text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary pointer-fine:min-h-0"
                  >
                    {t.openOrder}
                  </ViewLink>
                ),
              }
            : null,
        ]}
      />
      {shopperLink && (
        <div className="mt-3">
          <p className="text-xs font-medium text-ink-soft">{t.shopperLink}</p>
          <div data-slot="kinds-well" className="mt-1 flex min-w-0 items-center justify-between gap-2 rounded-2xl bg-paper-sunken py-1 ps-3.5 pe-1.5">
            <bdi dir="ltr" className="min-w-0 flex-1 truncate text-sm text-ink">
              {shopperLink}
            </bdi>
            <CopyButton value={shopperLink} label={t.copyLink} className="min-h-11 shrink-0" />
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-soft">{t.shopperLinkHint}</p>
        </div>
      )}
    </AccordionSection>
  );
}

/** One figure of a read-only line: a quiet label over its value. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs leading-4 text-ink-soft">{label}</dt>
      <dd className="text-sm leading-6 text-ink tabular-nums">
        <bdi dir="ltr">{value}</bdi>
      </dd>
    </div>
  );
}

/**
 * A quote that can't be edited here: what was asked for and what was offered,
 * read only. One card: a line per product with its figures beside it (under
 * it on a phone — no table to scroll sideways), then the total.
 */
function QuoteLines({ quote, currency, viewOnly }: { quote: Quote; currency: string; viewOnly: boolean }) {
  const t = useT(QUOTE_STRINGS);
  const priced = quote.totalAmount !== null;

  return (
    <>
      <Section title={t.linesTitle} description={`${t.linesHintClosed} ${countOf("item", quote.lines.length)}.`} flush>
        <ul className="divide-y divide-line border-t border-line">
          {quote.lines.map((line: QuoteLine) => {
            const detail = variantDetail(line.optionValues, line.sku);
            const leftOut = priced && line.unitPrice === null;
            return (
              <li key={line.variantId} data-slot="quote-line" data-off={leftOut ? "" : undefined} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] leading-6 font-medium text-ink">
                      <bdi>{line.productName ?? t.unknownProduct}</bdi>
                    </p>
                    {detail && (
                      <p className="text-xs leading-5 text-ink-soft">
                        <bdi>{detail}</bdi>
                      </p>
                    )}
                    {line.note && (
                      <p dir="auto" className="mt-0.5 text-xs leading-5 text-ink-soft">
                        {fmt(t.shopperNote, { note: line.note })}
                      </p>
                    )}
                  </div>
                  {priced && (
                    <p className="shrink-0 text-[15px] leading-6 font-semibold whitespace-nowrap text-ink tabular-nums">
                      {line.lineTotal === null ? <span className="text-xs font-normal text-ink-soft">{t.leftOut}</span> : <bdi dir="ltr">{formatMoney(line.lineTotal, currency)}</bdi>}
                    </p>
                  )}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <Figure label={t.colRequested} value={fmt("{n}", { n: line.requestedQuantity })} />
                  {priced && line.unitPrice !== null && <Figure label={t.colOffered} value={fmt("{n}", { n: line.quantity })} />}
                  {line.listPrice !== null && <Figure label={t.colListPrice} value={formatMoney(line.listPrice, currency)} />}
                  {priced && line.unitPrice !== null && <Figure label={t.colUnitPrice} value={formatMoney(line.unitPrice, currency)} />}
                </dl>
              </li>
            );
          })}
        </ul>
        {priced && (
          <div className="border-t border-line px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-ink">{t.total}</span>
              <span className="text-lg font-semibold text-ink tabular-nums">
                <bdi dir="ltr">{formatMoney(quote.totalAmount, currency)}</bdi>
              </span>
            </div>
            {isQuoteOpen(quote.status) && <p className="mt-0.5 text-xs leading-5 text-ink-soft">{t.totalHint}</p>}
          </div>
        )}
      </Section>
      {quote.quotedNote && (
        <Section title={t.note}>
          <p dir="auto" className="text-sm leading-6 whitespace-pre-wrap text-ink">
            {quote.quotedNote}
          </p>
        </Section>
      )}
      {viewOnly && <p className="px-1 text-xs leading-5 text-ink-soft">{t.viewOnly}</p>}
    </>
  );
}
