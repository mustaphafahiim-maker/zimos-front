import { useCallback, useMemo, useState, type ReactNode } from "react";
import { stockAlertsSummary, type StockAlertVariant, type Variant } from "@store-builder/api-client";
import { DataTable, type Column } from "@/components/DataTable";
import { IconBell, IconRefresh } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { InsightChip } from "../list/InsightChip";

const STRINGS = {
  en: {
    title: "Waiting for restock",
    chip_one: "1 product shoppers are waiting for",
    chip_other: "{n} products shoppers are waiting for",
    answer: "{waiting} for “{name}” to come back. Add stock and each one gets one message — nothing else to do.",
    waiting_one: "1 waiting",
    waiting_other: "{n} waiting",
    listHint:
      "Shoppers leave a mobile number or email on a sold-out variant. When it's back — a stock edit, an import or a return — each one gets one message, once.",
    colProduct: "Product",
    colWaiting: "Waiting",
    colNotified: "Already told",
    colLast: "Last sign-up",
    loadFailed: "Couldn't load who's waiting for a restock — try again",
  },
  ar: {
    title: "بانتظار عودة المخزون",
    chip_one: "منتج واحد ينتظر العملاء عودته",
    chip_two: "منتجان ينتظر العملاء عودتهما",
    chip_few: "{n} منتجات ينتظر العملاء عودتها",
    chip_other: "{n} منتجًا ينتظر العملاء عودته",
    answer: "{waiting} عودة «{name}». زِد المخزون وسنرسل إلى كل منهم رسالة واحدة دون أي إجراء منك.",
    waiting_one: "عميل واحد ينتظر",
    waiting_two: "عميلان ينتظران",
    waiting_few: "{n} عملاء ينتظرون",
    waiting_other: "{n} عميلًا ينتظرون",
    listHint:
      "يترك العملاء رقم هاتف أو بريدًا إلكترونيًا على النوع الذي نفد. فور عودته — بتعديل المخزون أو باستيراد أو بمرتجع — تصل إلى كل منهم رسالة واحدة فقط.",
    colProduct: "المنتج",
    colWaiting: "المنتظرون",
    colNotified: "تم إبلاغهم",
    colLast: "آخر تسجيل",
    loadFailed: "تعذّر تحميل قائمة المنتظرين لعودة المنتجات — حاول مرة أخرى",
  },
} satisfies Messages;

/** "قميص كتان (M)": the product, then the variant's option values. */
function variantName(row: StockAlertVariant): string {
  const values = Object.values(row.optionValues ?? {}).filter(Boolean);
  return values.length ? `${row.productName} (${values.join(" / ")})` : row.productName;
}

/**
 * Products → «مستنيين يرجع»: the sold-out variants
 * shoppers asked to hear about, most waited first. Restocking sends the
 * messages by itself, so this only says where demand is waiting.
 *
 * On the list it is one chip of the slim row over the products
 * (list/InsightChip.tsx) — «٣ منتجات الناس مستنياها ترجع»; pressing it opens
 * the whole answer in a sheet: the headline sentence and the table Product
 * (+SKU) / Waiting / Already told / Last sign-up. Nothing shows while nobody
 * waits or for a role that cannot read it; an error is a chip that tries
 * again. The answer is kept for the session, so the chip is there at once on
 * return and the list under it does not move.
 */
export function WaitingRestockCard() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [open, setOpen] = useState(false);
  const alerts = useCachedAsync(`catalog:restock:${workspaceId}`, () => stockAlertsSummary(apiClient, workspaceId), [workspaceId]);

  const waiting = (n: number) => pluralOf(t, "waiting", n);
  const rows = alerts.data?.variants ?? [];
  const waitingRows = rows.filter((r) => r.waiting > 0);

  if (alerts.loading || isPermissionError(alerts.error)) return null;
  if (alerts.error && rows.length === 0) {
    return (
      <InsightChip icon={IconRefresh} tone="danger" opens={false} onClick={() => void alerts.refresh()}>
        {t.loadFailed}
      </InsightChip>
    );
  }
  const first = waitingRows[0];
  if (!first) return null;

  // The chip counts products, not variants: two sizes of one shirt are one thing to restock.
  const products = new Set(waitingRows.map((r) => r.productId)).size;

  const columns: Column<StockAlertVariant>[] = [
    {
      key: "product",
      header: t.colProduct,
      cell: (r) => (
        <span className="flex min-w-0 flex-col">
          <ViewLink to={`/catalog/${r.productId}`} className="font-medium text-ink hover:text-primary-dark hover:underline">
            {variantName(r)}
          </ViewLink>
          {r.sku && (
            <bdi dir="ltr" className="text-xs text-ink-soft">
              {r.sku}
            </bdi>
          )}
        </span>
      ),
    },
    {
      key: "waiting",
      header: t.colWaiting,
      cell: (r) => (r.waiting > 0 ? <StatusBadge value="waiting" tone="warning" text={waiting(r.waiting)} /> : <span className="text-ink-soft">—</span>),
    },
    { key: "notified", header: t.colNotified, align: "end", cell: (r) => <span className="tabular-nums">{fmt("{n}", { n: r.notified })}</span> },
    { key: "last", header: t.colLast, cell: (r) => formatDate(r.lastRequestAt) },
  ];

  return (
    <>
      <InsightChip icon={IconBell} tone="attention" onClick={() => setOpen(true)}>
        {pluralOf(t, "chip", products)}
      </InsightChip>
      <Sheet open={open} onOpenChange={setOpen} title={t.title} description={t.listHint} size="lg">
        <p className="mb-4 text-sm leading-6 font-medium text-ink">{fmt(t.answer, { name: variantName(first), waiting: waiting(first.waiting) })}</p>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.variantId} />
      </Sheet>
    </>
  );
}

/**
 * «{n} مستني» beside a sold-out variant in the product's variants table (one
 * request for the table). Nothing for a variant in stock or nobody waits on:
 * restocking sends the messages and the badge goes by itself.
 */
export function useRestockBadge(): (variant: Variant) => ReactNode {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const alerts = useAsync(() => stockAlertsSummary(apiClient, workspaceId), [workspaceId]);
  const counts = useMemo(() => new Map((alerts.data?.variants ?? []).map((r) => [r.variantId, r.waiting])), [alerts.data]);

  return useCallback(
    (v: Variant) => {
      const n = counts.get(v.id) ?? 0;
      const soldOut = !v.allowOverselling && v.stockOnHand - v.reservedStock <= 0;
      if (n <= 0 || !soldOut) return null;
      return <StatusBadge value="waiting" tone="warning" text={pluralOf(t, "waiting", n)} className="ms-2 align-middle" />;
    },
    [counts, t]
  );
}
