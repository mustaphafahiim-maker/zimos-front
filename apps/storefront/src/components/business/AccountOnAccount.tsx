"use client";

import { parseMoney, shopperOnAccount, shopperOnAccountStatement, type OnAccountOrder, type ShopperOnAccount } from "@store-builder/api-client";
import { Notice, useAccount } from "@/components/account/AccountShell";
import { ReceiptIcon } from "@/components/account/accountIcons";
import { useShopperRead } from "@/components/account/AccountWalletTabs";
import { ChevronIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary, card, skeleton } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";
import { useBusinessCopy } from "./businessCopy";

/**
 * The account's «حسابي الآجل» page (handoff 229): what the shopper owes the
 * store on their account, what is left of their limit, their terms, and their
 * on-account orders with due dates — a late one in the danger colour with the
 * word «متأخر». Read only: the store records the payments as they arrive.
 * The tab that leads here is in AccountOnAccountTab.tsx.
 */
export function AccountOnAccount() {
  const { t, money, intlLocale } = useStore();
  const copy = useBusinessCopy();
  const { api } = useAccount();
  const [state, reload] = useShopperRead<ShopperOnAccount>(api, shopperOnAccount);

  if (state.status === "error") {
    return (
      <Notice
        tone="danger"
        title={t.account.loadFailed}
        action={
          <button type="button" onClick={reload} className={btnPrimary}>
            {t.account.retry}
          </button>
        }
      />
    );
  }
  if (state.status === "loading") {
    return (
      <div className="space-y-3" aria-hidden>
        <div className={`${skeleton} h-36 w-full`} />
        <div className={`${skeleton} h-20 w-full`} />
        <div className={`${skeleton} h-20 w-full`} />
      </div>
    );
  }

  const statement = shopperOnAccountStatement(state.data);
  // Opened by its address by a shopper the store has not approved: there is no balance to show.
  if (!statement) {
    return (
      <Notice
        title={copy.refusedNotOpen}
        action={
          <StoreLink href="/products" className={btnPrimary}>
            {copy.shop}
          </StoreLink>
        }
      />
    );
  }

  // The limit and the sums are in the store's currency; each order carries its own.
  const owed = parseMoney(statement.owed);
  const overdue = parseMoney(statement.overdue);
  const date = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" });

  return (
    <div>
      <section className={`${card} p-5 sm:p-6`} aria-labelledby="account-on-account-title">
        <h2 id="account-on-account-title" className="text-sm font-medium text-ink-soft">
          {copy.owed}
        </h2>
        <p className="mt-1 font-display text-3xl font-bold text-ink tabular-nums">{money(owed)}</p>
        {overdue > 0 && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-danger" />
            {copy.overdueTotal(money(overdue))}
          </p>
        )}
        {statement.enabled && (
          <dl className="mt-4 border-t border-line pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">{copy.available}</dt>
              <dd className="font-semibold text-ink tabular-nums">{statement.available === null ? copy.noLimit : money(statement.available)}</dd>
            </div>
          </dl>
        )}
        <p className={`text-sm text-ink-soft ${statement.enabled ? "mt-2" : "mt-4 border-t border-line pt-4"}`}>
          {statement.enabled ? copy.terms(statement.paymentTermsDays ?? 0) : copy.payLaterOff} {copy.paymentsNote}
        </p>
      </section>

      {statement.orders.length === 0 ? (
        <div className={`${card} mt-6 flex flex-col items-center px-5 py-10 text-center`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <ReceiptIcon size={24} />
          </span>
          <p className="mt-4 text-base font-semibold text-ink">{copy.ordersEmpty}</p>
          <p className="mt-1 max-w-sm text-sm text-ink-soft">{copy.ordersEmptyHint}</p>
          <StoreLink href="/products" className={`${btnPrimary} mt-5`}>
            {copy.shop}
          </StoreLink>
        </div>
      ) : (
        <section className="mt-6" aria-labelledby="account-on-account-orders">
          <h2 id="account-on-account-orders" className="text-base font-semibold text-ink">
            {copy.ordersTitle}
          </h2>
          <ul className="mt-3 space-y-3">
            {statement.orders.map((order) => (
              <OrderRow key={order.id} order={order} dueDate={order.paymentDueAt ? date.format(new Date(order.paymentDueAt)) : null} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function OrderRow({ order, dueDate }: { order: OnAccountOrder; dueDate: string | null }) {
  const { money } = useStore();
  const copy = useBusinessCopy();
  const left = parseMoney(order.due);
  return (
    <li>
      <StoreLink href={`/account/orders/${order.id}`} className={`${card} flex items-center gap-3 p-4 transition-colors hover:border-primary sm:p-5`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-sm font-semibold text-ink">
              {copy.order}{" "}
              <bdi dir="ltr" className="tabular-nums">
                {order.orderNumber}
              </bdi>
            </span>
            {/* A pill that reads without its colour: the word is always there. */}
            {left <= 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
                {copy.paid}
              </span>
            ) : (
              order.overdue && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-danger" />
                  {copy.overdue}
                </span>
              )
            )}
          </div>
          {dueDate && left > 0 && <p className={`mt-1.5 text-sm ${order.overdue ? "font-medium text-danger" : "text-ink"}`}>{copy.dueOn(dueDate)}</p>}
          <p className="mt-1 text-xs text-ink-soft">
            {left > 0 ? (
              <>
                <span className={`font-semibold tabular-nums ${order.overdue ? "text-danger" : "text-ink"}`}>{copy.left(money(left, order.currency))}</span>{" "}
                <span className="tabular-nums">{copy.ofTotal(money(order.totalAmount, order.currency))}</span>
              </>
            ) : (
              <span className="font-semibold text-ink tabular-nums">{money(order.totalAmount, order.currency)}</span>
            )}
          </p>
        </div>
        <ChevronIcon size={18} className="shrink-0 -rotate-90 text-ink-soft rtl:rotate-90" />
      </StoreLink>
    </li>
  );
}
