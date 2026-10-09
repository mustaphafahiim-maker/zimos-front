import type { ReactNode } from "react";
import type { ReportsCustomers } from "@store-builder/api-client";
import { useT } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { countOf } from "@/lib/plural";
import { formatRate } from "./helpers";
import { CUSTOMERS_TAB_STRINGS } from "./strings";

interface LifetimeRow {
  key: string;
  label: string;
  /** A quiet second line: how the figure is worked out. */
  caption?: string;
  value: ReactNode;
}

/** A bare figure beside Arabic words keeps its own order. */
const figure = (text: string) => <bdi dir="ltr">{text}</bdi>;

/**
 * «أرقام على عمر المتجر كله»: the customer numbers the API counts over every
 * order the store ever took (`ReportsCustomers.lifetime`) — they do not move
 * with the hub's range, and the note under the list says so. A plain list of
 * name and figure: how many customers, how many of them bought again, the
 * repeat rate, orders and money per customer, and how long the second order
 * takes.
 */
export function LifetimeNumbers({
  lifetime,
  money,
}: {
  lifetime: ReportsCustomers["lifetime"];
  /** Writes an amount in the report's currency. */
  money: (minor: number) => string;
}) {
  const t = useT(CUSTOMERS_TAB_STRINGS);
  const days = lifetime.averageDaysToSecondOrder;
  const anyone = lifetime.customers > 0;

  const rows: LifetimeRow[] = [
    { key: "customers", label: t.lifeCustomers, value: figure(formatCount(lifetime.customers)) },
    { key: "repeat", label: t.lifeRepeat, value: figure(formatCount(lifetime.repeatCustomers)) },
    { key: "repeatRate", label: t.lifeRepeatRate, caption: t.lifeRepeatRateHint, value: figure(formatRate(lifetime.repeatRate)) },
    {
      key: "orders",
      label: t.lifeOrders,
      caption: t.lifeOrdersHint,
      value: figure(anyone ? formatCount(lifetime.averageOrders) : "—"),
    },
    {
      key: "value",
      label: t.lifeValue,
      caption: t.lifeValueHint,
      value: figure(anyone ? money(lifetime.averageLifetimeValue) : "—"),
    },
    {
      key: "second",
      label: t.lifeSecond,
      caption: days === null ? undefined : t.lifeSecondHint,
      // A counted phrase («٢٤ يوم»), not a bare figure: it reads in the page's own direction.
      value: days === null ? t.lifeSecondNone : days < 1 ? t.lifeSecondSameDay : <bdi>{countOf("day", days)}</bdi>,
    },
  ];

  return (
    <div className="min-w-0">
      <dl>
        {rows.map((row) => (
          <div key={row.key} className="flex min-h-11 items-center justify-between gap-4 border-b border-line py-2 last:border-b-0">
            <dt className="min-w-0">
              <span className="block text-sm leading-5 text-ink">{row.label}</span>
              {row.caption && <span className="block text-xs leading-4 text-pretty text-ink-soft">{row.caption}</span>}
            </dt>
            <dd className="max-w-[60%] shrink-0 text-end text-[15px] leading-6 font-semibold text-pretty text-ink tabular-nums">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[13px] leading-5 text-pretty text-ink-soft">{t.lifetimeNote}</p>
    </div>
  );
}
