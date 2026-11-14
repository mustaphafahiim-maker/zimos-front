import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { returnCaseOf, type Order, type Product, type ReturnRequest } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { StatusBadge } from "@/components/StatusBadge";

const STRINGS = {
  en: {
    exchange: "Exchange",
    noteToCustomer: "Message to the customer: {note}",
    openReplacement: "Open replacement order",
  },
  ar: {
    exchange: "استبدال",
    noteToCustomer: "رسالة إلى العميل: {note}",
    openReplacement: "فتح طلب الاستبدال",
  },
} satisfies Messages;

// The products behind an exchange's lines, for the options of the variant asked for.
const productCache = new Map<string, Promise<Product | null>>();
function loadProduct(workspaceId: string, productId: string): Promise<Product | null> {
  const key = `${workspaceId}:${productId}`;
  let pending = productCache.get(key);
  if (!pending) {
    pending = apiClient.getProduct(workspaceId, productId).catch(() => null);
    productCache.set(key, pending);
  }
  return pending;
}

const optionsOf = (values: Record<string, string> | null | undefined) => (values ? Object.values(values).filter(Boolean).join(" / ") : "");

/** «M → L» for every line of an exchange: what the customer has → what they asked for instead. */
function useExchangeSwaps(ret: ReturnRequest, order: Order | null | undefined): Record<string, { from: string; to: string }> {
  const workspaceId = useWorkspaceId();
  const lines = returnCaseOf(ret).items.filter((line) => line.exchangeVariantId);
  const key = lines.map((l) => `${l.orderItemId}:${l.exchangeVariantId}`).join(",");
  const [swaps, setSwaps] = useState<Record<string, { from: string; to: string }>>({});

  useEffect(() => {
    if (!order || lines.length === 0) return;
    let alive = true;
    void Promise.all(
      lines.map(async (line) => {
        const item = order.items.find((i) => i.id === line.orderItemId);
        if (!item?.productId) return null;
        const product = await loadProduct(workspaceId, item.productId);
        const variant = product?.variants?.find((v) => v.id === line.exchangeVariantId);
        if (!variant) return null;
        return [line.orderItemId, { from: optionsOf(item.variantOptionsSnapshot), to: optionsOf(variant.optionValues) }] as const;
      })
    ).then((found) => {
      if (alive) setSwaps(Object.fromEntries(found.filter((entry) => entry !== null)));
    });
    return () => {
      alive = false;
    };
    // `key` stands for the lines; the order's items do not change under a return.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, key, order?.id]);

  return swaps;
}

/** «استبدال» among a return's chips when the customer wants another size or colour instead of a refund. */
export function ReturnExchangeBadge({ ret }: { ret: ReturnRequest }) {
  const t = useT(STRINGS);
  if (returnCaseOf(ret).resolution !== "exchange") return null;
  return <StatusBadge value="exchange" tone="info" text={t.exchange} />;
}

export interface ReturnHandlingProps {
  ret: ReturnRequest;
  /** The order behind the return, when it has arrived: names the exchange's sizes. */
  order?: Order | null;
  className?: string;
}

/**
 * What a return carries beyond approve / reject / restock: the exchange it
 * asks for («M → L»), the message the customer was sent and the replacement
 * order. Used on the returns queue and on the order page's Returns card.
 */
export function ReturnHandling({ ret, order, className }: ReturnHandlingProps) {
  const t = useT(STRINGS);
  const { dir } = useLocale();

  const data = returnCaseOf(ret);
  const exchange = data.resolution === "exchange";
  const swaps = useExchangeSwaps(ret, order);

  const exchangeLines = exchange ? data.items.filter((line) => swaps[line.orderItemId]) : [];
  const nothing = !exchange && !data.decisionNote && !data.exchangeOrderId;
  if (nothing) return null;

  return (
    <div data-slot="return-handling" className={className ?? "mt-2 space-y-2 text-sm"}>
      {exchangeLines.length > 0 && (
        <ul className="space-y-0.5 text-xs text-ink-soft">
          {exchangeLines.map((line) => {
            const item = order?.items.find((i) => i.id === line.orderItemId);
            const swap = swaps[line.orderItemId];
            return (
              <li key={line.orderItemId} className="flex flex-wrap items-center gap-x-1.5">
                {item && <bdi className="text-ink">{item.productNameSnapshot}</bdi>}
                {/* Each side keeps its own direction; the arrow follows the reading direction. */}
                <span className="inline-flex items-center gap-1 font-semibold text-ink">
                  <bdi>{swap.from || "—"}</bdi>
                  <span aria-hidden>{dir === "rtl" ? "←" : "→"}</span>
                  <bdi>{swap.to || "—"}</bdi>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {data.decisionNote && (
        <p dir="auto" className="rounded-xl bg-paper-sunken px-3 py-2 text-xs leading-5 text-ink">
          {fmt(t.noteToCustomer, { note: data.decisionNote })}
        </p>
      )}

      {data.exchangeOrderId && (
        <Link to={`/orders/${data.exchangeOrderId}`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline pointer-fine:min-h-8">
          {t.openReplacement}
        </Link>
      )}
    </div>
  );
}
