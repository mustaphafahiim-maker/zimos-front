import { Button } from "@store-builder/ui";
import type { QuoteSummary } from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { IconCancelled, IconCopy, IconOrders, IconPhone, IconQuotes, IconWhatsApp } from "@/components/icons";
import { ListRowCard } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatDate, formatDateTime } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useViewNavigate } from "@/lib/viewTransition";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { dialablePhone, orderTelHref } from "@/pages/home/today/OrderQuickLook";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskRow } from "@/pages/returns/rowkit/DeskList";
import { rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { FactChip } from "./kit/Facts";
import { QUOTE_STATUS_KEY, QUOTE_STATUS_TONE, QUOTE_STRINGS, isQuoteOpen } from "./quoteStrings";

/** The columns of the quotes sheet: who, where it stands, how much was asked for, until when, since when, how to reach them. */
export const QUOTE_COLUMNS = "grid-cols-[minmax(0,1.6fr)_max-content_max-content_max-content_max-content_max-content]";

export interface QuoteRowProps {
  quote: QuoteSummary;
  /** A card (narrow screens) or a line of the sheet. */
  compact: boolean;
  /** Its preview is open. */
  current: boolean;
  onPeek: () => void;
  /** Left out when this role cannot cancel, or the quote is already closed. */
  onCancel?: () => void;
}

/**
 * One quote request in the inbox: who asked, where the request stands and how
 * to reach them. A press anywhere opens Quick Look (Space too; Enter opens the
 * request, where the prices are set). Call and WhatsApp are on the row; the
 * rest — copying the numbers, the order it became, cancelling — is in the
 * row's menu (right-click, a long press, Shift+F10) and in Quick Look.
 */
export function QuoteRow({ quote, compact, current, onPeek, onCancel }: QuoteRowProps) {
  const t = useT(QUOTE_STRINGS);
  const navigate = useViewNavigate();
  const copy = useCopy();

  const to = `/quotes/${quote.id}`;
  const name = quote.contact.fullName.trim();
  const company = quote.contact.company?.trim() || "";
  // A masked number is not one to dial or copy: every action on it needs the whole number.
  const phone = dialablePhone(quote.contact.phone);
  const whatsapp = phone ? toWhatsAppNumber(phone) : null;
  const who = [name, quote.number].filter(Boolean).join(" · ");
  const keys = rowKeyProps(onPeek, () => navigate(to));
  const expired = quote.status === "expired";
  const orderTo = quote.orderId ? `/orders/${quote.orderId}` : null;

  const menu: ContextMenuItem[] = [{ id: "open", label: t.menuOpen, icon: IconQuotes, onSelect: () => navigate(to) }];
  if (orderTo) menu.push({ id: "order", label: t.openOrder, icon: IconOrders, onSelect: () => navigate(orderTo) });
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
  menu.push({ id: "copy-number", label: t.menuCopyNumber, icon: IconCopy, separatorBefore: !phone, onSelect: () => copy(quote.number, t.copiedNumber) });
  if (onCancel && isQuoteOpen(quote.status)) {
    menu.push({ id: "cancel", label: t.cancelQuote, icon: IconCancelled, destructive: true, separatorBefore: true, onSelect: onCancel });
  }

  const status = <StatusBadge value={quote.status} tone={QUOTE_STATUS_TONE[quote.status]} text={t[QUOTE_STATUS_KEY[quote.status]]} />;
  const received = (
    <time dateTime={quote.createdAt} title={formatDateTime(quote.createdAt)}>
      {formatRelativeTime(quote.createdAt)}
    </time>
  );
  const products = countOf("item", quote.lineCount);
  const orderLink = orderTo ? (
    <Button asChild variant="outline" className="h-11 rounded-full px-3.5 text-[13px] pointer-fine:h-9">
      <ViewLink to={orderTo}>{t.openOrder}</ViewLink>
    </Button>
  ) : null;

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={t.menuLabel}>
          <ListRowCard
            title={<bdi data-vt-part="title">{name}</bdi>}
            amount={<bdi dir="ltr">{quote.number}</bdi>}
            status={<span data-vt-part="status">{status}</span>}
            meta={
              <>
                {products} · {received}
              </>
            }
            action={phone ? <ContactActions phone={phone} name={name || undefined} variant="icon" /> : undefined}
            footer={
              company || quote.validUntil || orderTo ? (
                <>
                  {company && (
                    <FactChip>
                      <bdi>{company}</bdi>
                    </FactChip>
                  )}
                  {quote.validUntil && (
                    <FactChip tone={expired ? "attention" : undefined}>
                      {fmt(expired ? t.expiredOn : t.validUntilDate, { date: formatDate(quote.validUntil) })}
                    </FactChip>
                  )}
                  {orderTo && (
                    <ViewLink
                      to={orderTo}
                      className="inline-flex min-h-11 items-center rounded-full px-2 text-[13px] font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      {t.openOrder}
                    </ViewLink>
                  )}
                </>
              ) : undefined
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
    <DeskRow onOpen={onPeek} openLabel={fmt(t.peek, { who })} keyProps={keys} current={current} menu={menu} menuLabel={t.menuLabel}>
      <div className="min-w-0">
        <p className="truncate text-[15px] leading-6 font-medium text-ink">
          <bdi data-vt-part="title">{name}</bdi>
        </p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs leading-5 text-ink-soft">
          {/* The number is the way to the request's page; the row itself opens the preview. */}
          <ViewLink
            to={to}
            className="shrink-0 rounded-sm tabular-nums hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <bdi dir="ltr">{quote.number}</bdi>
          </ViewLink>
          {company && (
            <>
              <span aria-hidden>·</span>
              <bdi className="min-w-0 truncate">{company}</bdi>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center" data-vt-part="status">
        {status}
      </div>

      <div className="text-sm whitespace-nowrap text-ink-soft tabular-nums">{products}</div>

      <div className="text-sm whitespace-nowrap text-ink-soft">{quote.validUntil ? formatDate(quote.validUntil) : "—"}</div>

      <div className="text-xs whitespace-nowrap text-ink-soft">{received}</div>

      <div className="flex items-center justify-end gap-2">
        {orderLink}
        {phone && <ContactActions phone={phone} name={name || undefined} variant="icon" />}
      </div>
    </DeskRow>
  );
}
