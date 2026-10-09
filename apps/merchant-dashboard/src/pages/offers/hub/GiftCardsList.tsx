import type { GiftCard } from "@store-builder/api-client";
import { IconGiftCards } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { ListRowCard } from "@/components/list";
import { formatDate, formatMoney } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { GIFT_CARD_STRINGS, STATE_KEY, STATE_TONE, type GiftCardStrings } from "@/pages/giftCards/giftCardStrings";

interface ListProps {
  rows: readonly GiftCard[];
  /** Opens the card's own page. */
  onOpen: (card: GiftCard) => void;
}

const to = (card: GiftCard) => `/gift-cards/${card.id}`;

/** Who holds the card, or where it came from. */
const holder = (card: GiftCard, t: GiftCardStrings) =>
  card.recipientName || card.recipientEmail || (card.source === "order" ? t.sourceOrder : t.noRecipient);

/** The share of the card's value still on it, 0–100; 0 when the value is unknown. */
function leftPercent(card: GiftCard): number {
  const initial = Number(card.initialAmount);
  const balance = Number(card.balanceAmount);
  if (!Number.isFinite(initial) || !Number.isFinite(balance) || initial <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((balance / initial) * 100)));
}

/** A press on the row that was not meant for its link. */
function isRowPress(target: EventTarget, row: HTMLElement): boolean {
  if (!(target instanceof Element) || !row.contains(target)) return false;
  if (target.closest("a, button")) return false;
  return (window.getSelection()?.toString() ?? "") === "";
}

/**
 * The gift cards as one table on a sheet of glass, from md up: the card (its
 * last four characters, and who holds it), what is left on it out of its value
 * (with a thin bar), where it stands, until when it is good, when it was made.
 * A row opens the card's page — the card's name is a real link, so it also
 * opens in a new tab.
 */
export function GiftCardsTable({ rows, onOpen }: ListProps) {
  const t = useT(GIFT_CARD_STRINGS);
  const head = "px-3 py-3 text-start font-medium whitespace-nowrap";
  return (
    <div
      data-slot="offers-table"
      className="zimos-offers-table overflow-x-auto rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line"
    >
      <table className="w-full min-w-[40rem] text-sm [&>tbody>tr>td]:py-2">
        <caption className="sr-only">{t.title}</caption>
        <thead>
          <tr className="border-b border-line bg-paper-sunken/60 text-xs text-ink-soft">
            <th scope="col" className={`${head} ps-5`}>
              {t.colCard}
            </th>
            <th scope="col" className={head}>
              {t.colBalance}
            </th>
            <th scope="col" className={head}>
              {t.colState}
            </th>
            <th scope="col" className={head}>
              {t.colExpires}
            </th>
            <th scope="col" className={`${head} pe-5`}>
              {t.colCreated}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((card) => (
            <tr
              key={card.id}
              onClick={(e) => {
                if (!isRowPress(e.target, e.currentTarget)) return;
                // Ctrl / ⌘ + click is "in a new tab", as on a link.
                if (e.metaKey || e.ctrlKey) window.open(to(card), "_blank", "noopener");
                else onOpen(card);
              }}
              className="zimos-offers-row h-14 cursor-pointer border-b border-line last:border-b-0"
            >
              <td className="max-w-64 ps-5 pe-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="zimos-gift-chip flex h-7 w-11 shrink-0 items-center justify-center rounded-[0.5rem] bg-primary text-primary-foreground">
                    <IconGiftCards className="size-4" weight="fill" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <ViewLink
                      to={to(card)}
                      className="rounded-sm font-mono text-[15px] leading-6 font-semibold text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <bdi dir="ltr">{fmt(t.cardName, { last4: card.last4 })}</bdi>
                    </ViewLink>
                    <span className="truncate text-xs leading-5 text-ink-soft">
                      <bdi>{holder(card, t)}</bdi>
                    </span>
                  </span>
                </div>
              </td>
              <td className="px-3 whitespace-nowrap">
                <div className="tabular-nums">
                  <span className="text-[15px] font-semibold text-ink">
                    <bdi>{formatMoney(card.balanceAmount, card.currency)}</bdi>
                  </span>{" "}
                  <span className="text-xs text-ink-soft">
                    <bdi>{fmt(t.ofInitial, { initial: formatMoney(card.initialAmount, card.currency) })}</bdi>
                  </span>
                </div>
                {/* Decoration: the two figures above say the same thing in words. */}
                <div aria-hidden className="zimos-gift-meter mt-1 h-1 w-24 overflow-hidden rounded-full bg-paper-sunken">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${leftPercent(card)}%` }} />
                </div>
              </td>
              <td className="px-3">
                <StatusBadge value={card.state} tone={STATE_TONE[card.state]} text={t[STATE_KEY[card.state]]} />
              </td>
              <td className="px-3 text-[13px] whitespace-nowrap text-ink-soft">{card.expiresAt ? formatDate(card.expiresAt) : t.noExpiry}</td>
              <td className="ps-3 pe-5 text-[13px] whitespace-nowrap text-ink-soft">{formatDate(card.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The same cards as rows on a phone: a small card in the store's colour, the
 * last four characters and what is left on the first line; the state chip and
 * who holds it (or until when it is good) on the second. A tap opens the
 * card's page, where every action on a card is.
 */
export function GiftCardCards({ rows, onOpen }: ListProps) {
  const t = useT(GIFT_CARD_STRINGS);
  return (
    <ul aria-label={t.title} className="flex flex-col gap-2.5">
      {rows.map((card) => (
        <li key={card.id}>
          <ListRowCard
            leading={
              <span className="zimos-gift-chip flex size-10 items-center justify-center bg-primary text-primary-foreground">
                <IconGiftCards className="size-5" weight="fill" aria-hidden />
              </span>
            }
            title={
              <bdi dir="ltr" className="font-mono">
                {fmt(t.cardName, { last4: card.last4 })}
              </bdi>
            }
            amount={<bdi>{formatMoney(card.balanceAmount, card.currency)}</bdi>}
            status={<StatusBadge value={card.state} tone={STATE_TONE[card.state]} text={t[STATE_KEY[card.state]]} />}
            meta={<bdi>{holder(card, t)}</bdi>}
            footer={
              <span className="text-xs leading-5 text-ink-soft tabular-nums">
                <bdi>{fmt(t.ofInitial, { initial: formatMoney(card.initialAmount, card.currency) })}</bdi>
                {" · "}
                {card.expiresAt ? fmt(t.validUntil, { date: formatDate(card.expiresAt) }) : t.noExpiry}
              </span>
            }
            onOpen={() => onOpen(card)}
          />
        </li>
      ))}
    </ul>
  );
}
