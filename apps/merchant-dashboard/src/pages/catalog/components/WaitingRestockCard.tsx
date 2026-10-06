import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@store-builder/ui";
import { stockAlertsSummary, type StockAlertVariant, type Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Section } from "@/components/Section";
import { Modal } from "@/components/Modal";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";

const STRINGS = {
  en: {
    title: "Waiting for restock",
    answer: "{waiting} for “{name}” to come back. Add stock and each one gets one message — nothing else to do.",
    waiting_one: "1 waiting",
    waiting_other: "{n} waiting",
    seeAll: "See all",
    listHint:
      "Shoppers leave a mobile number or email on a sold-out variant. When it's back — a stock edit, an import or a return — each one gets one message, once.",
    colProduct: "Product",
    colWaiting: "Waiting",
    colNotified: "Already told",
    colLast: "Last sign-up",
    loadFailed: "We couldn't load who's waiting for a restock.",
    retry: "Try again",
  },
  ar: {
    title: "مستنيين يرجع",
    answer: "{waiting} «{name}» يرجع. زوّد المخزون وهنبعت لكل واحد رسالة واحدة من غير ما تعمل حاجة.",
    waiting_one: "واحد مستني",
    waiting_two: "اتنين مستنيين",
    waiting_few: "{n} مستنيين",
    waiting_other: "{n} مستني",
    seeAll: "اعرض الكل",
    listHint:
      "العملاء بيسيبوا رقم موبايل أو إيميل على النوع اللي خلص. أول ما يرجع — بتعديل المخزون أو استيراد أو مرتجع — كل واحد بيوصله رسالة واحدة بس.",
    colProduct: "المنتج",
    colWaiting: "مستنيين",
    colNotified: "اتبلغوا",
    colLast: "آخر تسجيل",
    loadFailed: "معرفناش نجيب العملاء اللي مستنيين المنتجات ترجع.",
    retry: "جرّب تاني",
  },
} satisfies Messages;

const SHOWN = 3;

/** "قميص كتان (M)": the product, then the variant's option values. */
function variantName(row: StockAlertVariant): string {
  const values = Object.values(row.optionValues ?? {}).filter(Boolean);
  return values.length ? `${row.productName} (${values.join(" / ")})` : row.productName;
}

/**
 * Products → «مستنيين يرجع» (frontend-handoff 194): the sold-out variants
 * shoppers asked to hear about, most waited first. Restocking sends the
 * messages by itself, so the card only says where demand is waiting. Nothing
 * shows while nobody waits; an error says so with a retry.
 */
export function WaitingRestockCard() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [open, setOpen] = useState(false);
  const alerts = useAsync(() => stockAlertsSummary(apiClient, workspaceId), [workspaceId]);

  const waiting = (n: number) => pluralOf(t, "waiting", n);
  const rows = alerts.data?.variants ?? [];
  const waitingRows = rows.filter((r) => r.waiting > 0);

  if (alerts.loading || isPermissionError(alerts.error)) return null;
  if (alerts.error) {
    return (
      <Section title={t.title}>
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-danger">
          <span>{t.loadFailed}</span>
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => void alerts.refresh()}>
            {t.retry}
          </Button>
        </div>
      </Section>
    );
  }
  if (waitingRows.length === 0) return null;

  const first = waitingRows[0];
  const columns: Column<StockAlertVariant>[] = [
    {
      key: "product",
      header: t.colProduct,
      cell: (r) => (
        <span className="flex min-w-0 flex-col">
          <Link to={`/catalog/${r.productId}`} className="font-medium text-ink hover:text-primary-dark hover:underline">
            {variantName(r)}
          </Link>
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
    <Section
      title={t.title}
      description={fmt(t.answer, { name: variantName(first), waiting: waiting(first.waiting) })}
      actions={
        rows.length > SHOWN ? (
          <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setOpen(true)}>
            {t.seeAll}
          </Button>
        ) : undefined
      }
    >
      <ul className="divide-y divide-line">
        {waitingRows.slice(0, SHOWN).map((r) => (
          <li key={r.variantId} className="flex min-h-11 items-center gap-3 py-1.5">
            <Bell className="size-4 shrink-0 text-accent-dark" strokeWidth={1.75} aria-hidden />
            <Link
              to={`/catalog/${r.productId}`}
              className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-primary-dark hover:underline"
            >
              {variantName(r)}
            </Link>
            <StatusBadge value="waiting" tone="warning" text={waiting(r.waiting)} className="shrink-0" />
          </li>
        ))}
      </ul>

      <Modal open={open} onClose={() => setOpen(false)} title={t.title} description={t.listHint}>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.variantId} />
      </Modal>
    </Section>
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
