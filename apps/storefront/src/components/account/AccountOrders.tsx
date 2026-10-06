"use client";

import { useEffect, useState } from "react";
import { shopperOrders, type ShopperOrderRow } from "@store-builder/api-client";
import { ChevronIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary, btnSecondary, card, skeleton } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { isShopperSignedOutError } from "@/lib/shopperSession";
import { Notice, useAccount } from "./AccountShell";
import { ReceiptIcon } from "./accountIcons";

/** The stage word of the tracking page's four stages (0 placed … 3 delivered). */
export function stageLabel(t: Dictionary["account"], stage: number): string {
  return [t.stagePlaced, t.stageConfirmed, t.stageShipped, t.stageDelivered][stage] ?? t.stagePlaced;
}

/** A pill that reads without its colour: the word is always there. */
export function StageBadge({ stage }: { stage: number }) {
  const { t } = useStore();
  const done = stage >= 3;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        done ? "bg-success-soft text-success" : "bg-primary-soft text-primary"
      }`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${done ? "bg-success" : "bg-primary"}`} />
      {stageLabel(t.account, stage)}
    </span>
  );
}

/**
 * «طلباتي»: the shopper's orders in this store, newest first, 20 at a time
 * (GET /account/orders, `nextBefore`). Each row opens the order page.
 */
export function AccountOrders() {
  const { t, money, intlLocale } = useStore();
  const a = t.account;
  const { api } = useAccount();
  const [orders, setOrders] = useState<ShopperOrderRow[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .call((client, storeId, token) => shopperOrders(client, storeId, token))
      .then((page) => {
        if (cancelled) return;
        setOrders(page.orders);
        setNext(page.nextBefore);
      })
      .catch((err) => {
        if (!cancelled && !isShopperSignedOutError(err)) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [api, nonce]);

  async function loadMore() {
    if (!next) return;
    setMore("loading");
    try {
      const page = await api.call((client, storeId, token) => shopperOrders(client, storeId, token, next));
      setOrders((prev) => [...(prev ?? []), ...page.orders.filter((o) => !(prev ?? []).some((p) => p.id === o.id))]);
      setNext(page.nextBefore);
      setMore("idle");
    } catch {
      setMore("error");
    }
  }

  if (error) {
    return (
      <Notice
        tone="danger"
        title={a.loadFailed}
        action={
          <button
            type="button"
            onClick={() => {
              setError(false);
              setOrders(null);
              setNonce((n) => n + 1);
            }}
            className={btnPrimary}
          >
            {a.retry}
          </button>
        }
      />
    );
  }

  if (!orders) {
    return (
      <div className="space-y-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${skeleton} h-24 w-full`} />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className={`${card} flex flex-col items-center px-5 py-10 text-center`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <ReceiptIcon size={24} />
        </span>
        <p className="mt-4 text-base font-semibold text-ink">{a.ordersEmpty}</p>
        <p className="mt-1 max-w-sm text-sm text-ink-soft">{a.ordersEmptyHint}</p>
        <StoreLink href="/products" className={`${btnPrimary} mt-5`}>
          {t.common.continueShopping}
        </StoreLink>
      </div>
    );
  }

  const date = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" });
  return (
    <div>
      <ul className="space-y-3">
        {orders.map((order) => (
          <li key={order.id}>
            <StoreLink
              href={`/account/orders/${order.id}`}
              className={`${card} flex items-center gap-3 p-4 transition-colors hover:border-primary sm:p-5`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="text-sm font-semibold text-ink">
                    {a.order}{" "}
                    <bdi dir="ltr" className="tabular-nums">
                      #{order.orderNumber}
                    </bdi>
                  </span>
                  <StageBadge stage={order.stage} />
                </div>
                {order.firstItemName && (
                  <p className="mt-1.5 truncate text-sm text-ink">
                    {order.firstItemName}
                    <span className="text-ink-soft"> · {t.common.piece(order.itemsCount)}</span>
                  </p>
                )}
                <p className="mt-1 text-xs text-ink-soft">
                  {date.format(new Date(order.createdAt))} ·{" "}
                  <span className="font-semibold text-ink">{money(order.totalAmount, order.currency)}</span>
                </p>
              </div>
              <ChevronIcon size={18} className="shrink-0 -rotate-90 text-ink-soft rtl:rotate-90" />
            </StoreLink>
          </li>
        ))}
      </ul>
      {next && (
        <div className="mt-5 text-center" aria-live="polite">
          {more === "error" && <p className="mb-3 text-sm text-danger">{a.loadFailed}</p>}
          <button type="button" onClick={() => void loadMore()} disabled={more === "loading"} className={`${btnSecondary} w-full sm:w-auto`}>
            {more === "loading" ? a.loadingMore : a.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}
