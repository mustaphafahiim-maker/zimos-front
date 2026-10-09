import { useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { isInvalidCursorError, paymentPayoutsList, paymentPayoutsSync, type PaymentPayout } from "@store-builder/api-client";
import { IconBank, IconRefresh } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { providerName } from "@/lib/providers";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DataState, TableSkeleton } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { LoadMore } from "@/components/LoadMore";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { useToast } from "@/components/Toast";
import { useViewNavigate } from "@/lib/viewTransition";
import { LEDGER_STRINGS, PAYOUT_PATH, PAYOUT_STATUS_TONE } from "./ledgerStrings";
import { LedgerMoney } from "./TransactionsTable";

/**
 * «التحويلات البنكية» (handoff 384): what each gateway sent to the bank,
 * newest arrival first. «تحديث» asks the gateways now (the server does it once
 * a day by itself); a gateway that refused, or was asked a moment ago, says so.
 */
export function PayoutsTab() {
  const t = useT(LEDGER_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [syncing, setSyncing] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const list = useCursorList<PaymentPayout>(
    async (cursor) => {
      const page = await paymentPayoutsList(apiClient, workspaceId, { cursor, limit: 50 });
      return { items: page.payouts, nextCursor: page.nextCursor };
    },
    [workspaceId],
    { isStaleCursor: (err) => isInvalidCursorError(err) }
  );

  async function refresh() {
    if (syncing) return;
    setSyncing(true);
    setProblems([]);
    try {
      const results = await paymentPayoutsSync(apiClient, workspaceId);
      const failed = results.filter((r) => r.error).map((r) => fmt(t.gatewayProblem, { gateway: providerName(r.gateway), message: r.message ?? r.error ?? "" }));
      setProblems(failed);
      const ran = results.some((r) => !r.error && !r.skipped);
      if (ran) toast.success(t.refreshed);
      else if (results.some((r) => r.skipped === "recently_synced")) toast.success(t.refreshedRecently);
      list.reload();
    } catch (err) {
      setProblems([errorMessage(err)]);
    } finally {
      setSyncing(false);
    }
  }

  const columns: Column<PaymentPayout>[] = [
    {
      key: "arrival",
      header: t.colArrival,
      cell: (row) => (
        <ViewLink
          to={PAYOUT_PATH(row.id)}
          className="inline-flex min-h-11 items-center rounded-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-fine:min-h-0"
        >
          {row.arrivalDate ? formatDate(row.arrivalDate) : formatDate(row.createdAt)}
        </ViewLink>
      ),
    },
    { key: "gateway", header: t.colGateway, cell: (row) => providerName(row.gateway) },
    { key: "amount", header: t.colAmount, align: "end", cell: (row) => <LedgerMoney minor={row.amount} currency={row.currency} signed strong /> },
    { key: "fees", header: t.colFees, align: "end", cell: (row) => (row.fee === null ? "—" : <LedgerMoney minor={row.fee} currency={row.currency} />) },
    {
      key: "status",
      header: t.colStatus,
      cell: (row) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <StatusBadge value={row.status} tone={PAYOUT_STATUS_TONE[row.status] ?? "neutral"} text={t[`payout_${row.status}`] ?? row.status} />
          {row.mode === "test" && <StatusBadge value="test" tone="warning" text={t.test} />}
        </span>
      ),
    },
    { key: "payments", header: t.colPayments, align: "end", cell: (row) => <span className="tabular-nums">{row.payments}</span> },
    { key: "refunds", header: t.colRefunds, align: "end", cell: (row) => <span className="tabular-nums">{row.refunds}</span> },
  ];

  const refreshButton = (
    <Button type="button" variant="outline" className="min-h-11 gap-2 rounded-full px-4 md:min-h-9" disabled={syncing} onClick={() => void refresh()}>
      <IconRefresh className={syncing ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} aria-hidden />
      {syncing ? t.refreshing : t.refresh}
    </Button>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-[13px] leading-5 text-ink-soft">{t.payoutsHint}</p>
        {refreshButton}
      </div>
      {problems.map((problem) => (
        <Alert key={problem} variant="danger">
          {problem}
        </Alert>
      ))}
      <DataState loading={list.loading} error={list.items.length === 0 ? list.error : null} onRetry={list.reload} skeleton={<TableSkeleton />}>
        {list.items.length === 0 ? (
          <EmptyState icon={<IconBank aria-hidden />} title={t.payoutsEmptyTitle} description={t.payoutsEmptyHint} />
        ) : (
          <>
            {list.error != null && <Alert variant="danger" className="mb-3">{errorMessage(list.error)}</Alert>}
            <DataTable columns={columns} rows={list.items} rowKey={(row) => row.id} onRowClick={(row) => navigate(PAYOUT_PATH(row.id))} />
            <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
          </>
        )}
      </DataState>
    </div>
  );
}
