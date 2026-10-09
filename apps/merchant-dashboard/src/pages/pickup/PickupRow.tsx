import type { PickupListItem } from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { ContextMenu } from "@/components/ContextMenu";
import { IconCheck, IconCopy, IconOrders, IconPacked, IconPhone, IconWhatsApp } from "@/components/icons";
import { ListRowCard } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatDateTime, formatMoney } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useViewNavigate } from "@/lib/viewTransition";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { dialablePhone, orderTelHref } from "@/pages/home/today/OrderQuickLook";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction, rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { PICKUP_STATUS_KEY, PICKUP_STATUS_TONE, PICKUP_STRINGS } from "./pickupStrings";

/** The columns of the pickups sheet from a wide screen up — with the place, and without it for a store with one. */
export const PICKUP_COLUMNS = "grid-cols-[minmax(0,1.4fr)_max-content_minmax(0,0.8fr)_max-content_max-content_max-content]";
export const PICKUP_COLUMNS_ONE_PLACE = "grid-cols-[minmax(0,1.4fr)_max-content_max-content_max-content_max-content]";

export interface PickupRowProps {
  item: PickupListItem;
  /** A card (narrow screens) or a line of the sheet. */
  compact: boolean;
  /** The store has more than one pickup place: say which one this order waits at. */
  showPlace: boolean;
  /** This role may get pickups ready and hand them over. */
  canManage: boolean;
  /** «جاهز» is on its way to the server for this order. */
  marking: boolean;
  /** Some «جاهز» is on its way: no second one starts meanwhile. */
  locked: boolean;
  /** Its preview is open. */
  current: boolean;
  onPeek: () => void;
  onMarkReady: () => void;
  onHandOver: () => void;
}

/**
 * One pickup in the queue: who collects it and how much they pay, where it
 * stands, and the ONE move its status allows — «جاهز» for an order still being
 * prepared, «تسليم» for one that waits for its customer. A press anywhere else
 * opens Quick Look (Space too; Enter opens the order). Handing over an order
 * that was never marked ready is in Quick Look and in the row's menu
 * (right-click, a long press, Shift+F10), with the call, WhatsApp and copy
 * actions.
 */
export function PickupRow({ item, compact, showPlace, canManage, marking, locked, current, onPeek, onMarkReady, onHandOver }: PickupRowProps) {
  const t = useT(PICKUP_STRINGS);
  const navigate = useViewNavigate();
  const copy = useCopy();

  const { order } = item;
  const to = `/orders/${item.orderId}`;
  const name = order.customerName?.trim() || "";
  // A masked number (010****665) is not one to dial or copy: every action on it needs the whole number.
  const phone = dialablePhone(order.phone);
  const whatsapp = phone ? toWhatsAppNumber(phone) : null;
  const open = item.status === "pending" || item.status === "ready";
  const paid = order.financialState === "paid";
  const who = [name, order.orderNumber].filter(Boolean).join(" · ");
  const keys = rowKeyProps(onPeek, () => navigate(to));

  const menu: ContextMenuItem[] = [{ id: "open", label: t.menuOpen, icon: IconOrders, onSelect: () => navigate(to) }];
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
  menu.push({ id: "copy-order", label: t.menuCopyOrder, icon: IconCopy, separatorBefore: !phone, onSelect: () => copy(order.orderNumber, t.copiedOrder) });
  if (canManage && item.status === "pending") {
    menu.push({ id: "ready", label: t.markReady, icon: IconCheck, separatorBefore: true, disabled: locked, onSelect: onMarkReady });
  }
  if (canManage && open) {
    menu.push({ id: "hand-over", label: t.handOver, icon: IconPacked, separatorBefore: item.status !== "pending", disabled: locked, onSelect: onHandOver });
  }

  const action = !canManage ? null : item.status === "pending" ? (
    <RowAction label={t.markReady} icon={IconCheck} busy={marking} disabled={locked} onClick={onMarkReady} />
  ) : item.status === "ready" ? (
    // On a card the words alone: beside the status chip there is no room for a glyph too.
    <RowAction label={t.handOver} icon={compact ? undefined : IconPacked} disabled={locked} onClick={onHandOver} />
  ) : null;

  const status = <StatusBadge value={item.status} tone={PICKUP_STATUS_TONE[item.status]} text={t[PICKUP_STATUS_KEY[item.status]]} />;
  const money = formatMoney(order.totalAmount, order.currency);
  // When it got to where it stands — ready, or collected — said beside the status chip, which already has the word.
  const sinceIso = item.status === "ready" ? item.readyAt : item.status === "collected" ? item.collectedAt : null;
  const since = sinceIso ? (
    <time dateTime={sinceIso} title={formatDateTime(sinceIso)}>
      {formatRelativeTime(sinceIso)}
    </time>
  ) : null;
  const age = (
    <time dateTime={order.createdAt} title={formatDateTime(order.createdAt)}>
      {formatRelativeTime(order.createdAt)}
    </time>
  );
  const payChip = <StatusBadge value={paid ? "paid" : "cod"} tone={paid ? "success" : "warning"} text={paid ? t.paid : t.payOnPickup} />;

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={fmt(t.menuLabel, { number: order.orderNumber })}>
          <ListRowCard
            title={<bdi>{name || t.noName}</bdi>}
            amount={<bdi>{money}</bdi>}
            status={status}
            meta={
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 tabular-nums">
                  <bdi dir="ltr">{order.orderNumber}</bdi>
                </span>
                <span aria-hidden>·</span>
                <span className="min-w-0 truncate">{since ?? age}</span>
              </span>
            }
            action={action}
            footer={
              <>
                {payChip}
                {showPlace && item.location?.name && (
                  <span className="inline-flex max-w-full items-center rounded-full bg-paper-sunken px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                    <bdi className="truncate">{item.location.name}</bdi>
                  </span>
                )}
              </>
            }
            onOpen={onPeek}
            openLabel={fmt(t.peek, { who })}
            aria-haspopup="dialog"
            {...keys}
          />
        </ContextMenu>
      </li>
    );
  }

  return (
    <DeskRow onOpen={onPeek} openLabel={fmt(t.peek, { who })} keyProps={keys} current={current} menu={menu} menuLabel={fmt(t.menuLabel, { number: order.orderNumber })}>
      <div className="min-w-0">
        <p className="truncate text-[15px] leading-6 font-medium text-ink">
          <bdi>{name || t.noName}</bdi>
        </p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs leading-5 text-ink-soft">
          {/* The number is the way to the order's page; the row itself opens the preview. */}
          <ViewLink
            to={to}
            aria-label={fmt(t.openOrder, { number: order.orderNumber })}
            className="shrink-0 rounded-sm tabular-nums hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <bdi dir="ltr">{order.orderNumber}</bdi>
          </ViewLink>
        </p>
      </div>

      <div className="flex min-w-0 flex-col items-start gap-0.5">
        {status}
        {since && <span className="text-xs leading-4 whitespace-nowrap text-ink-soft">{since}</span>}
      </div>

      {showPlace && (
        <div className="min-w-0 truncate text-sm text-ink-soft">
          <bdi>{item.location?.name || "—"}</bdi>
        </div>
      )}

      <div className="flex flex-col items-start gap-0.5">
        <span className="text-[15px] leading-6 font-medium whitespace-nowrap text-ink tabular-nums">
          <bdi>{money}</bdi>
        </span>
        <span className="text-xs leading-4 whitespace-nowrap text-ink-soft">{paid ? t.paid : t.payOnPickup}</span>
      </div>

      <div className="text-xs whitespace-nowrap text-ink-soft">{age}</div>

      <div className="flex items-center justify-end gap-2">
        {open && phone && <ContactActions phone={phone} name={name || undefined} variant="icon" />}
        {action}
      </div>
    </DeskRow>
  );
}
