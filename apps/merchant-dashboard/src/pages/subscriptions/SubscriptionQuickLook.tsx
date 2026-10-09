import { useRenewalHoldFacts } from "./RenewalHold";
import type { CustomerSubscription } from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import { CopyButton } from "@/components/CopyButton";
import { IconCancelled, IconPause, IconPlay } from "@/components/icons";
import { QuickLook } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatDate, formatMoney } from "@/lib/format";
import { dialablePhone } from "@/pages/home/today/OrderQuickLook";
import { BlockLabel, FactList } from "@/pages/quotes/kit/Facts";
import { RowAction } from "@/pages/returns/rowkit/RowBits";
import { movesOf, portalLink, type SubscriptionMove } from "./SubscriptionRow";
import { SUBSCRIPTION_STATUS_TONE, SUBSCRIPTION_STRINGS, everyText } from "./subscriptionText";

/** Every action of the footer shares one height with the "open fully" pill beside it. */
const FOOTER_PILL = "h-11 px-4 pointer-fine:h-10 pointer-fine:px-4";
const LINK = "inline-flex min-h-11 items-center text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary pointer-fine:min-h-0";

export interface SubscriptionQuickLookProps {
  /** The subscription being looked at. Null draws nothing (keep the last one while the panel closes). */
  sub: CustomerSubscription | null;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The move on its way to the server for this subscription, if any. */
  busy: SubscriptionMove | null;
  onMove: (move: SubscriptionMove) => void;
}

/**
 * A subscription at a glance, without leaving the list: what it charges and
 * how often, the next charge and what stands in its way (no saved card, a
 * failed attempt), who to call — and in the footer the moves its status
 * allows: pause, resume, cancel. "Open fully" goes to the customer, the page
 * a subscription belongs to.
 */
export function SubscriptionQuickLook({ sub, workspaceId, open, onOpenChange, busy, onMove }: SubscriptionQuickLookProps) {
  const t = useT(SUBSCRIPTION_STRINGS);
  // handoff 394: a renewal held by the store's side, and one that lapsed while held.
  const holdFacts = useRenewalHoldFacts(sub);
  if (!sub) return null;

  const name = sub.customerName?.trim() || sub.customerPhone?.trim() || t.none;
  const rawPhone = sub.customerPhone?.trim() || "";
  const phone = dialablePhone(rawPhone);
  const moves = movesOf(sub);
  const ended = sub.status === "cancelled" || sub.status === "completed";
  const acting = busy !== null;
  const link = portalLink(workspaceId, sub);

  return (
    <QuickLook
      open={open}
      onOpenChange={onOpenChange}
      title={<bdi>{name}</bdi>}
      status={<StatusBadge value={sub.status} tone={SUBSCRIPTION_STATUS_TONE[sub.status]} text={t[`status_${sub.status}`]} />}
      to={`/customers/${sub.customerId}`}
      openLabel={t.openCustomer}
      actions={
        moves.pause || moves.resume || moves.cancel ? (
          <>
            {moves.cancel && <RowAction className={FOOTER_PILL} tone="danger" label={t.cancel} icon={IconCancelled} disabled={acting} onClick={() => onMove("cancel")} />}
            {moves.pause && (
              <RowAction className={FOOTER_PILL} tone="quiet" label={t.pause} icon={IconPause} busy={busy === "pause"} disabled={acting} onClick={() => onMove("pause")} />
            )}
            {moves.resume && (
              <RowAction className={FOOTER_PILL} tone="quiet" label={t.resume} icon={IconPlay} busy={busy === "resume"} disabled={acting} onClick={() => onMove("resume")} />
            )}
          </>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <section>
          <p className="text-[28px] leading-9 font-semibold tracking-tight text-ink tabular-nums">
            <bdi dir="ltr">{formatMoney(sub.amount, sub.currency)}</bdi>{" "}
            <span className="text-base font-normal text-ink-soft">{everyText(t, sub.interval, sub.intervalCount)}</span>
          </p>
        </section>

        <FactList
          rows={[
            {
              label: t.qlProduct,
              value: (
                <>
                  <bdi>{sub.productName}</bdi>
                  {sub.quantity > 1 && (
                    <>
                      {" "}
                      <bdi dir="ltr" className="tabular-nums">
                        {fmt(t.times, { n: sub.quantity })}
                      </bdi>
                    </>
                  )}
                </>
              ),
            },
            { label: t.qlPlan, value: t[`kind_${sub.kind}`] },
            sub.kind === "installments" && sub.installmentsTotal
              ? { label: t.qlPaid, value: fmt(t.installmentsLeft, { made: sub.paymentsMade, total: sub.installmentsTotal }) }
              : sub.paymentsMade > 0
                ? { label: t.qlPaid, value: <span className="tabular-nums">{fmt("{n}", { n: sub.paymentsMade })}</span> }
                : null,
            { label: t.qlNext, value: sub.nextRenewalAt ? formatDate(sub.nextRenewalAt) : t.none },
            !ended && {
              label: t.qlCard,
              value: sub.hasCard ? t.cardSaved : <span className="text-danger">{t.noCard}</span>,
            },
            sub.failedAttempts > 0 && sub.status === "past_due"
              ? {
                  label: t.qlFailed,
                  value: (
                    <span className="text-danger">
                      {fmt(t.retry, { n: sub.failedAttempts })}
                      {sub.lastFailureReason && (
                        <>
                          {" · "}
                          <bdi>{sub.lastFailureReason}</bdi>
                        </>
                      )}
                    </span>
                  ),
                }
              : null,
            ...holdFacts,
            { label: t.qlStarted, value: formatDate(sub.createdAt) },
            {
              label: t.firstOrder,
              value: (
                <ViewLink to={`/orders/${sub.orderId}`} className={LINK}>
                  {t.openOrder}
                </ViewLink>
              ),
            },
            sub.lastOrderId && sub.lastOrderId !== sub.orderId
              ? {
                  label: t.lastOrder,
                  value: (
                    <ViewLink to={`/orders/${sub.lastOrderId}`} className={LINK}>
                      {t.openOrder}
                    </ViewLink>
                  ),
                }
              : null,
          ]}
        />

        <section>
          <BlockLabel>{t.qlCustomer}</BlockLabel>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
            <div className="min-w-0">
              <p className="truncate text-[15px] leading-6 font-medium text-ink">
                <bdi>{name}</bdi>
              </p>
              {rawPhone && (
                <p className="text-sm leading-5 text-ink-soft tabular-nums">
                  <bdi dir="ltr">{rawPhone}</bdi>
                </p>
              )}
            </div>
            {phone && <ContactActions phone={phone} name={sub.customerName?.trim() || undefined} />}
          </div>
        </section>

        <section>
          <BlockLabel>{t.qlPortal}</BlockLabel>
          <div data-slot="kinds-well" className="flex min-w-0 items-center justify-between gap-2 rounded-2xl bg-paper-sunken py-1 ps-3.5 pe-1.5">
            <bdi dir="ltr" className="min-w-0 flex-1 truncate text-sm text-ink">
              {link}
            </bdi>
            <CopyButton value={link} label={t.copyPortal} className="min-h-11 shrink-0" labelClassName="sr-only" />
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-soft">{t.portalHint}</p>
        </section>
      </div>
    </QuickLook>
  );
}
