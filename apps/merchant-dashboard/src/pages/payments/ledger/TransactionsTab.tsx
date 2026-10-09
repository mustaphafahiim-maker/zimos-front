import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Alert, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input } from "@store-builder/ui";
import {
  isInvalidCursorError,
  paymentLedgerExport,
  paymentLedgerList,
  type PaymentLedgerFilters,
  type PaymentLedgerRow,
  type PaymentLedgerStatus,
  type PaymentLedgerTotals,
  type PaymentLedgerType,
} from "@store-builder/api-client";
import { IconCaretDown, IconDocument, IconExport, IconReceipt, IconSearch, IconSheet, IconSpinner } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { useErrorMessage } from "@/lib/errorMessages";
import { providerName } from "@/lib/providers";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { DataState, TableSkeleton } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { LoadMore } from "@/components/LoadMore";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { useOrderLabels } from "@/pages/orders/orderLabels";
import { LEDGER_GATEWAYS, LEDGER_METHODS, LEDGER_STRINGS } from "./ledgerStrings";
import { LedgerMoney, TransactionsTable } from "./TransactionsTable";

const STATUSES: readonly PaymentLedgerStatus[] = ["captured", "refunded", "failed", "pending"];
const TYPES: readonly PaymentLedgerType[] = ["payment", "refund"];

interface Filters {
  gateway: string;
  method: string;
  status: "" | PaymentLedgerStatus;
  type: "" | PaymentLedgerType;
  from: string;
  to: string;
  test: boolean;
}

const NO_FILTERS: Filters = { gateway: "", method: "", status: "", type: "", from: "", to: "", test: false };

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * «المعاملات» (handoff 384, financial_reports.view): every gateway payment
 * and refund under the filters, newest first, with the totals of everything
 * the filters select — captured, refunded, the gateway's fees and the net —
 * and the same selection as a CSV or Excel file.
 */
export function TransactionsTab() {
  const t = useT(LEDGER_STRINGS);
  const workspaceId = useWorkspaceId();
  const { locale, dir } = useLocale();
  const labels = useOrderLabels();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [exporting, setExporting] = useState(false);
  // The totals come with the first page only: kept while more pages load.
  const [totals, setTotals] = useState<PaymentLedgerTotals | null>(null);
  const run = useRef(0);
  const ids = { gateway: useId(), method: useId(), status: useId(), type: useId(), from: useId(), to: useId() };

  const badRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const query = useMemo<PaymentLedgerFilters>(
    () => ({
      gateway: filters.gateway || undefined,
      method: filters.method || undefined,
      status: filters.status || undefined,
      type: filters.type || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      mode: filters.test ? "test" : "live",
    }),
    [filters]
  );

  const list = useCursorList<PaymentLedgerRow>(
    async (cursor) => {
      if (badRange) return { items: [], nextCursor: null };
      const turn = cursor ? run.current : ++run.current;
      const page = await paymentLedgerList(apiClient, workspaceId, { ...query, cursor, limit: 50 });
      if (!cursor && turn === run.current) setTotals(page.totals ?? null);
      return { items: page.transactions, nextCursor: page.nextCursor };
    },
    [workspaceId, query, badRange],
    { isStaleCursor: (err) => isInvalidCursorError(err) }
  );

  const filtered = JSON.stringify({ ...filters, test: false }) !== JSON.stringify(NO_FILTERS);
  const patch = (change: Partial<Filters>) => setFilters((current) => ({ ...current, ...change }));

  async function exportAs(format: "csv" | "xlsx") {
    if (exporting || badRange) return;
    setExporting(true);
    try {
      const file = await paymentLedgerExport(apiClient, workspaceId, query, format, locale);
      saveBlob(file.blob, file.filename);
      toast.success(t.exported);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const field = "h-11 w-full text-base md:h-10 md:text-sm";
  const label = "mb-1 block text-xs font-medium text-ink-soft";

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div role="group" aria-label={t.filters} className="grid grid-cols-2 items-end gap-3 md:grid-cols-4 xl:grid-cols-7">
        <div className="min-w-0">
          <label htmlFor={ids.gateway} className={label}>
            {t.gateway}
          </label>
          <Select id={ids.gateway} value={filters.gateway} onChange={(e) => patch({ gateway: e.target.value })} className={field}>
            <option value="">{t.any}</option>
            {LEDGER_GATEWAYS.map((code) => (
              <option key={code} value={code}>
                {providerName(code)}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0">
          <label htmlFor={ids.method} className={label}>
            {t.method}
          </label>
          <Select id={ids.method} value={filters.method} onChange={(e) => patch({ method: e.target.value })} className={field}>
            <option value="">{t.any}</option>
            {LEDGER_METHODS.map((method) => (
              <option key={method} value={method}>
                {labels.paymentMethod(method)}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0">
          <label htmlFor={ids.status} className={label}>
            {t.status}
          </label>
          <Select id={ids.status} value={filters.status} onChange={(e) => patch({ status: e.target.value as Filters["status"] })} className={field}>
            <option value="">{t.any}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t[`status_${status}`]}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0">
          <label htmlFor={ids.type} className={label}>
            {t.type}
          </label>
          <Select id={ids.type} value={filters.type} onChange={(e) => patch({ type: e.target.value as Filters["type"] })} className={field}>
            <option value="">{t.any}</option>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t[`type_${type}`]}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0">
          <label htmlFor={ids.from} className={label}>
            {t.from}
          </label>
          <Input id={ids.from} type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => patch({ from: e.target.value })} className={field} />
        </div>
        <div className="min-w-0">
          <label htmlFor={ids.to} className={label}>
            {t.to}
          </label>
          <Input id={ids.to} type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => patch({ to: e.target.value })} className={field} />
        </div>
        <label title={t.testHint} className="col-span-2 flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink md:col-span-1 md:min-h-10">
          <input type="checkbox" className="size-4 accent-[var(--color-primary)]" checked={filters.test} onChange={(e) => patch({ test: e.target.checked })} />
          {t.test}
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {filtered ? (
          <Button type="button" variant="ghost" className="min-h-11 rounded-full px-4 md:min-h-9" onClick={() => setFilters({ ...NO_FILTERS, test: filters.test })}>
            {t.clear}
          </Button>
        ) : (
          <span />
        )}
        <DirectionProvider direction={dir}>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" variant="outline" className="min-h-11 gap-2 rounded-full px-4 md:min-h-9" disabled={exporting || badRange} />}
            >
              {exporting ? (
                <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <IconExport className="size-4" aria-hidden />
              )}
              {exporting ? t.exporting : t.exportMenu}
              <IconCaretDown className="size-4 text-ink-soft" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-auto min-w-48 rounded-[1.125rem] p-1.5">
              <DropdownMenuItem className="min-h-10 cursor-pointer gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11" onClick={() => void exportAs("csv")}>
                <IconDocument className="size-[18px] text-ink-soft" aria-hidden />
                {t.exportCsv}
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-10 cursor-pointer gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11" onClick={() => void exportAs("xlsx")}>
                <IconSheet className="size-[18px] text-ink-soft" aria-hidden />
                {t.exportXlsx}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </DirectionProvider>
      </div>

      {badRange ? (
        <Alert variant="danger">{t.fromAfterTo}</Alert>
      ) : (
        <DataState
          loading={list.loading}
          error={list.items.length === 0 ? list.error : null}
          onRetry={list.reload}
          skeleton={<TableSkeleton />}
        >
          {totals && list.items.length > 0 && <LedgerTotals totals={totals} />}
          {list.items.length === 0 ? (
            filtered ? (
              <EmptyState icon={<IconSearch aria-hidden />} title={t.noMatchTitle} description={t.noMatchHint} />
            ) : (
              <EmptyState icon={<IconReceipt aria-hidden />} title={t.emptyTitle} description={t.emptyHint} />
            )
          ) : (
            <>
              {list.error != null && <Alert variant="danger" className="mb-3">{errorMessage(list.error)}</Alert>}
              <TransactionsTable rows={list.items} />
              <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
            </>
          )}
        </DataState>
      )}
    </div>
  );
}

/** «المحصّل · المسترد · رسوم البوابة · الصافي», one row of figures per currency. */
function LedgerTotals({ totals }: { totals: PaymentLedgerTotals }) {
  const t = useT(LEDGER_STRINGS);
  if (totals.byCurrency.length === 0) return null;
  return (
    <div data-slot="ledger-totals" className="mb-4 flex flex-col gap-3">
      {totals.byCurrency.map((row) => {
        // Fees are in the gateway's settlement currency: usually the row's own, else the only one there is.
        const fees = totals.feesByCurrency.find((f) => f.currency === row.currency) ?? (totals.byCurrency.length === 1 ? totals.feesByCurrency[0] : undefined);
        return (
          <div key={row.currency}>
            <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Figure label={t.captured}>
                <LedgerMoney minor={row.captured} currency={row.currency} />
              </Figure>
              <Figure label={t.refunded}>
                <LedgerMoney minor={row.refunded} currency={row.currency} />
              </Figure>
              <Figure label={t.fees}>{fees ? <LedgerMoney minor={fees.fees} currency={fees.currency} /> : "—"}</Figure>
              <Figure label={t.net} strong>
                {fees ? <LedgerMoney minor={fees.net} currency={fees.currency} signed /> : "—"}
              </Figure>
            </dl>
            {row.feesPending > 0 && <p className="mt-1.5 px-1 text-xs leading-5 text-ink-soft">{fmt(t.feesPending, { n: row.feesPending })}</p>}
          </div>
        );
      })}
    </div>
  );
}

function Figure({ label, strong = false, children }: { label: string; strong?: boolean; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-paper-sunken px-3 py-2.5">
      <dt className="truncate text-xs leading-5 text-ink-soft">{label}</dt>
      <dd className={strong ? "text-[15px] leading-6 font-semibold text-ink" : "text-[15px] leading-6 font-medium text-ink"}>{children}</dd>
    </div>
  );
}
