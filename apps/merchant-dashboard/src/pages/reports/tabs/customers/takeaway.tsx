import type { ReactNode } from "react";
import type { ReportsCustomers } from "@store-builder/api-client";
import type { ReportTakeawayAction, ReportTone } from "@/components/report";
import { fmt } from "@/i18n/LocaleContext";
import { countOf, pluralOf } from "@/lib/plural";
import { fill } from "./helpers";
import type { CustomersTabStrings } from "./strings";

/*
 * THE SENTENCE of the customers tab — "how many buy again, and how long until the second order".
 * Computed from the tab's own report (`reportsGetCustomers`), no second request. It says the same
 * thing as the server's `returning_share` insight (the share of the period's buyers who had bought
 * before, and the sales they brought), with the same minimum sample, and adds what to do about it.
 *
 * The rule, in order:
 *
 * 1. THE PERIOD SPEAKS when at least MIN_WINDOW_BUYERS (10) customers bought in it
 *    (`window.newCustomers + window.returningCustomers`; the server's own threshold for
 *    `returning_share`) and `window.returningCustomerRate` is a number:
 *    a. nobody came back (`returningCustomers` = 0) → WARN: «كل اللي اشتروا … عملاء جداد»,
 *       then "send an offer to those who bought before";
 *    b. otherwise «{x من كل ١٠} من اللي اشتروا … رجعوا تاني، وجابوا {returningSales}», with the
 *       tone by the rate: >= GOOD_RATE (30%) GOOD · < LOW_RATE (10%) WARN · between them INFO.
 *       A low rate ends with the offer advice; any other ends with the second-order clause.
 * 2. ELSE THE STORE'S LIFE SPEAKS when at least MIN_LIFETIME_CUSTOMERS (20) customers ever bought
 *    and `lifetime.repeatRate` is a number: «قليلين اللي اشتروا في الفترة دي، بس على عمر المتجر
 *    {x من كل ١٠} … اشتروا أكتر من مرة» — always INFO: the period itself is too thin to call
 *    good or bad.
 * 3. ELSE the data is too thin to say anything, and the sentence says that (INFO, no action).
 *
 * The second-order clause («بيطلب تاني بعد {n} يوم») is added only when
 * `lifetime.averageDaysToSecondOrder` is a whole day or more AND at least MIN_REPEATERS (5)
 * customers ever ordered twice — the average of fewer is one customer's habit, not the store's.
 *
 * A rate is said as «x من كل ١٠» (rounded to the nearest whole; under one in ten is said as
 * "fewer than one in ten"). The table and the cards keep the exact percentage.
 */
const MIN_WINDOW_BUYERS = 10;
const MIN_LIFETIME_CUSTOMERS = 20;
const MIN_REPEATERS = 5;
const GOOD_RATE = 30;
const LOW_RATE = 10;

export interface CustomersTakeaway {
  tone: ReportTone;
  sentence: ReactNode;
  action?: ReportTakeawayAction;
}

/** A percentage as «٣ من كل ١٠» / "3 in 10". */
function outOfTen(percent: number, t: CustomersTabStrings): string {
  const n = Math.min(10, Math.round(percent / 10));
  return fmt(n < 1 ? t.ofTenLess : pluralOf(t, "ofTen", n), { ten: 10 });
}

export function customersTakeaway(
  data: ReportsCustomers,
  t: CustomersTabStrings,
  /** Writes an amount in the report's currency. */
  money: (minor: number) => string
): CustomersTakeaway {
  const { window: period, lifetime } = data;
  const buyers = period.newCustomers + period.returningCustomers;
  const loyalty: ReportTakeawayAction = { label: t.actLoyalty, to: "/loyalty" };
  const groups: ReportTakeawayAction = { label: t.actGroups, to: "/customers?tab=groups" };

  const days = lifetime.averageDaysToSecondOrder ?? 0;
  const knowsDays = days >= 1 && lifetime.repeatCustomers >= MIN_REPEATERS;
  const daysText = knowsDays ? countOf("day", days) : "";
  // How the sentence ends: what to do when few come back, or when to reach the ones who do.
  const ending = (low: boolean) =>
    low
      ? knowsDays
        ? fmt(t.thenOfferDays, { days: daysText })
        : t.thenOffer
      : knowsDays
        ? fmt(t.thenDays, { days: daysText })
        : t.thenStop;

  // 1. The period has enough buyers to speak for itself.
  if (buyers >= MIN_WINDOW_BUYERS && period.returningCustomerRate !== null) {
    if (period.returningCustomers === 0) {
      return {
        tone: "warn",
        sentence: (
          <>
            {fmt(t.sayNoneReturned, { buyers: pluralOf(t, "customersCount", buyers) })}
            {ending(true)}
          </>
        ),
        action: loyalty,
      };
    }
    const rate = period.returningCustomerRate;
    const low = rate < LOW_RATE;
    return {
      tone: rate >= GOOD_RATE ? "good" : low ? "warn" : "info",
      sentence: (
        <>
          {fill(t.sayReturning, {
            share: outOfTen(rate, t),
            sales: <bdi dir="ltr">{money(period.returningSales)}</bdi>,
          })}
          {ending(low)}
        </>
      ),
      action: low ? loyalty : groups,
    };
  }

  // 2. Too few bought in the period, but the store's whole life has something to say.
  if (lifetime.customers >= MIN_LIFETIME_CUSTOMERS && lifetime.repeatRate !== null) {
    const low = lifetime.repeatRate < LOW_RATE;
    return {
      tone: "info",
      sentence: (
        <>
          {fmt(t.sayLifetime, { share: outOfTen(lifetime.repeatRate, t) })}
          {ending(low)}
        </>
      ),
      action: low ? loyalty : groups,
    };
  }

  // 3. Not enough customers to say anything.
  return {
    tone: "info",
    sentence: fmt(t.sayThin, { min: pluralOf(t, "customersCount", MIN_WINDOW_BUYERS) }),
  };
}
