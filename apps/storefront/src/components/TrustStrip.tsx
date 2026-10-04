import type { Locale } from "@/lib/i18n";
import { cardTitle, type StoreCard } from "@/lib/storePromises";
import { CashIcon, ReturnIcon, TruckIcon } from "./Icons";

const ICONS = { shipping_policy: TruckIcon, return_policy: ReturnIcon, cod_policy: CashIcon } as const;

/**
 * The store's reassurance row: its own shipping, returns and cash-on-delivery
 * cards (lib/storePromises.ts), the card's title over its first point. Nothing
 * the store did not write: without cards there is no row.
 */
export function TrustStrip({
  cards,
  locale,
  compact = false,
  inAside = false,
}: {
  cards: StoreCard[];
  locale: Locale;
  compact?: boolean;
  /** Rendered in a narrow side column (product page): never four across. */
  inAside?: boolean;
}) {
  if (cards.length === 0) return null;

  const columns = compact
    ? "grid-cols-3"
    : inAside
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-1"
      : cards.length >= 3
        ? "grid-cols-2 lg:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2";

  return (
    <ul className={`grid gap-3 ${columns}`}>
      {cards.map((card) => {
        const Icon = ICONS[card.key] ?? TruckIcon;
        return (
          <li
            key={card.key}
            className={`zt-card flex items-center gap-3 rounded-2xl border border-line bg-paper-raised ${
              compact ? "flex-col px-2 py-3 text-center" : "p-4"
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon />
            </span>
            <span className="min-w-0">
              <span className={`block font-semibold text-ink ${compact ? "text-xs" : "text-sm"}`}>{cardTitle(card, locale)}</span>
              {!compact && card.points[0] && <span className="mt-0.5 block text-xs text-ink-soft">{card.points[0]}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
