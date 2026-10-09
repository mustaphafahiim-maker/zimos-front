import type { ReactNode } from "react";
import type { PickupListItem } from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import { IconCheck, IconClock, IconPacked, IconPlace, IconStore } from "@/components/icons";
import { QuickLook } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { dialablePhone } from "@/pages/home/today/OrderQuickLook";
import { RowAction } from "@/pages/returns/rowkit/RowBits";
import { PICKUP_STATUS_KEY, PICKUP_STATUS_TONE, PICKUP_STRINGS, pickupTextOf } from "./pickupStrings";

/** In the footer of the preview a pill is 40px with a mouse (44px under a finger, as everywhere). */
const FOOTER_PILL = "pointer-fine:h-10 pointer-fine:px-4";

/** A small quiet label over a block of the preview. */
function BlockLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs leading-4 font-medium text-ink-soft">{children}</h3>;
}

export interface PickupQuickLookProps {
  /** The pickup being looked at. Null draws nothing (keep the last one while the panel closes). */
  item: PickupListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  /** «جاهز» is on its way to the server for this order. */
  marking: boolean;
  /** Some «جاهز» is on its way: no second move starts meanwhile. */
  locked: boolean;
  onMarkReady: () => void;
  onHandOver: () => void;
}

/**
 * A pickup at a glance, without leaving the queue: what the customer pays (or
 * has paid), where they collect it and when the place is open, who to call —
 * and the two moves in the footer: «جاهز» and «تسليم». "Open fully" goes to
 * the order. Everything here came with the list, so opening it costs no
 * request.
 */
export function PickupQuickLook({ item, open, onOpenChange, canManage, marking, locked, onMarkReady, onHandOver }: PickupQuickLookProps) {
  const t = useT(PICKUP_STRINGS);
  const { locale } = useLocale();
  if (!item) return null;

  const { order, location } = item;
  const name = order.customerName?.trim() || "";
  const rawPhone = order.phone?.trim() || "";
  // A masked number (010****665) is not one to dial: calling needs the whole number.
  const phone = dialablePhone(rawPhone);
  const paid = order.financialState === "paid";
  const isOpen = item.status === "pending" || item.status === "ready";
  const hours = pickupTextOf(location?.hours, locale);
  const instructions = pickupTextOf(location?.instructions, locale);

  return (
    <QuickLook
      open={open}
      onOpenChange={onOpenChange}
      title={<bdi dir="ltr">{order.orderNumber}</bdi>}
      subtitle={name ? <bdi>{name}</bdi> : undefined}
      status={<StatusBadge value={item.status} tone={PICKUP_STATUS_TONE[item.status]} text={t[PICKUP_STATUS_KEY[item.status]]} />}
      to={`/orders/${item.orderId}`}
      openLabel={t.openOrderFull}
      actions={
        canManage && isOpen ? (
          <>
            {item.status === "pending" && (
              // An order may be handed over without ever being marked ready: the quieter of the two here.
              <RowAction className={FOOTER_PILL} tone="quiet" label={t.handOver} icon={IconPacked} disabled={locked} onClick={onHandOver} />
            )}
            {item.status === "pending" ? (
              <RowAction className={FOOTER_PILL} label={t.markReady} icon={IconCheck} busy={marking} disabled={locked} onClick={onMarkReady} />
            ) : (
              <RowAction className={FOOTER_PILL} label={t.handOver} icon={IconPacked} disabled={locked} onClick={onHandOver} />
            )}
          </>
        ) : undefined
      }
    >
      <div data-slot="pickup-peek" className="space-y-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-ink-soft">
          <time dateTime={order.createdAt} title={formatDateTime(order.createdAt)}>
            {fmt(t.placedWhen, { when: formatRelativeTime(order.createdAt) })}
          </time>
          <span aria-hidden>·</span>
          <span>{formatDate(order.createdAt)}</span>
        </p>

        <section>
          <BlockLabel>{t.total}</BlockLabel>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="text-[28px] leading-9 font-semibold text-ink tabular-nums">
              <bdi>{formatMoney(order.totalAmount, order.currency)}</bdi>
            </p>
            <StatusBadge value={paid ? "paid" : "cod"} tone={paid ? "success" : "warning"} text={paid ? t.paid : t.payOnPickup} />
          </div>
        </section>

        <section>
          <BlockLabel>{t.pickupPlace}</BlockLabel>
          <div className="zimos-pickup-place rounded-2xl bg-paper-sunken px-4 py-3">
            <p className="flex items-start gap-2.5 text-[15px] leading-6 font-semibold text-ink">
              <IconStore className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden />
              <bdi className="min-w-0">{location?.name || "—"}</bdi>
            </p>
            {location?.address && (
              <p className="mt-1.5 flex items-start gap-2.5 text-sm leading-6 text-ink-soft">
                <IconPlace className="mt-1 size-4 shrink-0" aria-hidden />
                <bdi className="min-w-0">{location.address}</bdi>
              </p>
            )}
            {hours && (
              <p className="mt-1.5 flex items-start gap-2.5 text-sm leading-6 text-ink-soft">
                <IconClock className="mt-1 size-4 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="sr-only">{t.hours}: </span>
                  <bdi>{hours}</bdi>
                </span>
              </p>
            )}
            {instructions && (
              <p dir="auto" className="mt-2 border-t border-line pt-2 text-sm leading-6 text-ink">
                <span className="sr-only">{t.instructions}: </span>
                {instructions}
              </p>
            )}
          </div>
          {item.status === "ready" && item.readyAt && (
            <p className="mt-2 text-xs leading-5 text-ink-soft">{fmt(t.readySince, { time: formatDateTime(item.readyAt) })}</p>
          )}
          {item.status === "collected" && item.collectedAt && (
            <p className="mt-2 text-xs leading-5 text-ink-soft">{fmt(t.collectedOn, { time: formatDateTime(item.collectedAt) })}</p>
          )}
        </section>

        <div role="separator" className="h-px bg-line" />

        <section>
          <BlockLabel>{t.customer}</BlockLabel>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
            <div className="min-w-0">
              <p className="truncate text-[15px] leading-6 font-medium text-ink">
                <bdi>{name || t.noName}</bdi>
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
        </section>

        {canManage && isOpen && <p className="text-[13px] leading-5 text-ink-soft">{item.status === "pending" ? t.hintPending : t.hintReady}</p>}
      </div>
    </QuickLook>
  );
}
