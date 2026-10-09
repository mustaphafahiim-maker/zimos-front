import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import {
  QUOTE_LIST_STATUSES,
  isApiErrorCode,
  quoteCancel,
  quotesList,
  type QuoteList,
  type QuoteListStatus,
  type QuoteSummary,
} from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconExternal, IconQuotes, IconSearch } from "@/components/icons";
import { ChipRow, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { canManageOrders } from "@/lib/inventoryAccess";
import { storeUrl } from "@/lib/storeAddress";
import { useAsync } from "@/lib/useAsync";
import { invalidateCached, useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { DeskList } from "@/pages/returns/rowkit/DeskList";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { fold, matches } from "./kit/Facts";
import { QuoteQuickLook } from "./QuoteQuickLook";
import { QUOTE_COLUMNS, QuoteRow } from "./QuoteRow";
import { QUOTE_STRINGS } from "./quoteStrings";

type Filter = "all" | QuoteListStatus;

const TAB_KEY = {
  all: "tabAll",
  new: "tabNew",
  quoted: "tabQuoted",
  accepted: "tabAccepted",
  declined: "tabDeclined",
  cancelled: "tabCancelled",
} as const satisfies Record<Filter, string>;

/** New first: the page is an inbox before it is an archive. */
const FILTERS: readonly Filter[] = ["new", "quoted", "accepted", "declined", "cancelled", "all"];
const DEFAULT_FILTER: Filter = "new";

function isFilter(value: string | null): value is Filter {
  return value === "all" || (QUOTE_LIST_STATUSES as readonly string[]).includes(value ?? "");
}

/**
 * Orders → Quotes (handoff 219, read orders.view): the requests of shoppers
 * who buy in quantity. It opens on the new ones — the ones waiting for the
 * store's prices — with their count on the chip; search narrows what is
 * listed as it is typed. A row opens Quick Look, Enter or the quote number
 * the request itself, where the prices are set and sent. A quote past its
 * date is filed under "Sent" with its own chip (the API has no filter for it).
 *
 * `?status=` holds the chosen chip (absent = new), so a link or a refresh
 * lands on the same list. Each list is kept for the session: coming back shows
 * it at once and reads it again behind.
 */
export function QuotesPage() {
  const t = useT(QUOTE_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageOrders(currentWorkspace?.role);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const compact = useIsCompact();
  const phone = useIsPhone();

  const [params, setParams] = useSearchParams();
  const raw = params.get("status");
  const filter: Filter = isFilter(raw) ? raw : DEFAULT_FILTER;
  function selectFilter(next: Filter) {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === DEFAULT_FILTER) out.delete("status");
        else out.set("status", next);
        return out;
      },
      { replace: true }
    );
  }

  const cachePrefix = `quotes:${workspaceId}:`;
  const list = useCachedAsync<QuoteList>(
    `${cachePrefix}${filter}`,
    () => quotesList(apiClient, workspaceId, filter === "all" ? undefined : filter),
    [workspaceId, filter]
  );
  // The count of new requests whatever chip is shown (a list's own count only covers its rows).
  const fresh = useAsync(
    () => (filter === "new" ? Promise.resolve(null) : quotesList(apiClient, workspaceId, "new").catch(() => null)),
    [workspaceId, filter === "new"]
  );

  const [search, setSearch] = useState("");
  // The request being looked at, and the one being cancelled. Each stays here while its sheet closes.
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);
  const [cancelling, setCancelling] = useState<{ quote: QuoteSummary; open: boolean } | null>(null);

  const quotes = useMemo(() => (list.loading ? [] : (list.data?.quotes ?? [])), [list.loading, list.data]);
  const query = fold(search.trim());
  const visible = useMemo(
    () =>
      query
        ? quotes.filter((q) => matches(query, [q.number, q.contact.fullName, q.contact.company, q.contact.phone, q.contact.email]))
        : quotes,
    [quotes, query]
  );

  const newKnown = filter === "new" ? !list.loading && list.data !== null : fresh.data !== null;
  const newCount = filter === "new" ? (list.data?.newCount ?? 0) : (fresh.data?.newCount ?? 0);
  const chips: ChipItem<Filter>[] = FILTERS.map((value) =>
    value === "new"
      ? { value, label: t.tabNew, count: newKnown ? newCount : null, tone: "attention" as const }
      : { value, label: t[TAB_KEY[value]] }
  );

  const peeked = peek ? (quotes.find((q) => q.id === peek.id) ?? null) : null;

  function askCancel(quote: QuoteSummary) {
    // Quick Look steps aside for the question: two sheets are never stacked.
    setPeek((current) => (current ? { ...current, open: false } : current));
    setCancelling({ quote, open: true });
  }

  async function confirmCancel() {
    const quote = cancelling?.quote;
    if (!quote) return;
    const close = () => setCancelling((current) => (current ? { ...current, open: false } : current));
    try {
      await quoteCancel(apiClient, workspaceId, quote.id);
    } catch (err) {
      if (!isApiErrorCode(err, "QUOTE_CLOSED")) throw new Error(errorMessage(err));
      // The shopper answered (or a teammate cancelled) meanwhile: say so and show the list as it is now.
      close();
      toast.error(t.closedNotice);
      reload();
      return;
    }
    close();
    toast.success(t.cancelledToast);
    reload();
  }

  /** After a change: this list is read again, and what is kept of the other lists and of the requests is dropped. */
  function reload() {
    invalidateCached(cachePrefix);
    invalidateCached(`quote:${workspaceId}:`);
    void list.refresh({ silent: true });
    if (filter !== "new") void fresh.refresh({ silent: true });
  }

  const storeLink = currentWorkspace?.slug ? storeUrl(currentWorkspace.slug) : null;
  const pill = "min-h-11 rounded-full px-5";

  const empty = query ? (
    <EmptyState
      icon={<IconSearch aria-hidden />}
      title={t.emptyFilteredTitle}
      action={
        <Button variant="outline" className={pill} onClick={() => setSearch("")}>
          {t.clearSearch}
        </Button>
      }
    />
  ) : filter === "new" ? (
    // The inbox, when clear, says so and points at everything already answered.
    <EmptyState
      icon={<IconQuotes aria-hidden />}
      tone="success"
      title={t.emptyNewTitle}
      description={t.emptyNewDone}
      action={
        <Button variant="outline" className={pill} onClick={() => selectFilter("all")}>
          {t.showAll}
        </Button>
      }
    />
  ) : filter === "all" ? (
    <EmptyState
      icon={<IconQuotes aria-hidden />}
      title={t.emptyAllTitle}
      description={t.emptyNewHint}
      action={
        storeLink ? (
          <Button asChild className={pill}>
            <a href={storeLink} target="_blank" rel="noreferrer noopener">
              {t.openStore}
              <IconExternal className="size-4" weight="bold" aria-hidden />
            </a>
          </Button>
        ) : undefined
      }
    />
  ) : (
    <EmptyState
      icon={<IconQuotes aria-hidden />}
      title={t.emptyOtherTitle}
      action={
        <Button variant="outline" className={pill} onClick={() => selectFilter("all")}>
          {t.showAll}
        </Button>
      }
    />
  );

  const rows = visible.map((quote) => (
    <QuoteRow
      key={quote.id}
      quote={quote}
      compact={compact}
      current={peek?.open === true && peek.id === quote.id}
      onPeek={() => setPeek({ id: quote.id, open: true })}
      onCancel={canManage ? () => askCancel(quote) : undefined}
    />
  ));

  // Nothing to show and a failure (or no permission): the whole list gives way to the reason.
  const blocking = list.error != null && (quotes.length === 0 || isPermissionError(list.error));

  return (
    <div className="max-w-5xl">
      {/* A phone keeps the first screen for the inbox: the sentence is for wider screens. */}
      <PageHeader title={t.title} description={phone ? undefined : t.description} />

      <div className="flex flex-col gap-3">
        <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }} />
        <ChipRow
          items={chips}
          value={filter}
          onChange={selectFilter}
          label={t.chipsLabel}
          collapseEmpty={false}
          countsLoading={filter === "new" ? list.loading : fresh.loading}
        />

        <DataState
          loading={list.loading}
          error={blocking ? list.error : null}
          onRetry={() => void list.refresh()}
          skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}
        >
          {list.error != null && !blocking && (
            <Alert variant="danger" className="flex flex-wrap items-center justify-between gap-3">
              <span>{t.refreshFailed}</span>
              <Button size="sm" variant="outline" className="min-h-11 rounded-full px-4" onClick={() => void list.refresh({ silent: true })}>
                {t.retry}
              </Button>
            </Alert>
          )}
          {visible.length === 0 ? (
            empty
          ) : compact ? (
            <ul aria-label={t.title} className="flex flex-col gap-2.5">
              {rows}
            </ul>
          ) : (
            <DeskList
              columns={QUOTE_COLUMNS}
              label={t.title}
              head={[
                { label: t.colCustomer },
                { label: t.colStatus },
                { label: t.colProducts },
                { label: t.colValidUntil },
                { label: t.colReceived },
                { label: t.colContact, end: true },
              ]}
            >
              {rows}
            </DeskList>
          )}
        </DataState>
      </div>

      <QuoteQuickLook
        quote={peeked}
        open={Boolean(peek?.open) && peeked !== null}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        canManage={canManage}
        onCancel={() => {
          if (peeked) askCancel(peeked);
        }}
      />

      <ConfirmDialog
        open={Boolean(cancelling?.open)}
        title={cancelling ? fmt(t.cancelTitle, { number: cancelling.quote.number }) : ""}
        description={t.cancelBody}
        confirmLabel={t.cancelConfirm}
        cancelLabel={t.keep}
        busyLabel={t.working}
        destructive
        onCancel={() => setCancelling((current) => (current ? { ...current, open: false } : current))}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
