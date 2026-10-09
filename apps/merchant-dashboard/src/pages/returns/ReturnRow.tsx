import type { ReactNode } from "react";
import { returnPhotosOf, returnSourceOf, type ReturnRequest } from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { IconCamera, IconCheck, IconClose, IconCopy, IconOrders, IconPackageOpen, IconPhone, IconWhatsApp } from "@/components/icons";
import { ListRowCard } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDateTime } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useViewNavigate } from "@/lib/viewTransition";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { dialablePhone, orderTelHref } from "@/pages/home/today/OrderQuickLook";
import { ReturnSourceBadge } from "./ReturnExtras";
import { ReturnExchangeBadge, ReturnPickupBadge } from "./ReturnHandling";
import type { ReturnAction } from "./ReturnQuickLook";
import { canModerate, canRestock, returnPieces, splitReason, useReturnLabels } from "./returnLabels";
import { useCopy } from "./rowkit/clipboard";
import { DeskRow } from "./rowkit/DeskList";
import { InlineBone, RowAction, rowKeyProps } from "./rowkit/RowBits";
import type { OrderEntry } from "./useReturnsData";

const STRINGS = {
  en: {
    peek: "Preview the return of {who}",
    peekPlain: "Preview this return",
    menuLabel: "Actions for this return",
    menuOpen: "Open the order",
    menuCall: "Call",
    menuWhatsapp: "WhatsApp",
    menuCopyPhone: "Copy the number",
    menuCopyOrder: "Copy the order number",
    copiedPhone: "The customer's number is copied",
    copiedOrder: "The order number is copied",
    openOrder: "Open order {number}",
    photos_one: "1 photo",
    photos_other: "{n} photos",
    restocked: "Back in stock",
  },
  ar: {
    peek: "معاينة مرتجع {who}",
    peekPlain: "معاينة المرتجع",
    menuLabel: "إجراءات المرتجع",
    menuOpen: "افتح الأوردر",
    menuCall: "اتصل",
    menuWhatsapp: "واتساب",
    menuCopyPhone: "انسخ الرقم",
    menuCopyOrder: "انسخ رقم الأوردر",
    copiedPhone: "رقم العميل اتنسخ",
    copiedOrder: "رقم الأوردر اتنسخ",
    openOrder: "افتح الأوردر {number}",
    photos_one: "صورة واحدة",
    photos_two: "صورتين",
    photos_few: "{n} صور",
    photos_other: "{n} صورة",
    restocked: "رجع المخزون",
  },
} satisfies Messages;

/** The columns of the returns sheet: who, why, where it stands, since when, what to do. */
export const RETURN_COLUMNS = "grid-cols-[minmax(0,1.25fr)_minmax(0,1.5fr)_max-content_max-content_max-content]";

/** A small quiet pill for a fact of the row: how many photos, how many pieces. */
function FactChip({ children }: { children: ReactNode }) {
  return (
    <span
      data-slot="return-fact"
      className="inline-flex items-center gap-1 rounded-full bg-paper-sunken px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-ink-soft"
    >
      {children}
    </span>
  );
}

export interface ReturnRowProps {
  ret: ReturnRequest;
  /** The order behind the return, as far as it has arrived. */
  entry: OrderEntry | undefined;
  /** A card (narrow screens) or a line of the sheet. */
  compact: boolean;
  /** The move on its way to the server for this return, if any. */
  busy: ReturnAction | null;
  /** Its preview is open. */
  current: boolean;
  onPeek: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRestock: () => void;
}

/**
 * One return in the queue: whose it is and on which order, why, where it
 * stands, and the ONE move its status allows — approve a requested return,
 * restock an approved one. A press anywhere else opens Quick Look (Space too;
 * Enter opens the order). Reject is in Quick Look and in the menu of the row
 * (right-click, a long press, Shift+F10), with the call, WhatsApp and copy
 * actions.
 *
 * The order number and the customer come from a request per order: until it
 * lands the two are bones of the same height, so the row does not move.
 */
export function ReturnRow({ ret, entry, compact, busy, current, onPeek, onApprove, onReject, onRestock }: ReturnRowProps) {
  const t = useT(STRINGS);
  const labels = useReturnLabels();
  const navigate = useViewNavigate();
  const copy = useCopy();

  const to = `/orders/${ret.orderId}`;
  const order = entry?.status === "ready" ? entry.order : null;
  const pending = !entry || entry.status === "loading";
  const name = order?.contactSnapshot?.fullName?.trim() || "";
  // A masked number (010****665) is not one to dial or copy: every action on it needs the whole number.
  const phone = dialablePhone(order?.contactSnapshot?.phone);
  const whatsapp = phone ? toWhatsAppNumber(phone) : null;
  const { code, detail } = splitReason(ret.reason);
  const reason = labels.reason(code);
  const photos = returnPhotosOf(ret).length;
  const fromCustomer = returnSourceOf(ret) === "shopper";
  const moderate = canModerate(ret);
  const restock = canRestock(ret);
  const who = [name, order?.orderNumber].filter(Boolean).join(" · ");
  const peekLabel = who ? fmt(t.peek, { who }) : t.peekPlain;
  const keys = rowKeyProps(onPeek, () => navigate(to));
  const acting = busy !== null;

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
  if (phone) {
    menu.push({ id: "copy-phone", label: t.menuCopyPhone, icon: IconCopy, separatorBefore: true, onSelect: () => copy(phone, t.copiedPhone) });
  }
  if (order) {
    menu.push({
      id: "copy-order",
      label: t.menuCopyOrder,
      icon: IconCopy,
      separatorBefore: !phone,
      onSelect: () => copy(order.orderNumber, t.copiedOrder),
    });
  }
  if (moderate) {
    menu.push({ id: "approve", label: labels.approve, icon: IconCheck, separatorBefore: true, disabled: acting, onSelect: onApprove });
    menu.push({ id: "reject", label: labels.reject, icon: IconClose, destructive: true, disabled: acting, onSelect: onReject });
  }
  if (restock) {
    menu.push({ id: "restock", label: labels.restock, icon: IconPackageOpen, separatorBefore: true, disabled: acting, onSelect: onRestock });
  }

  const action = moderate ? (
    <RowAction label={labels.approve} icon={IconCheck} busy={busy === "approve"} disabled={acting} onClick={onApprove} />
  ) : restock ? (
    // On a card the words alone: beside the status chip there is no room for a glyph too.
    <RowAction label={labels.restock} icon={compact ? undefined : IconPackageOpen} busy={busy === "restock"} disabled={acting} onClick={onRestock} />
  ) : null;

  const status = <StatusBadge value={ret.status} text={labels.status(ret.status)} />;
  const age = (
    <time dateTime={ret.createdAt} title={formatDateTime(ret.createdAt)}>
      {formatRelativeTime(ret.createdAt)}
    </time>
  );
  const facts = (
    <>
      {fromCustomer && <ReturnSourceBadge />}
      <ReturnExchangeBadge ret={ret} />
      <ReturnPickupBadge ret={ret} />
      {photos > 0 && (
        <FactChip>
          <IconCamera className="size-3.5 shrink-0" aria-hidden />
          {pluralOf(t, "photos", photos)}
        </FactChip>
      )}
      {ret.restockedAt && <FactChip>{t.restocked}</FactChip>}
    </>
  );
  const pieces = countOf("piece", returnPieces(ret));

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={t.menuLabel}>
          <ListRowCard
            title={order ? <bdi data-vt-part="title">{name || labels.noName}</bdi> : pending ? <InlineBone className="h-3.5 w-28" /> : labels.noOrder}
            amount={order ? <bdi dir="ltr">{order.orderNumber}</bdi> : pending ? <InlineBone className="h-3.5 w-14" /> : undefined}
            status={status}
            meta={reason}
            action={action}
            footer={
              <>
                {facts}
                <FactChip>{pieces}</FactChip>
                <span className="text-xs text-ink-soft">{age}</span>
              </>
            }
            onOpen={onPeek}
            openLabel={peekLabel}
            aria-haspopup="dialog"
            {...keys}
          />
        </ContextMenu>
      </li>
    );
  }

  return (
    <DeskRow onOpen={onPeek} openLabel={peekLabel} keyProps={keys} current={current} menu={menu} menuLabel={t.menuLabel}>
      <div className="min-w-0">
        <p className="truncate text-[15px] leading-6 font-medium text-ink">
          {order ? <bdi data-vt-part="title">{name || labels.noName}</bdi> : pending ? <InlineBone className="h-3.5 w-32" /> : labels.noOrder}
        </p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs leading-5 text-ink-soft">
          {/* The number is the way to the order's page; the row itself opens the preview. */}
          {order ? (
            <ViewLink
              to={to}
              aria-label={fmt(t.openOrder, { number: order.orderNumber })}
              className="shrink-0 rounded-sm tabular-nums hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <bdi dir="ltr">{order.orderNumber}</bdi>
            </ViewLink>
          ) : pending ? (
            <InlineBone className="w-14" />
          ) : null}
          {(order || pending) && <span aria-hidden>·</span>}
          <span className="shrink-0">{pieces}</span>
        </p>
      </div>

      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-2 text-sm leading-6 text-ink">
          <span className="min-w-0 truncate">{reason}</span>
          {facts}
        </p>
        {/* dir="auto": the words are the customer's (or the merchant's) own, in whatever language they were typed. */}
        {detail && (
          <p dir="auto" className="truncate text-xs leading-5 text-ink-soft">
            {detail}
          </p>
        )}
      </div>

      <div className="flex items-center">{status}</div>

      <div className="text-xs whitespace-nowrap text-ink-soft">{age}</div>

      <div className="flex items-center justify-end gap-2">
        {phone && <ContactActions phone={phone} name={name || undefined} variant="icon" />}
        {action}
      </div>
    </DeskRow>
  );
}
