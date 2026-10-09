import type { CustomerSubscription } from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { IconCancelled, IconCopy, IconCustomers, IconOrders, IconPause, IconPhone, IconPlay, IconWhatsApp } from "@/components/icons";
import { ListRowCard } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatDate, formatMoney } from "@/lib/format";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useViewNavigate } from "@/lib/viewTransition";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { dialablePhone, orderTelHref } from "@/pages/home/today/OrderQuickLook";
import { FactChip } from "@/pages/quotes/kit/Facts";
import { RenewalHoldChip } from "./RenewalHold";
import { MoreMenu } from "@/pages/quotes/kit/MoreMenu";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskRow } from "@/pages/returns/rowkit/DeskList";
import { rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { SUBSCRIPTION_STATUS_TONE, SUBSCRIPTION_STRINGS, everyText } from "./subscriptionText";

/** The columns of the subscriptions sheet: who and what, the plan, the next charge, where it stands, what to do. */
export const SUBSCRIPTION_COLUMNS = "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_max-content_max-content_max-content]";

export type SubscriptionMove = "pause" | "resume" | "cancel";

/** What can be done to a subscription as it stands — the same three rules the page always had. */
export function movesOf(sub: CustomerSubscription): Record<SubscriptionMove, boolean> {
  const ended = sub.status === "cancelled" || sub.status === "completed";
  return {
    pause: !ended && sub.status !== "paused",
    resume: (sub.status === "paused" || sub.status === "past_due") && sub.hasCard,
    cancel: !ended,
  };
}

/** The customer's own page for a subscription, on the storefront. */
export function portalLink(workspaceId: string, sub: CustomerSubscription): string {
  return `${STOREFRONT_URL}/store/${workspaceId}/subscriptions/${sub.portalToken}`;
}

export interface SubscriptionRowProps {
  sub: CustomerSubscription;
  workspaceId: string;
  /** A card (narrow screens) or a line of the sheet. */
  compact: boolean;
  /** Its preview is open. */
  current: boolean;
  /** A move for this subscription is on its way to the server. */
  busy: boolean;
  onPeek: () => void;
  onMove: (move: SubscriptionMove) => void;
}

/**
 * One subscription: whose it is and for which product, what it charges and
 * how often, when the next charge is tried, and where it stands. A press
 * opens Quick Look, where it is paused, resumed or cancelled; call and
 * WhatsApp are on the row. The same moves are in the row's menu (right-click,
 * a long press, Shift+F10) and, on a wide screen, behind its «…».
 */
export function SubscriptionRow({ sub, workspaceId, compact, current, busy, onPeek, onMove }: SubscriptionRowProps) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const navigate = useViewNavigate();
  const copy = useCopy();

  const customerTo = `/customers/${sub.customerId}`;
  const name = sub.customerName?.trim() || sub.customerPhone?.trim() || t.none;
  // A masked number is not one to dial or copy.
  const phone = dialablePhone(sub.customerPhone);
  const whatsapp = phone ? toWhatsAppNumber(phone) : null;
  const moves = movesOf(sub);
  const keys = rowKeyProps(onPeek, () => navigate(customerTo));
  const every = everyText(t, sub.interval, sub.intervalCount);
  const ended = sub.status === "cancelled" || sub.status === "completed";
  const noCard = !sub.hasCard && !ended;
  const failed = sub.failedAttempts > 0 && sub.status === "past_due";
  const kindText =
    sub.kind === "installments" && sub.installmentsTotal ? fmt(t.installmentsLeft, { made: sub.paymentsMade, total: sub.installmentsTotal }) : t[`kind_${sub.kind}`];

  const menu: ContextMenuItem[] = [
    { id: "customer", label: t.openCustomer, icon: IconCustomers, onSelect: () => navigate(customerTo) },
    { id: "order", label: t.openFirstOrder, icon: IconOrders, onSelect: () => navigate(`/orders/${sub.orderId}`) },
  ];
  if (phone) {
    menu.push({
      id: "call",
      label: t.menuCall,
      icon: IconPhone,
      separatorBefore: true,
      onSelect: () => {
        window.location.href = orderTelHref(phone);
      },
    });
  }
  if (whatsapp) {
    menu.push({
      id: "whatsapp",
      label: t.menuWhatsapp,
      icon: IconWhatsApp,
      onSelect: () => {
        window.open(`https://wa.me/${whatsapp}`, "_blank", "noopener,noreferrer");
      },
    });
  }
  if (phone) menu.push({ id: "copy-phone", label: t.menuCopyPhone, icon: IconCopy, separatorBefore: true, onSelect: () => copy(phone, t.copiedPhone) });
  menu.push({ id: "copy-portal", label: t.copyPortal, icon: IconCopy, separatorBefore: !phone, onSelect: () => copy(portalLink(workspaceId, sub), t.copiedPortal) });
  if (moves.pause) menu.push({ id: "pause", label: t.pause, icon: IconPause, separatorBefore: true, disabled: busy, onSelect: () => onMove("pause") });
  if (moves.resume) menu.push({ id: "resume", label: t.resume, icon: IconPlay, separatorBefore: !moves.pause, disabled: busy, onSelect: () => onMove("resume") });
  if (moves.cancel) menu.push({ id: "cancel", label: t.cancel, icon: IconCancelled, destructive: true, disabled: busy, onSelect: () => onMove("cancel") });

  const status = <StatusBadge value={sub.status} tone={SUBSCRIPTION_STATUS_TONE[sub.status]} text={t[`status_${sub.status}`]} />;
  const amount = <bdi dir="ltr">{formatMoney(sub.amount, sub.currency)}</bdi>;
  const product = (
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
  );
  const warnings = (
    <>
      {noCard && <FactChip tone="danger">{t.noCard}</FactChip>}
      {failed && <FactChip tone="danger">{fmt(t.retry, { n: sub.failedAttempts })}</FactChip>}
    </>
  );

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={t.menuLabel}>
          <ListRowCard
            title={<bdi>{name}</bdi>}
            amount={amount}
            status={status}
            meta={
              <>
                {product} · {every}
              </>
            }
            action={phone ? <ContactActions phone={phone} name={sub.customerName?.trim() || undefined} variant="icon" /> : undefined}
            footer={
              <>
                {warnings}
                <RenewalHoldChip sub={sub} />
                <FactChip>{kindText}</FactChip>
                {sub.nextRenewalAt && (
                  <FactChip>
                    {t.colNext}: {formatDate(sub.nextRenewalAt)}
                  </FactChip>
                )}
              </>
            }
            onOpen={onPeek}
            openLabel={fmt(t.peek, { who: name })}
            aria-haspopup="dialog"
            {...keys}
          />
        </ContextMenu>
      </li>
    );
  }

  return (
    <DeskRow onOpen={onPeek} openLabel={fmt(t.peek, { who: name })} keyProps={keys} current={current} menu={menu} menuLabel={t.menuLabel}>
      <div className="min-w-0">
        <p className="truncate text-[15px] leading-6 font-medium text-ink">
          {/* The name is the way to the customer's page; the row itself opens the preview. */}
          <ViewLink to={customerTo} className="rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <bdi>{name}</bdi>
          </ViewLink>
        </p>
        <p className="truncate text-xs leading-5 text-ink-soft">{product}</p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm leading-6 text-ink">
          <span className="font-medium tabular-nums">{amount}</span> <span className="text-ink-soft">{every}</span>
        </p>
        <p className="truncate text-xs leading-5 text-ink-soft">{kindText}</p>
      </div>

      <div className="flex min-w-0 flex-col items-start gap-1">
        <span className="text-sm whitespace-nowrap text-ink-soft">{sub.nextRenewalAt ? formatDate(sub.nextRenewalAt) : t.none}</span>
        {(noCard || failed) && <span className="flex flex-wrap gap-1">{warnings}</span>}
      </div>

      <div className="flex min-w-0 flex-col items-start justify-center gap-1">
        {status}
        <RenewalHoldChip sub={sub} />
      </div>

      <div className="flex items-center justify-end gap-1.5">
        {phone && <ContactActions phone={phone} name={sub.customerName?.trim() || undefined} variant="icon" />}
        <MoreMenu items={menu} label={t.menuLabel} variant="row" busy={busy} />
      </div>
    </DeskRow>
  );
}
