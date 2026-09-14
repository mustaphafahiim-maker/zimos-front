"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { listOrderSnapshots, type OrderSnapshot } from "@/lib/mockCommerce";
import { useStore } from "@/lib/StoreContext";
import { btnPrimary, btnSecondary, card } from "./ui";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * This device's saved orders. The server snapshot is null ("loading"), so SSR
 * and hydration agree; the list appears once the client reads localStorage and
 * stays in sync if another tab places an order.
 */
export function MyOrdersList({ workspaceId }: { workspaceId: string }) {
  const { t, money, intlLocale } = useStore();
  const base = `/store/${workspaceId}`;

  // getSnapshot must return a stable reference while storage is unchanged.
  const cache = useRef<{ key: string; value: OrderSnapshot[] } | null>(null);
  const getSnapshot = useCallback(() => {
    let raw = "";
    try {
      raw = window.localStorage.getItem(`zimos_orders_${workspaceId}`) ?? "";
    } catch {
      /* storage blocked */
    }
    const key = `${workspaceId}:${raw}`;
    if (cache.current?.key !== key) cache.current = { key, value: listOrderSnapshots(workspaceId) };
    return cache.current.value;
  }, [workspaceId]);
  const orders = useSyncExternalStore<OrderSnapshot[] | null>(subscribe, getSnapshot, () => null);

  if (orders === null) {
    return (
      <p role="status" className="mt-8 text-sm text-ink-soft">
        {t.myOrders.loading}
      </p>
    );
  }

  if (orders.length === 0) {
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
      {orders.map((order) => {
        const count = order.items.reduce((n, item) => n + item.quantity, 0);
        const created = new Date(order.createdAt);
        return (
          <li key={order.id} className={`${card} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-ink">
                  <span dir="ltr">#{order.orderNumber}</span>
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {t.myOrders.placedOn}:{" "}
                  <time dateTime={order.createdAt}>
                    {Number.isNaN(created.getTime()) ? order.createdAt : date.format(created)}
                  </time>
                </p>
                {count > 0 && <p className="mt-0.5 text-sm text-ink-soft">{t.myOrders.items(count)}</p>}
              </div>
              <p className="text-sm text-ink-soft">
                {t.myOrders.total}:{" "}
                <span className="text-base font-bold text-ink">{money(order.totalAmount, order.currency)}</span>
              </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link
                href={`${base}/orders/${encodeURIComponent(order.id)}?number=${encodeURIComponent(order.orderNumber)}`}
                aria-label={t.myOrders.viewOrder(order.orderNumber)}
                className={btnSecondary}
              >
                {t.thankYou.summary}
              </Link>
              <Link href={`${base}/track`} aria-label={t.myOrders.trackOrder(order.orderNumber)} className={btnSecondary}>
                {t.myOrders.track}
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
