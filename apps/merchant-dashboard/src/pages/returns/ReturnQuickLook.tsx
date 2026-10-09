import type { ReactNode } from "react";
import { returnPhotosOf, returnSourceOf, type OrderItem, type ReturnRequest } from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import { IconCheck, IconClose, IconPackageOpen } from "@/components/icons";
import { QuickLook } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDate, formatDateTime } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { formatRelativeTime } from "@/lib/relativeTime";
import { dialablePhone } from "@/pages/home/today/OrderQuickLook";
import { OrderLineThumb } from "@/pages/orders/components/OrderLineThumb";
import { ReturnPhotos, ReturnSourceBadge } from "./ReturnExtras";
import { ReturnExchangeBadge, ReturnHandling } from "./ReturnHandling";
import { canModerate, canRestock, returnPieces, splitReason, useReturnLabels } from "./returnLabels";
import { InlineBone, RowAction } from "./rowkit/RowBits";
import type { OrderEntry } from "./useReturnsData";

const STRINGS = {
  en: {
    returnTitle: "Return",
    openOrder: "Open the order",
    asked: "Asked for {when}",
    reason: "Reason",
    customerNote: "In the customer's words",
    storeNote: "Details",
    items: "Coming back",
    times: "× {n}",
    customer: "Customer",
    noPhone: "No phone number",
    phoneHidden: "Part of the number is hidden",
    orderMissing: "This order can't be read with your role, or it no longer exists. The return can still be decided.",
    hintRequested: "Approving settles it with the customer. Putting the pieces back in stock is a separate step, once they reach you.",
    hintApproved: "When the pieces reach you, put them back in stock from here.",
    restockedAt: "Back in stock since {date}",
  },
  ar: {
    returnTitle: "مرتجع",
    openOrder: "افتح الأوردر",
    asked: "اتطلب {when}",
    reason: "السبب",
    customerNote: "كلام العميل",
    storeNote: "التفاصيل",
    items: "اللي راجع",
    times: "× {n}",
    customer: "العميل",
    noPhone: "مفيش رقم موبايل",
    phoneHidden: "جزء من الرقم مخفي",
    orderMissing: "الأوردر ده مش متاح لدورك أو اتمسح. تقدر برضه تاخد قرار في المرتجع.",
    hintRequested: "الموافقة بتخلّص الموضوع مع العميل. رجوع القطع للمخزون خطوة لوحدها، لما توصلك.",
    hintApproved: "لما القطع توصلك، رجّعها للمخزون من هنا.",
    restockedAt: "رجع المخزون {date}",
  },
} satisfies Messages;

export type ReturnAction = "approve" | "reject" | "restock";

/** In the footer of the preview a pill is as tall as the "open" link beside it: 40px with a mouse (44px under a finger, as everywhere). */
const FOOTER_PILL = "pointer-fine:h-10 pointer-fine:px-4";

/** A small quiet label over a block of the preview. */
function BlockLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs leading-4 font-medium text-ink-soft">{children}</h3>;
}

function itemOptions(item: OrderItem): string {
  if (!item.variantOptionsSnapshot) return "";
  return Object.values(item.variantOptionsSnapshot).filter(Boolean).join(" · ");
}

export interface ReturnQuickLookProps {
  /** The return being looked at. Null draws nothing (keep the last one while the panel closes). */
  ret: ReturnRequest | null;
  /** Its order, as far as it has arrived. */
  entry: OrderEntry | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The move on its way to the server for this return, if any. */
  busy: ReturnAction | null;
  onApprove: () => void;
  onReject: () => void;
  onRestock: () => void;
  /** The photo links are signed for minutes; this lists the returns again for fresh ones. */
  onPhotosExpired: () => void;
  /** The answer of the server after a pickup was booked or cancelled, or the return cancelled (handoff 372, 396). */
  onUpdated?: (updated: ReturnRequest) => void;
}

/**
 * A return at a glance, without leaving the queue: why it was opened and in
 * whose words, what is coming back, the photos (a tap grows one in place), who
 * to call — and the decision in the footer. "Open fully" goes to the order,
 * which is the page a return belongs to.
 *
 * The order behind it may still be on its way (the list sends only its id):
 * the number, the customer and the product names fill in when it lands, in
 * lines that are already the right height.
 */
export function ReturnQuickLook({ ret, entry, open, onOpenChange, busy, onApprove, onReject, onRestock, onPhotosExpired, onUpdated }: ReturnQuickLookProps) {
  const t = useT(STRINGS);
  const labels = useReturnLabels();
  if (!ret) return null;

  const order = entry?.status === "ready" ? entry.order : null;
  const pending = !entry || entry.status === "loading";
  const { code, detail } = splitReason(ret.reason);
  const fromCustomer = returnSourceOf(ret) === "shopper";
  const name = order?.contactSnapshot?.fullName?.trim() || "";
  const rawPhone = order?.contactSnapshot?.phone?.trim() || "";
  // A masked number (010****665) is not one to dial: calling needs the whole number.
  const phone = dialablePhone(rawPhone);
  const moderate = canModerate(ret);
  const restock = canRestock(ret);

  return (
    <QuickLook
      open={open}
      onOpenChange={onOpenChange}
      title={
        order ? (
          <bdi dir="ltr">{order.orderNumber}</bdi>
        ) : pending ? (
          <>
            <span className="sr-only">{t.returnTitle}</span>
            <InlineBone className="w-20" />
          </>
        ) : (
          t.returnTitle
        )
      }
      subtitle={name ? <bdi>{name}</bdi> : undefined}
      status={<StatusBadge value={ret.status} text={labels.status(ret.status)} />}
      to={`/orders/${ret.orderId}`}
      openLabel={t.openOrder}
      actions={
        moderate ? (
          <>
            <RowAction className={FOOTER_PILL} tone="danger" label={labels.reject} icon={IconClose} disabled={busy !== null} onClick={onReject} />
            <RowAction className={FOOTER_PILL} label={labels.approve} icon={IconCheck} busy={busy === "approve"} disabled={busy !== null} onClick={onApprove} />
          </>
        ) : restock ? (
          <RowAction className={FOOTER_PILL} label={labels.restock} icon={IconPackageOpen} busy={busy === "restock"} disabled={busy !== null} onClick={onRestock} />
        ) : undefined
      }
    >
      <div data-slot="return-peek" className="space-y-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-ink-soft">
          <time dateTime={ret.createdAt} title={formatDateTime(ret.createdAt)}>
            {fmt(t.asked, { when: formatRelativeTime(ret.createdAt) })}
          </time>
          <span aria-hidden>·</span>
          <span>{formatDate(ret.createdAt)}</span>
          {fromCustomer && <ReturnSourceBadge />}
          <ReturnExchangeBadge ret={ret} />
        </p>

        <section>
          <BlockLabel>{t.reason}</BlockLabel>
          <p className="text-[15px] leading-6 font-semibold text-ink">{labels.reason(code)}</p>
          {/* Its own block, with dir="auto": the words are the customer's (or the merchant's) own, not
              necessarily in the language of the dashboard. */}
          {detail && (
            <figure data-slot="return-note" className="mt-2 rounded-2xl bg-paper-sunken px-4 py-3">
              <figcaption className="text-xs leading-4 font-medium text-ink-soft">{fromCustomer ? t.customerNote : t.storeNote}</figcaption>
              <blockquote dir="auto" className="mt-1 text-sm leading-6 wrap-anywhere text-ink">
                {detail}
              </blockquote>
            </figure>
          )}
        </section>

        <section>
          <BlockLabel>
            {t.items} · {countOf("piece", returnPieces(ret))}
          </BlockLabel>
          <ul className="space-y-1">
            {ret.items.map((line) => {
              const item = order?.items.find((i) => i.id === line.orderItemId);
              const options = item ? itemOptions(item) : "";
              return (
                <li key={line.orderItemId} className="flex min-h-12 items-center gap-3">
                  {item ? (
                    <OrderLineThumb item={item} className="size-11 rounded-xl" />
                  ) : (
                    <span aria-hidden className="size-11 shrink-0 rounded-xl bg-paper-sunken" />
                  )}
                  <div className="min-w-0 flex-1">
                    {/* The name once the order has landed; a bone while it is in flight; the short id if it never arrives. */}
                    <p className="truncate text-sm leading-5 font-medium text-ink">
                      {item ? (
                        <bdi>{item.productNameSnapshot}</bdi>
                      ) : pending ? (
                        <InlineBone className="w-32" />
                      ) : (
                        <bdi dir="ltr">{line.orderItemId.slice(0, 8)}</bdi>
                      )}
                    </p>
                    {options && (
                      <p className="truncate text-xs leading-4 text-ink-soft">
                        <bdi>{options}</bdi>
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-sm leading-5 font-semibold text-ink tabular-nums">{fmt(t.times, { n: line.quantity })}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <ReturnPhotos photos={returnPhotosOf(ret)} onExpired={onPhotosExpired} inline />

        {/* The exchange asked for, the message sent, the courier pickup and "Cancel return". */}
        {onUpdated && <ReturnHandling ret={ret} order={order} onUpdated={onUpdated} className="space-y-2 text-sm" />}

        <div role="separator" data-slot="return-peek-rule" className="h-px bg-line" />

        <section>
          <BlockLabel>{t.customer}</BlockLabel>
          {order ? (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
              <div className="min-w-0">
                <p className="truncate text-[15px] leading-6 font-medium text-ink">
                  <bdi>{name || labels.noName}</bdi>
                </p>
                {rawPhone ? (
                  <p className="flex flex-wrap items-center gap-x-2 text-sm leading-5 text-ink-soft tabular-nums">
                    <bdi dir="ltr">{rawPhone}</bdi>
                    {/* A masked number is shown as it came, and said to be masked: never dressed up as whole. */}
                    {!phone && <span className="text-xs">{t.phoneHidden}</span>}
                  </p>
                ) : (
                  <p className="text-sm leading-5 text-ink-soft">{t.noPhone}</p>
                )}
              </div>
              {phone && <ContactActions phone={phone} name={name || undefined} />}
            </div>
          ) : pending ? (
            <div aria-hidden className="flex flex-col gap-1 text-[15px] leading-6">
              <InlineBone className="w-36" />
              <InlineBone className="w-28" />
            </div>
          ) : (
            <p className="text-sm leading-6 text-ink-soft">{t.orderMissing}</p>
          )}
        </section>

        {(moderate || restock || ret.restockedAt) && (
          <p data-slot="return-hint" className="text-[13px] leading-5 text-ink-soft">
            {ret.restockedAt ? fmt(t.restockedAt, { date: formatDateTime(ret.restockedAt) }) : moderate ? t.hintRequested : t.hintApproved}
          </p>
        )}
      </div>
    </QuickLook>
  );
}
