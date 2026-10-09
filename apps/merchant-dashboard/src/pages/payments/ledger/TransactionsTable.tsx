import type { PaymentLedgerRow } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { providerName } from "@/lib/providers";
import { LEDGER_STATUS_TONE, LEDGER_STRINGS, PAYOUT_PATH, PAYOUT_STATUS_TONE, type LedgerStrings } from "./ledgerStrings";

const LINK =
  "inline-flex min-h-11 items-center rounded-sm text-primary tabular-nums hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-fine:min-h-0";

function word(t: LedgerStrings, prefix: string, value: string): string {
  const key = `${prefix}_${value}` as keyof LedgerStrings;
  return key in t ? t[key] : value;
}

/** An amount of the ledger: signed, left-to-right, red with its minus when it is money going back. */
export function LedgerMoney({ minor, currency, signed = false, strong = false }: { minor: number; currency: string; signed?: boolean; strong?: boolean }) {
  return (
    <bdi dir="ltr" className={cn("tabular-nums", strong && "font-medium", signed && minor < 0 ? "text-danger" : undefined)}>
      {formatMoney(minor, currency)}
    </bdi>
  );
}

/**
 * The rows of the online payments ledger (handoff 384): the Transactions tab
 * and both tables of a payout's page. A table from md up, cards on a phone
 * (DataTable). `withPayout` drops the payout column where the page is the payout.
 */
export function TransactionsTable({ rows, withPayout = true }: { rows: readonly PaymentLedgerRow[]; withPayout?: boolean }) {
  const t = useT(LEDGER_STRINGS);

  const columns: Column<PaymentLedgerRow>[] = [
    {
      key: "order",
      header: t.colOrder,
      cell: (row) =>
        row.orderId && row.orderNumber ? (
          <ViewLink to={`/orders/${row.orderId}`} aria-label={fmt(t.openOrder, { number: row.orderNumber })} className={LINK}>
            <bdi dir="ltr">{row.orderNumber}</bdi>
          </ViewLink>
        ) : (
          <span className="text-ink-soft">{t.noOrder}</span>
        ),
    },
    { key: "date", header: t.colDate, cell: (row) => <span className="whitespace-nowrap text-ink-soft">{formatDateTime(row.occurredAt)}</span> },
    { key: "type", header: t.colType, cell: (row) => word(t, "type", row.type) },
    {
      key: "status",
      header: t.colStatus,
      cell: (row) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <StatusBadge value={row.status} tone={LEDGER_STATUS_TONE[row.status] ?? "neutral"} text={word(t, "status", row.status)} />
          {row.mode === "test" && <StatusBadge value="test" tone="warning" text={t.test} />}
        </span>
      ),
    },
    {
      key: "gateway",
      header: t.colGateway,
      cell: (row) => (
        <span className="block min-w-0">
          <span className="block text-ink">{providerName(row.gateway)}</span>
          {row.maskedDisplay && (
            <bdi dir="ltr" className="block text-xs text-ink-soft">
              {row.maskedDisplay}
            </bdi>
          )}
        </span>
      ),
    },
    { key: "amount", header: t.colAmount, align: "end", cell: (row) => <LedgerMoney minor={row.amount} currency={row.currency} signed strong /> },
    {
      key: "fee",
      header: t.colFee,
      align: "end",
      // A fee the gateway hasn't reported is not zero: a dash that says why.
      cell: (row) =>
        row.fee === null ? (
          row.status === "captured" ? (
            <span title={t.feeUnknown} className="cursor-help text-ink-soft">
              <span aria-hidden>—</span>
              <span className="sr-only">{t.feeUnknown}</span>
            </span>
          ) : (
            "—"
          )
        ) : (
          <LedgerMoney minor={row.fee} currency={row.feeCurrency ?? row.currency} />
        ),
    },
    {
      key: "net",
      header: t.colNet,
      align: "end",
      cell: (row) => (row.net === null ? "—" : <LedgerMoney minor={row.net} currency={row.feeCurrency ?? row.currency} signed />),
    },
  ];

  if (withPayout) {
    columns.push({
      key: "payout",
      header: t.colPayout,
      cell: (row) =>
        row.payout ? (
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <ViewLink to={PAYOUT_PATH(row.payout.id)} aria-label={t.openPayout} className={LINK}>
              {row.payout.arrivalDate ? formatDate(row.payout.arrivalDate) : t.openPayout}
            </ViewLink>
            <StatusBadge value={row.payout.status} tone={PAYOUT_STATUS_TONE[row.payout.status] ?? "neutral"} text={word(t, "payout", row.payout.status)} />
          </span>
        ) : (
          "—"
        ),
    });
  }

  return <DataTable columns={columns} rows={rows} rowKey={(row) => `${row.type}:${row.id}`} minWidth="62rem" />;
}
