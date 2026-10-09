import {
  profitGetEconomics,
  profitGetPnl,
  type AnalyticsSummary,
  type ProfitEconomicsProduct,
  type ProfitPnl,
  type ProfitStatement,
  type ReportsInsights,
  type ReportsKpi,
  type ReportsSales,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";

/*
 * The data of the «المبيعات والربح» tab and the rules that read it. Nothing
 * here draws anything: the loaders, the home's profit rules, and the rule
 * behind the tab's one sentence.
 */

/* ------------------------------------------------------------------ *
 * Net profit — the rules the home uses (pages/home/today/MoneyRow.tsx)
 * ------------------------------------------------------------------ */

/**
 * Below this share of delivered pieces with a known cost, a profit figure
 * would mislead: what is left is not called "profit" anywhere on the tab.
 */
export const MIN_COST_COVERAGE = 80;

export type ProfitVersion = "actual" | "projected";

export interface ProfitAnswer {
  /** The P&L of the range, one row per day. */
  pnl: ProfitPnl;
  /** Products with a variant that has no cost. Null: not needed (costs are complete) or it did not load. */
  missing: ProfitEconomicsProduct[] | null;
}

/**
 * The range's P&L by day (one call gives the totals, the per-day chart and the
 * per-day table), then — only when that profit may be missing a cost — the
 * products that have none. The P&L has no comparison window of its own.
 */
export async function loadProfit(workspaceId: string, from: string, to: string): Promise<ProfitAnswer> {
  const pnl = await profitGetPnl(apiClient, workspaceId, { from, to, groupBy: "day" });
  const { delivered, returned, open } = pnl.totals.orders;
  const complete = pnl.costCoverage !== null && pnl.costCoverage >= 100;
  if (complete || delivered + returned + open === 0) return { pnl, missing: null };
  try {
    const { products } = await profitGetEconomics(apiClient, workspaceId);
    return { pnl, missing: products.filter((product) => product.variantsWithoutCost > 0) };
  } catch {
    // The profit still shows; the warning then speaks from the coverage alone.
    return { pnl, missing: null };
  }
}

export interface ProfitReading {
  /**
   * none: nothing sold and nothing spent, so there is no profit to state.
   * floor: too many pieces without a cost — the figure is not called profit.
   * ok: a profit (or a loss) to show.
   */
  state: "none" | "floor" | "ok";
  /** The statement the tab shows: the projection while orders are still on the way, the actual one otherwise. */
  version: ProfitVersion;
  /** True when the figure is the projection — the «تقديري» note. */
  estimated: boolean;
  statement: ProfitStatement;
  loss: boolean;
  /** Some delivered pieces have no cost: the figure is understated costs, said beside it. */
  incomplete: boolean;
  /** How many products have a variant without a cost (0 when the list was not needed or did not load). */
  missing: number;
  /** Share of delivered pieces with a cost, as a percentage; null when nothing was delivered. */
  coverage: number | null;
}

/** The home's reading of a P&L: which statement, whether it may be called profit, whether costs are complete. */
export function readProfit(answer: ProfitAnswer): ProfitReading {
  const { pnl } = answer;
  const { totals } = pnl;
  const coverage = pnl.costCoverage;
  const orderCount = totals.orders.delivered + totals.orders.returned + totals.orders.open;
  // With orders still on the way the figure is the projection: the finished orders plus the open
  // ones at the store's delivery rate. With none, projection and actual are the same statement.
  const estimated = totals.orders.open > 0;
  const version: ProfitVersion = estimated ? "projected" : "actual";
  const statement = totals[version];
  const missing = answer.missing?.length ?? 0;
  // Nothing delivered yet, so no coverage to read — but sales with not one pound of product cost
  // in them, and products on file with no cost: that is the same as a coverage of zero.
  const nothingCosted = coverage === null && missing > 0 && statement.costOfGoods === 0 && statement.revenue > 0;
  const underFloor = (coverage !== null && coverage < MIN_COST_COVERAGE) || nothingCosted;
  const incomplete = coverage !== null ? coverage < 100 : missing > 0;
  const state: ProfitReading["state"] =
    orderCount === 0 && statement.netProfit === 0 ? "none" : underFloor ? "floor" : "ok";
  return { state, version, estimated, statement, loss: statement.netProfit < 0, incomplete, missing, coverage };
}

/** The five non-ad costs of a statement, as the old profit table added them up. */
export function statementCosts(statement: ProfitStatement): number {
  return statement.costOfGoods + statement.shipping + statement.returnShipping + statement.fees + statement.zimosFees;
}

/* ------------------------------------------------------------------ *
 * The old summary (cash collected, gross profit, orders by status)
 * ------------------------------------------------------------------ */

export interface SummaryPair {
  current: AnalyticsSummary;
  /** The comparison window of the sales report; null when there is none, or when that request failed. */
  previous: AnalyticsSummary | null;
}

/**
 * The store summary for the range and — when the sales report compares with a
 * window — the same summary for THAT window, so the change beside a figure
 * compares the same two periods as the rest of the tab. The summary API has no
 * comparison of its own; without a window no change is shown. The second call
 * may fail alone: the figures then stand without a chip.
 */
export async function loadSummary(
  workspaceId: string,
  from: string,
  to: string,
  previousRange: { from: string; to: string } | null
): Promise<SummaryPair> {
  const [current, previous] = await Promise.all([
    apiClient.getAnalyticsSummary(workspaceId, { from, to }),
    previousRange
      ? apiClient.getAnalyticsSummary(workspaceId, { from: previousRange.from, to: previousRange.to }).catch(() => null)
      : Promise.resolve(null),
  ]);
  return { current, previous };
}

/* ------------------------------------------------------------------ *
 * The one sentence
 * ------------------------------------------------------------------ */

/*
 * THE RULE (source: ReportsSales.kpis — value against `previous` under the
 * comparison the hub picked; reportsGetInsights adds the server's own verdict
 * on conversion and the peak time when it emits them):
 *
 * 1. No orders in the period                     → "nothing to say yet".
 * 2. Fewer than MIN_ORDERS (10) orders           → "too early to tell" — a
 *    handful of orders moves a percentage by tens of points.
 * 3. No comparison (the hub compares with nothing, the base period sold
 *    nothing, or it had fewer than MIN_BASE_ORDERS (5) orders)
 *                                                → what was sold, from how many
 *    orders, and why there is no direction to give.
 * 4. Sales moved less than FLAT_PERCENT (5%)     → "about steady".
 * 5. Otherwise sales are up (good) or down (bad) by that percentage, and the
 *    MAIN DRIVER is named:
 *    a. candidates are the order count and the average order value, each only
 *       if it moved the SAME way as sales by DRIVER_PERCENT (3%) or more; the
 *       bigger relative move wins (orders on a tie);
 *    b. when orders win, the reason behind them is looked for in the store's
 *       traffic: conversion (same way, ≥ 3% — or flagged by the server's
 *       `conversion_up` / `conversion_down` insight when the hub compares with
 *       the period before, the only window insights know) against visits
 *       (same way, ≥ 3%); the bigger move wins (conversion on a tie); neither
 *       → "orders themselves";
 *    c. no candidate → the sentence stops at the percentage.
 *    A fall names what to do: fewer visits → the ads report, weaker conversion
 *    → the store report, smaller orders → offers.
 * Cases 3 and 4 add the peak time when the server's `peak_time` insight exists.
 */
export const MIN_ORDERS = 10;
export const MIN_BASE_ORDERS = 5;
export const FLAT_PERCENT = 5;
export const DRIVER_PERCENT = 3;

export type SalesDriver = "orders" | "visits" | "conversion" | "basket";

export type SalesVerdict =
  | { kind: "empty" }
  | { kind: "thin"; orders: number }
  | { kind: "alone"; reason: "off" | "noBase" }
  | { kind: "flat" }
  | {
      kind: "moved";
      direction: "up" | "down";
      /** How far sales moved, as a signed percentage. */
      change: number;
      driver: SalesDriver | null;
      /** How far the driver itself moved, as a positive percentage (null for conversion, said as a share). */
      driverChange: number | null;
    };

/** Change of a KPI against its comparison value, as a signed percentage; null without a usable base. */
export function percentChange(kpi: ReportsKpi | undefined): number | null {
  if (!kpi || kpi.value === null || kpi.previous === null || kpi.previous === 0) return null;
  return ((kpi.value - kpi.previous) / Math.abs(kpi.previous)) * 100;
}

export function readSales(sales: ReportsSales, insights: ReportsInsights | null): SalesVerdict {
  const { kpis } = sales;
  const orders = kpis.orders.value ?? 0;
  if (orders <= 0) return { kind: "empty" };
  if (orders < MIN_ORDERS) return { kind: "thin", orders };
  if (sales.compare === "none") return { kind: "alone", reason: "off" };

  const change = percentChange(kpis.totalSales);
  if (change === null || (kpis.orders.previous ?? 0) < MIN_BASE_ORDERS) return { kind: "alone", reason: "noBase" };
  if (Math.abs(change) < FLAT_PERCENT) return { kind: "flat" };

  const direction = change > 0 ? "up" : "down";
  const sign = Math.sign(change);
  /** How far a KPI moved the same way as sales, as a positive percentage; 0 when it did not (enough). */
  const moved = (kpi: ReportsKpi): number => {
    const own = percentChange(kpi);
    return own !== null && Math.sign(own) === sign && Math.abs(own) >= DRIVER_PERCENT ? Math.abs(own) : 0;
  };

  const ordersMove = moved(kpis.orders);
  const basketMove = moved(kpis.averageOrderValue);
  if (ordersMove > 0 && ordersMove >= basketMove) {
    const flagged =
      sales.compare === "previous" &&
      Boolean(insights?.insights.some((insight) => insight.key === (sign > 0 ? "conversion_up" : "conversion_down")));
    const conversionMove = moved(kpis.conversionRate) || (flagged && kpis.conversionRate.value !== null ? DRIVER_PERCENT : 0);
    const visitsMove = moved(kpis.sessions);
    if (conversionMove > 0 && conversionMove >= visitsMove && kpis.conversionRate.value !== null) {
      return { kind: "moved", direction, change, driver: "conversion", driverChange: null };
    }
    if (visitsMove > 0) return { kind: "moved", direction, change, driver: "visits", driverChange: visitsMove };
    return { kind: "moved", direction, change, driver: "orders", driverChange: ordersMove };
  }
  if (basketMove > 0) return { kind: "moved", direction, change, driver: "basket", driverChange: basketMove };
  return { kind: "moved", direction, change, driver: null, driverChange: null };
}

/** The weekday (0 = Sunday) and hour orders peak at, from the server's `peak_time` insight. */
export function peakTime(insights: ReportsInsights | null): { dow: number; hour: number } | null {
  const insight = insights?.insights.find((entry) => entry.key === "peak_time");
  if (!insight) return null;
  const dow = Number(insight.params.dow);
  const hour = Number(insight.params.hour);
  if (!Number.isInteger(dow) || dow < 0 || dow > 6 || !Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  return { dow, hour };
}

/** The busiest cell of the order heatmap; null when it is empty. */
export function busiestSlot(cells: ReadonlyArray<{ dow: number; hour: number; orders: number }>): { dow: number; hour: number } | null {
  let best: { dow: number; hour: number; orders: number } | null = null;
  for (const cell of cells) if (cell.orders > 0 && (!best || cell.orders > best.orders)) best = cell;
  return best ? { dow: best.dow, hour: best.hour } : null;
}

/**
 * A share as the tab's sentences say it — «٥ من كل ١٠»: out of ten when the
 * percentage sits within a point of a round tenth, out of a hundred otherwise,
 * and out of a thousand under 1% (a conversion rate), so it never reads "0".
 */
export function outOf(percent: number): { n: number; of: number } {
  const share = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  if (share >= 10 && Math.abs(share - Math.round(share / 10) * 10) <= 1) return { n: Math.round(share / 10), of: 10 };
  if (share >= 1 || share === 0) return { n: Math.round(share), of: 100 };
  return { n: Math.max(1, Math.round(share * 10)), of: 1000 };
}
