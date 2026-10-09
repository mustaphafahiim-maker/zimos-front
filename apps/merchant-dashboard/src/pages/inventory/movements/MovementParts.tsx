import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import type { StockMovement, StockMovementSource } from "@store-builder/api-client";
import type { Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, getIntlLocale } from "@/i18n/LocaleContext";
import { formatOptions } from "@/lib/format";
import type { MovementStrings } from "./movementStrings";

const LINK = "rounded-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** A signed whole number in the reader's digits, always left to right: "+2", "−3". */
export function signed(n: number): string {
  const digits = new Intl.NumberFormat(getIntlLocale()).format(Math.abs(n));
  return `${n < 0 ? "−" : "+"}${digits}`;
}

/**
 * `localTime` is the store's wall clock ("2026-10-08 04:21:36"): read as it
 * stands (no shift to the browser's zone) and written in the reader's language.
 */
export function movementTime(movement: StockMovement): string {
  const wall = new Date(`${movement.localTime.replace(" ", "T")}Z`);
  if (Number.isNaN(wall.getTime())) return movement.localTime;
  return wall.toLocaleString(getIntlLocale(), { timeZone: "UTC", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const TYPE_TONE = {
  restock: "success",
  return_restock: "success",
  adjustment: "info",
  reserve: "warning",
  release: "neutral",
  commit: "neutral",
} as const;

function sourceText(t: MovementStrings, source: StockMovementSource): string {
  const words = t as unknown as Record<string, string>;
  switch (source.type) {
    case "order": {
      const event = source.event ? (words[`ev_${source.event}`] ?? source.event) : null;
      return event ? fmt(t.src_order, { orderNumber: source.orderNumber ?? "", event }) : fmt(t.src_orderPlain, { orderNumber: source.orderNumber ?? "" });
    }
    case "purchase_order":
      return fmt(t.src_purchase_order, { number: source.number ?? "" });
    case "return":
      return fmt(t.src_return, { orderNumber: source.orderNumber ?? "" });
    case "stock_lot":
      return fmt(t.src_stock_lot, { lotCode: source.lotCode ?? "" });
    default:
      return words[`src_${source.type}`] ?? source.type;
  }
}

/** Where a movement came from, as a link when the dashboard has a page for it. */
export function MovementSource({ t, source }: { t: MovementStrings; source: StockMovementSource | null }) {
  if (!source) return <>—</>;
  const text = sourceText(t, source);
  const to =
    source.type === "order" && source.id
      ? `/orders/${source.id}`
      : source.type === "return" && source.orderId
        ? `/orders/${source.orderId}`
        : source.type === "purchase_order" && source.id
          ? `/inventory/purchase-orders/${source.id}`
          : source.type === "stock_count" && source.id
            ? `/inventory/stock-counts/${source.id}`
            : null;
  return to ? (
    <ViewLink to={to} className={LINK} onClick={(e) => e.stopPropagation()}>
      <bdi>{text}</bdi>
    </ViewLink>
  ) : (
    <bdi>{text}</bdi>
  );
}

function actorText(t: MovementStrings, movement: StockMovement): string {
  const actor = movement.actor;
  if (!actor) return "—";
  if (actor.type === "customer") return t.byCustomer;
  if (actor.type === "system") return t.bySystem;
  return actor.name ?? t.byDeleted;
}

/** The change: units on hand in green or red; a reservation or its release as «محجوز +2». */
function Change({ t, movement }: { t: MovementStrings; movement: StockMovement }) {
  const parts: ReactNode[] = [];
  if (movement.quantityDelta !== 0) {
    parts.push(
      <bdi key="qty" dir="ltr" className={cn("font-semibold tabular-nums", movement.quantityDelta > 0 ? "text-success" : "text-danger")}>
        {signed(movement.quantityDelta)}
      </bdi>
    );
  }
  if (movement.reservedDelta !== 0 && (movement.type === "reserve" || movement.type === "release" || movement.quantityDelta === 0)) {
    const [before, after] = t.reservedDelta.split("{n}");
    parts.push(
      <span key="reserved" className="whitespace-nowrap text-ink-soft">
        {before}
        <bdi dir="ltr" className="tabular-nums">
          {signed(movement.reservedDelta)}
        </bdi>
        {after}
      </span>
    );
  }
  if (parts.length === 0) return <>—</>;
  return <span className="inline-flex flex-wrap items-baseline gap-x-2">{parts}</span>;
}

/** The table's columns; the product page's drawer leaves the product out (it is one variant's history). */
export function movementColumns(t: MovementStrings, opts: { product: boolean; location: boolean }): Column<StockMovement>[] {
  const typeLabel = (movement: StockMovement) => (t as unknown as Record<string, string>)[`type_${movement.type}`] ?? movement.type;
  const columns: Column<StockMovement>[] = [
    { key: "date", header: t.colDate, cell: (m) => <span className="whitespace-nowrap">{movementTime(m)}</span> },
    { key: "type", header: t.colType, cell: (m) => <StatusBadge value={m.type} tone={TYPE_TONE[m.type] ?? "neutral"} text={typeLabel(m)} /> },
  ];
  if (opts.product) {
    columns.push({
      key: "product",
      header: t.colProduct,
      cell: (m) => {
        const detail = [formatOptions(m.variant.optionValues), m.variant.sku].filter(Boolean).join(" · ");
        return (
          <div className="min-w-0">
            <ViewLink to={`/catalog/${m.variant.productId}`} className={LINK} onClick={(e) => e.stopPropagation()}>
              <bdi>{m.variant.productName}</bdi>
            </ViewLink>
            {detail && (
              <p className="text-xs text-ink-soft">
                <bdi>{detail}</bdi>
              </p>
            )}
          </div>
        );
      },
    });
  }
  columns.push({ key: "change", header: t.colChange, cell: (m) => <Change t={t} movement={m} /> });
  if (opts.location) columns.push({ key: "location", header: t.colLocation, cell: (m) => (m.location ? <bdi>{m.location.name}</bdi> : "—"), phoneSkip: (m) => !m.location });
  columns.push(
    { key: "source", header: t.colSource, cell: (m) => <MovementSource t={t} source={m.source} /> },
    { key: "reason", header: t.colReason, cell: (m) => (m.reason ? <bdi>{m.reason}</bdi> : "—"), phoneSkip: (m) => !m.reason },
    { key: "by", header: t.colBy, cell: (m) => <bdi>{actorText(t, m)}</bdi> }
  );
  return columns;
}
