import { useState } from "react";
import type { Customer, Order } from "@store-builder/api-client";
import { Button, cn } from "@store-builder/ui";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState, SkeletonBar } from "@/components/DataState";
import { IconCopy, IconOrders } from "@/components/icons";
import { useQuickLookRow } from "@/components/QuickLook";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatDateTime, formatMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useAsync } from "@/lib/useAsync";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { OrderQuickLook } from "@/pages/home/today/OrderQuickLook";
import { OrderLineThumb } from "@/pages/orders/components/OrderLineThumb";
import { STAGE_TONE, useOrderLabels } from "@/pages/orders/orderLabels";
import { copyText } from "./sections";

const STRINGS = {
  en: {
    ordersTitle: "Their orders",
    ordersEmpty: "No orders from this customer yet.",
    ordersIncomplete: "Only the store's first {n} orders were searched, so this list may be incomplete.",
    showAll: "Show all ({n})",
    showLess: "Show fewer",
    menuLabel: "Actions for order {number}",
    menuOpen: "Open the order",
    menuCopyOrder: "Copy the order number",
    copiedOrder: "The order number is copied",
    copyFailed: "We couldn't copy that. Try again.",
    confLabel: "Confirmation",
    shipLabel: "Shipping",
  },
  ar: {
    ordersTitle: "أوردرات العميل",
    ordersEmpty: "مفيش أوردرات من العميل ده لسه.",
    ordersIncomplete: "دوّرنا في أول {n} أوردر في المتجر بس، فممكن القايمة دي تكون ناقصة.",
    showAll: "اعرض الكل ({n})",
    showLess: "اعرض أقل",
    menuLabel: "إجراءات الأوردر {number}",
    menuOpen: "افتح الأوردر",
    menuCopyOrder: "انسخ رقم الأوردر",
    copiedOrder: "رقم الأوردر اتنسخ",
    copyFailed: "معرفناش ننسخ. جرّب تاني.",
    confLabel: "التأكيد",
    shipLabel: "الشحن",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

const HISTORY_PAGE_SIZE = 50;
const HISTORY_MAX_PAGES = 20;
/** How many orders show before «اعرض الكل»: the newest five say who this customer is. */
const FIRST_ROWS = 5;

/**
 * The customer's orders, newest first, right under the hero: each a row — its
 * number, how long ago, what it came to, where it stands — that opens the
 * order's Quick Look without leaving the page (Space on the keyboard too;
 * Enter opens the order's own page). The newest five show, with «اعرض الكل».
 *
 * The API has no per-customer order list: a customer response carries no
 * orders, and GET /orders filters only by state (paging by id, not date). So
 * this pages through the store's orders and keeps this customer's, stopping as
 * soon as it has found `totalOrders` of them — or after 1,000 orders, in which
 * case it says the list may be incomplete. A customer with no orders costs no
 * request at all.
 */
export function CustomerOrders({ customer, className }: { customer: Customer; className?: string }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const history = useAsync(async () => {
    const found: Order[] = [];
    if (customer.totalOrders === 0) return { orders: found, complete: true };
    let cursor: string | undefined;
    for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
      const { orders, nextCursor } = await apiClient.listOrders(workspaceId, {
        limit: HISTORY_PAGE_SIZE,
        cursor,
      });
      found.push(...orders.filter((order) => order.customerId === customer.id));
      if (!nextCursor || found.length >= customer.totalOrders) {
        found.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return { orders: found, complete: true };
      }
      cursor = nextCursor;
    }
    found.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { orders: found, complete: false };
  }, [workspaceId, customer.id, customer.totalOrders]);

  const orders = history.data?.orders ?? [];
  const [all, setAll] = useState(false);
  // The order being looked at. It stays here while the panel closes, so the panel does not empty on its way out.
  const [peek, setPeek] = useState<{ order: Order; open: boolean } | null>(null);

  // A customer who never ordered costs no request: nothing to wait for. Orders already on screen stay while they are read again.
  const waiting = history.loading && !history.data && customer.totalOrders > 0;
  const failed = Boolean(history.error) && !history.data;
  const shown = all ? orders : orders.slice(0, FIRST_ROWS);
  const count = history.data ? orders.length : customer.totalOrders;
  // The preview follows the list: a refresh that changes the order shows in the open panel too.
  const peeked = peek ? (orders.find((order) => order.id === peek.order.id) ?? peek.order) : null;

  return (
    <Section
      title={t.ordersTitle}
      flush
      className={className}
      actions={count > 0 ? <span className="text-xs text-ink-soft tabular-nums">{countOf("order", count)}</span> : undefined}
    >
      {waiting ? (
        // As many rows as will arrive (five at most), at the height they will have: nothing jumps.
        <div role="status" aria-busy="true" className="px-2 pb-2">
          <div aria-hidden>
            {Array.from({ length: Math.min(customer.totalOrders, FIRST_ROWS) }, (_, i) => (
              <div key={i} className="flex min-h-16 items-center gap-3 px-2 py-2">
                <SkeletonBar className="size-9 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <SkeletonBar className="w-24" />
                  <SkeletonBar className="mt-2.5 h-2.5 w-36 max-w-full" />
                </div>
                <SkeletonBar className="w-16 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ) : failed ? (
        <div className="px-4 pb-4">
          <DataState loading={false} error={history.error} onRetry={() => void history.refresh()}>
            {null}
          </DataState>
        </div>
      ) : orders.length === 0 ? (
        <p className="flex items-center gap-3 px-4 pb-4 text-sm leading-6 text-ink-soft">
          <span
            aria-hidden
            data-slot="home-chip"
            data-tone="neutral"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-paper-sunken text-ink-soft"
          >
            <IconOrders className="size-[18px]" weight="duotone" />
          </span>
          {t.ordersEmpty}
        </p>
      ) : (
        <>
          <ul className="space-y-0.5 px-2 pb-2">
            {shown.map((order) => (
              <OrderRow key={order.id} order={order} t={t} onPeek={(next) => setPeek({ order: next, open: true })} />
            ))}
          </ul>
          {orders.length > FIRST_ROWS && (
            <div className="border-t border-line px-2 py-1">
              <Button type="button" variant="ghost" size="sm" className="min-h-11 rounded-full px-3" aria-expanded={all} onClick={() => setAll((v) => !v)}>
                {all ? t.showLess : fmt(t.showAll, { n: orders.length })}
              </Button>
            </div>
          )}
        </>
      )}

      {history.data && !history.data.complete && (
        <p className={cn("px-4 pb-3 text-xs leading-5 text-ink-soft", orders.length > FIRST_ROWS && "pt-1")}>{fmt(t.ordersIncomplete, { n: HISTORY_PAGE_SIZE * HISTORY_MAX_PAGES })}</p>
      )}

      <OrderQuickLook
        order={peeked}
        open={Boolean(peek?.open)}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
      />
    </Section>
  );
}

/**
 * One order of the customer: its first product, its number and what it came
 * to, then where it stands and how long ago. The whole row opens the preview
 * (click, or Space on the keyboard; Enter opens the order's page). Right-click,
 * a long press or Shift+F10 gives the same as a menu.
 */
function OrderRow({ order, t, onPeek }: { order: Order; t: Strings; onPeek: (order: Order) => void }) {
  const labels = useOrderLabels();
  const toast = useToast();
  const navigate = useViewNavigate();
  const peekProps = useQuickLookRow(() => onPeek(order));

  const to = `/orders/${order.id}`;
  const items = order.items ?? [];
  const first = items[0];

  const menu: ContextMenuItem[] = [
    { id: "open", label: t.menuOpen, icon: IconOrders, onSelect: () => navigate(to) },
    {
      id: "copy-order",
      label: t.menuCopyOrder,
      icon: IconCopy,
      separatorBefore: true,
      onSelect: () => {
        void copyText(order.orderNumber).then((done) => (done ? toast.success(t.copiedOrder) : toast.error(t.copyFailed)));
      },
    },
  ];

  return (
    <ContextMenu items={menu} label={fmt(t.menuLabel, { number: order.orderNumber })}>
      <li
        data-slot="customer-order-row"
        className="relative flex min-h-16 items-center gap-3 rounded-2xl px-2 py-2 transition-colors duration-(--dur-fade) ease-(--ease-out) hover:bg-paper-sunken motion-reduce:transition-none"
      >
        <span aria-hidden className="flex size-9 shrink-0">
          {first ? (
            <OrderLineThumb item={first} className="size-9 rounded-xl" />
          ) : (
            <span
              data-slot="home-chip"
              data-tone="primary"
              className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-dark"
            >
              <IconOrders className="size-[18px]" weight="duotone" />
            </span>
          )}
        </span>

        {/* The row's own button: its ::after covers the whole row, so the thumbnail and the gaps open the preview too. */}
        <div
          role="button"
          aria-haspopup="dialog"
          {...peekProps}
          onKeyDown={(e) => {
            // Space peeks (useQuickLookRow); Enter, on the row itself, opens the order's page.
            peekProps.onKeyDown(e);
            if (e.key !== "Enter" || e.target !== e.currentTarget || e.defaultPrevented || e.repeat) return;
            e.preventDefault();
            navigate(to);
          }}
          onClick={(e) => {
            // Ctrl / ⌘ + click is "in a new tab", as on a link.
            if (e.metaKey || e.ctrlKey) {
              window.open(to, "_blank", "noopener");
              return;
            }
            onPeek(order);
          }}
          className="min-w-0 flex-1 cursor-pointer outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-primary"
        >
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 truncate text-[15px] leading-6 font-medium text-ink tabular-nums">
              <bdi dir="ltr">{order.orderNumber}</bdi>
            </span>
            <span className="ms-auto shrink-0 ps-1 text-sm leading-6 font-semibold whitespace-nowrap text-ink tabular-nums">
              <bdi dir="ltr">{formatMoney(order.totalAmount, order.currency)}</bdi>
            </span>
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-5 text-ink-soft">
            {order.stage ? (
              <StatusBadge value={order.stage} tone={STAGE_TONE[order.stage]} text={labels.stage(order.stage)} className="shrink-0" />
            ) : (
              // An answer without a stage: the two states it is made of, as the page always showed them.
              <>
                <StatusBadge label={t.confLabel} value={order.confirmationState} text={labels.confirmation(order.confirmationState)} className="shrink-0" />
                <StatusBadge label={t.shipLabel} value={order.fulfillmentState} text={labels.fulfillment(order.fulfillmentState)} className="shrink-0" />
              </>
            )}
            <time dateTime={order.createdAt} title={formatDateTime(order.createdAt)} className="min-w-0 truncate">
              {formatRelativeTime(order.createdAt)}
            </time>
            {items.length > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="shrink-0 tabular-nums">{countOf("item", items.length)}</span>
              </>
            )}
          </div>
        </div>
      </li>
    </ContextMenu>
  );
}
