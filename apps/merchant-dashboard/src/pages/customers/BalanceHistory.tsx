import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataTable, type Column } from "@/components/DataTable";

const STRINGS = {
  en: {
    colWhat: "What",
    colChange: "Change",
    colAfter: "Balance after",
    colWhen: "When",
    orderLink: "Order",
    afterShort: "Left: {amount}",
    showAll: "Show all {n} changes",
    showLess: "Show fewer",
  },
  ar: {
    colWhat: "إيه اللي حصل",
    colChange: "التغيير",
    colAfter: "الرصيد بعدها",
    colWhen: "إمتى",
    orderLink: "الأوردر",
    afterShort: "الباقي: {amount}",
    showAll: "اعرض كل الحركة ({n})",
    showLess: "اعرض أقل",
  },
} satisfies Messages;

/** One line of a customer's points or store-credit ledger, already worded by the caller. */
export interface BalanceHistoryRow {
  id: string;
  /** What happened, in the merchant's words («اتصرف في أوردر»). */
  what: string;
  orderId: string | null;
  /** A reason staff typed; the system's own remarks are left out by the caller. */
  note?: string | null;
  /** Signed, to colour a gain apart from a spend. */
  change: number;
  /** The change as text, without its sign («250 نقطة», «50 ج.م»). */
  changeText: string;
  /** The balance after it, as text. */
  afterText: string;
  createdAt: string;
}

/** How many changes show before «اعرض كل الحركة»: the customer page has more below this card. */
const FIRST_ROWS = 5;

/**
 * A customer's balance changes, newest first (loyalty points 203, store
 * credit 204): one line per change on a phone, a table from md up, the first
 * few with a button for the rest.
 */
export function BalanceHistory({ rows, empty }: { rows: BalanceHistoryRow[]; empty: string }) {
  const t = useT(STRINGS);
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, FIRST_ROWS);

  const signed = (row: BalanceHistoryRow): ReactNode => (
    <bdi className={row.change > 0 ? "font-medium whitespace-nowrap text-success tabular-nums" : "font-medium whitespace-nowrap text-ink tabular-nums"}>
      {row.change > 0 ? "+" : row.change < 0 ? "−" : ""}
      {row.changeText}
    </bdi>
  );
  const what = (row: BalanceHistoryRow): ReactNode => (
    <span className="flex min-w-0 flex-col">
      <span className="text-ink">
        {row.what}
        {row.orderId && (
          <>
            {" · "}
            <Link to={`/orders/${row.orderId}`} onClick={(e) => e.stopPropagation()} className="font-medium text-primary hover:underline">
              {t.orderLink}
            </Link>
          </>
        )}
      </span>
      {row.note && (
        <span className="text-xs font-normal text-ink-soft">
          <bdi>{row.note}</bdi>
        </span>
      )}
    </span>
  );

  const columns: Column<BalanceHistoryRow>[] = [
    { key: "what", header: t.colWhat, cell: what },
    { key: "change", header: t.colChange, align: "end", cell: signed },
    {
      key: "after",
      header: t.colAfter,
      align: "end",
      cell: (row) => <span className="whitespace-nowrap text-ink-soft tabular-nums">{row.afterText}</span>,
    },
    { key: "when", header: t.colWhen, cell: (row) => <span className="whitespace-nowrap text-xs text-ink-soft">{formatDateTime(row.createdAt)}</span> },
  ];

  if (rows.length === 0) return <p className="px-4 pb-4 text-sm text-ink-soft">{empty}</p>;

  return (
    <>
      {/* Phones: one line per change. */}
      <ul className="divide-y divide-line border-t border-line md:hidden">
        {shown.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              {what(row)}
              <p className="mt-0.5 text-xs text-ink-soft">{formatDateTime(row.createdAt)}</p>
            </div>
            <div className="shrink-0 text-end">
              {signed(row)}
              <p className="mt-0.5 text-xs text-ink-soft tabular-nums">{fmt(t.afterShort, { amount: row.afterText })}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <DataTable columns={columns} rows={shown} rowKey={(row) => row.id} minWidth="34rem" phoneCards={false} />
      </div>
      {rows.length > FIRST_ROWS && (
        <div className="border-t border-line px-2 py-1">
          <Button type="button" variant="ghost" size="sm" className="min-h-11" aria-expanded={all} onClick={() => setAll((v) => !v)}>
            {all ? t.showLess : fmt(t.showAll, { n: rows.length })}
          </Button>
        </div>
      )}
    </>
  );
}
