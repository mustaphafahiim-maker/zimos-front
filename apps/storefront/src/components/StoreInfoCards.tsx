import type { StorefrontStoreInfo } from "@store-builder/api-client";
import { CashIcon, ReturnIcon, TruckIcon } from "./Icons";
import { card } from "./ui";

const ICONS = { shipping_policy: TruckIcon, return_policy: ReturnIcon, cod_policy: CashIcon } as const;

/**
 * The merchant's own short policies (settings → store info) as trust cards:
 * shipping, returns and cash on delivery, each a title and a few points.
 * Shown beside the buy box in place of the generic trust row.
 */
export function StoreInfoCards({ info }: { info: StorefrontStoreInfo }) {
  if (info.cards.length === 0) return null;
  return (
    <ul className="grid gap-3">
      {info.cards.map((c) => {
        const Icon = ICONS[c.key] ?? TruckIcon;
        return (
          <li key={c.key} className={`${card} flex gap-3 p-4`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon size={20} />
            </span>
            <div className="min-w-0">
              {c.title && <p className="text-sm font-semibold text-ink">{c.title}</p>}
              {c.points.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-sm text-ink-soft">
                  {c.points.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
