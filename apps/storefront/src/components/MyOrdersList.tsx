"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ShopperOrder } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { listOrderRefs, lookupOrder, type OrderRef } from "@/lib/orders";
import { useStore } from "@/lib/StoreContext";
import { btnPrimary, btnSecondary, card } from "./ui";

type Row = { ref: OrderRef; order: ShopperOrder | null };

/**
 * Orders placed from this browser, with their LIVE status from the server.
 * The device only remembers which orders it placed; everything shown is real.
 */
export function MyOrdersList({ workspaceId }: { workspaceId: string }) {
  const { t, money, intlLocale } = useStore();
  const base = `/store/${workspaceId}`;
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const refs = listOrderRefs(workspaceId);
    if (refs.length === 0) {
      // Device-local list read after mount on purpose so SSR and hydration agree.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows([]);
      return;
    }
    let cancelled = false;
    const client = createStorefrontApiClient();
    Promise.all(refs.map((ref) => lookupOrder(client, workspaceId, { orderId: ref.id, phone: ref.phone }).catch(() => null))).then((orders) => {
      if (!cancelled) setRows(refs.map((ref, i) => ({ ref, order: orders[i] })));
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (rows === null) {
    return (
      <p role="status" className="mt-8 text-sm text-ink-soft">
        {t.myOrders.loading}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={`${card} mt-8 p-6 text-center`} role="status">
        <p className="font-semibold text-ink">{t.myOrders.empty}</p>
        <p className="mt-1 text-sm text-ink-soft">{t.myOrders.emptyHint}</p>
        <Link href={base} className={`${btnPrimary} mt-5`}>
          {t.common.continueShopping}
        </Link>
      </div>
    );
  }

  const date = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <ul className="mt-8 space-y-4">
      {rows.map(({ ref, order }) => {
        const createdAt = order?.createdAt ?? ref.createdAt;
        const created = new Date(createdAt);
        const count = order?.items.reduce((n, item) => n + item.quantity, 0) ?? 0;
        return (
          <li key={ref.id} className={`${card} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                  <span dir="ltr">#{ref.orderNumber}</span>
                  {order && <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">{t.myOrders.stage[order.stage]}</span>}
                </h2>
                {createdAt && (
                  <p className="mt-1 text-sm text-ink-soft">
                    {t.myOrders.placedOn}: <time dateTime={createdAt}>{Number.isNaN(created.getTime()) ? createdAt : date.format(created)}</time>
                  </p>
                )}
                {count > 0 && <p className="mt-0.5 text-sm text-ink-soft">{t.myOrders.items(count)}</p>}
                {!order && <p className="mt-1 text-xs text-ink-muted">{t.myOrders.unavailable}</p>}
              </div>
              {order && (
                <p className="text-sm text-ink-soft">
                  {t.myOrders.total}: <span className="text-base font-bold text-ink">{money(order.totalAmount, order.currency)}</span>
                </p>
              )}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link
                href={`${base}/orders/${encodeURIComponent(ref.id)}?number=${encodeURIComponent(ref.orderNumber)}`}
                aria-label={t.myOrders.viewOrder(ref.orderNumber)}
                className={btnSecondary}
              >
                {t.thankYou.summary}
              </Link>
              <Link href={`${base}/track`} aria-label={t.myOrders.trackOrder(ref.orderNumber)} className={btnSecondary}>
                {t.myOrders.track}
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
