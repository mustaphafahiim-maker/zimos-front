import { useState } from "react";
import { Alert, buttonVariants, cn } from "@store-builder/ui";
import { isInvalidCursorError, paymentDisputesList, type PaymentDispute, type PaymentDisputeStatus } from "@store-builder/api-client";
import { IconExternal, IconShield } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney } from "@/lib/format";
import { providerName } from "@/lib/providers";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DataState, TableSkeleton } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { DISPUTE_STRINGS, DISPUTE_TONE, disputeReasonText, disputeRespondUrl, disputeStatusText, isOpenDispute } from "./disputeText";

type Filter = "open" | "all" | Extract<PaymentDisputeStatus, "won" | "lost" | "closed">;

/**
 * «النزاعات» (handoff 377, orders.view): the card disputes shoppers opened
 * with their bank or PayPal, newest first — open ones by default, with the
 * deadline to respond. Each row leads to its order; the dispute itself is
 * answered in the gateway's dashboard, one tap away.
 */
export function DisputesTab() {
  const t = useT(DISPUTE_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [filter, setFilter] = useState<Filter>("open");

  const list = useCursorList<PaymentDispute>(
    async (cursor) => {
      const page = await paymentDisputesList(apiClient, workspaceId, { status: filter === "all" ? undefined : filter, cursor, limit: 50 });
      return { items: page.disputes, nextCursor: page.nextCursor };
    },
    [workspaceId, filter],
    { isStaleCursor: (err) => isInvalidCursorError(err) }
  );

  const columns: Column<PaymentDispute>[] = [
    {
      key: "order",
      header: t.colOrder,
      cell: (row) => (
        <ViewLink
          to={`/orders/${row.orderId}`}
          aria-label={fmt(t.openOrder, { number: row.orderNumber ?? "" })}
          className="inline-flex min-h-11 items-center rounded-sm font-medium text-primary tabular-nums hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-fine:min-h-0"
        >
          <bdi dir="ltr">{row.orderNumber ?? "—"}</bdi>
        </ViewLink>
      ),
    },
    { key: "status", header: t.colStatus, cell: (row) => <StatusBadge value={row.status} tone={DISPUTE_TONE[row.status] ?? "neutral"} text={disputeStatusText(t, row.status)} /> },
    {
      key: "amount",
      header: t.colAmount,
      align: "end",
      cell: (row) => (
        <bdi dir="ltr" className="font-medium tabular-nums">
          {formatMoney(row.amount, row.currency)}
        </bdi>
      ),
    },
    { key: "reason", header: t.colReason, cell: (row) => <span className="text-ink-soft">{disputeReasonText(t, row.reason)}</span> },
    { key: "gateway", header: t.colGateway, cell: (row) => providerName(row.providerCode) },
    { key: "due", header: t.colDue, cell: (row) => (isOpenDispute(row.status) && row.evidenceDueBy ? formatDate(row.evidenceDueBy) : "—") },
    { key: "opened", header: t.colOpened, phoneHidden: true, cell: (row) => <span className="text-ink-soft">{formatDate(row.openedAt ?? row.createdAt)}</span> },
    {
      key: "respond",
      header: "",
      align: "end",
      cell: (row) => {
        // The list does not say which mode the payment was made in: the order page's button knows (test keys have their own page).
        const url = isOpenDispute(row.status) ? disputeRespondUrl(row, false) : null;
        return url ? (
          <a href={url} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }), "min-h-11 gap-1.5 rounded-full px-3 md:min-h-9")}>
            {fmt(t.respond, { gateway: providerName(row.providerCode) })}
            <IconExternal className="size-4 rtl:-scale-x-100" aria-hidden />
          </a>
        ) : null;
      },
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-[13px] leading-5 text-ink-soft">{t.hint}</p>
      <FilterTabs<Filter>
        label={t.filterLabel}
        value={filter}
        onChange={setFilter}
        buttonClassName="min-h-11 md:min-h-0"
        className="self-start"
        tabs={[
          { value: "open", label: t.filterOpen },
          { value: "won", label: t.status_won },
          { value: "lost", label: t.status_lost },
          { value: "closed", label: t.status_closed },
          { value: "all", label: t.filterAll },
        ]}
      />
      <DataState loading={list.loading} error={list.items.length === 0 ? list.error : null} onRetry={list.reload} skeleton={<TableSkeleton />}>
        {list.items.length === 0 ? (
          filter === "open" ? (
            <EmptyState tone="success" icon={<IconShield aria-hidden />} title={t.emptyOpenTitle} description={t.emptyOpenHint} />
          ) : (
            <EmptyState icon={<IconShield aria-hidden />} title={t.emptyTitle} description={t.emptyHint} />
          )
        ) : (
          <>
            {list.error != null && <Alert variant="danger" className="mb-3">{errorMessage(list.error)}</Alert>}
            <DataTable columns={columns} rows={list.items} rowKey={(row) => row.id} minWidth="60rem" />
            <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
          </>
        )}
      </DataState>
    </div>
  );
}
