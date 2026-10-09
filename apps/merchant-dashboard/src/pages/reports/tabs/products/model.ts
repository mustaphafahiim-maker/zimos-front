import type {
  ProfitPnl,
  ProfitRow,
  ReportsProductRow,
  StockForecast,
  StockForecastStatus,
  StockForecastVariant,
} from "@store-builder/api-client";
import { isPermissionError } from "@/lib/errors";

/**
 * The numbers of the «المنتجات» tab, worked out from what its four reads give:
 * the products report (the main one), the P&L per product, the stock forecast
 * and the sales report (for the two compared figures). Nothing here formats or
 * words anything; the thresholds of the tab's one sentence live here.
 */

/** The most products the report answers with: the API's own cap. */
export const PRODUCTS_LIMIT = 200;
/** A return rate is only read from a product with at least this many pieces ordered (the server's insight rule). */
export const MIN_UNITS = 5;
/** "Keeps coming back" starts here, in percent: 3 of every 10 (the server's `high_return_product` rule). */
export const HIGH_RETURN_RATE = 30;
/** A return rate reads as healthy up to here (the old products table's limit). */
export const GOOD_RETURN_RATE = 15;
/** A conversion rate is only read from a product viewed at least this many times (the server's `low_converting_product` rule). */
export const MIN_VIEWS = 30;
/** Below this share of delivered pieces with a known cost, a ranking by profit ranks the unknown (the home's rule). */
export const MIN_COST_COVERAGE = 80;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A P&L row's key is the product's id — or its NAME, when the product was deleted. Only an id is joined or linked. */
export function isProductId(key: string | null | undefined): key is string {
  return typeof key === "string" && UUID.test(key);
}

// ------------------------------------------------------------ side reads --

/**
 * One of the tab's side reads: on its way, there, not for this role (a 403, or
 * a call that was not made because the role is known not to hold the
 * permission), or failed. A side read never blanks the tab: "denied" leaves
 * its part out, "failed" leaves it out and says so with a retry.
 */
export type Side<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "denied" } | { state: "failed" };

/**
 * The error is read before the data: after a failed read for a new range the
 * loader may still hold the answer of the range before, and that must never be
 * shown under the new one.
 */
export function sideOf<T>(query: { data: T | null; loading: boolean; error: unknown }): Side<T> {
  if (query.loading) return { state: "loading" };
  if (query.error) return isPermissionError(query.error) ? { state: "denied" } : { state: "failed" };
  if (query.data === null || query.data === undefined) return { state: "denied" };
  return { state: "ok", data: query.data };
}

// ------------------------------------------------------------------ stock --

/** A product's stock, read from its variants in the forecast: the one that runs out first speaks for it. */
export interface ProductStock {
  /** The product's most urgent variant. */
  worst: StockForecastVariant;
  status: StockForecastStatus;
  /** Whole days until that variant runs out; 0 when it is out; null when it does not sell (no pace to tell from). */
  days: number | null;
  /** How many of the product's variants the forecast lists. */
  variants: number;
}

const STATUS_RANK: Record<StockForecastStatus, number> = { out: 0, reorder_now: 1, soon: 2, ok: 3, no_sales: 4 };

/** Out, to reorder now, or within a week of that: what «خلصت أو قرّبت تخلص» counts. */
export function isUrgentStock(status: StockForecastStatus): boolean {
  return status === "out" || status === "reorder_now" || status === "soon";
}

function moreUrgent(a: StockForecastVariant, b: StockForecastVariant): boolean {
  const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (rank !== 0) return rank < 0;
  return (a.daysLeft ?? Number.POSITIVE_INFINITY) < (b.daysLeft ?? Number.POSITIVE_INFINITY);
}

/** The forecast's variants as one entry per product. */
export function stockByProduct(forecast: StockForecast): Map<string, ProductStock> {
  const byProduct = new Map<string, ProductStock>();
  for (const variant of forecast.variants) {
    const known = byProduct.get(variant.productId);
    if (!known) {
      byProduct.set(variant.productId, { worst: variant, status: variant.status, days: null, variants: 1 });
      continue;
    }
    known.variants += 1;
    if (moreUrgent(variant, known.worst)) {
      known.worst = variant;
      known.status = variant.status;
    }
  }
  for (const stock of byProduct.values()) {
    stock.days = stock.status === "out" ? 0 : stock.worst.daysLeft;
  }
  return byProduct;
}

export interface StockSummary {
  /** The variants that are out or running low, most urgent first (the forecast's own order). */
  urgent: StockForecastVariant[];
  /** How many products those variants belong to. */
  products: number;
  /**
   * False when the store has more urgent variants than the read brought (it
   * stops at 1000 rows, most urgent first): the product count is then a floor.
   */
  complete: boolean;
}

export function summarizeStock(forecast: StockForecast): StockSummary {
  const urgent = forecast.variants.filter((variant) => isUrgentStock(variant.status));
  const counted = (forecast.counts.out ?? 0) + (forecast.counts.reorder_now ?? 0) + (forecast.counts.soon ?? 0);
  return {
    urgent,
    products: new Set(urgent.map((variant) => variant.productId)).size,
    complete: urgent.length >= counted,
  };
}

// ------------------------------------------------------------------- rows --

/** A row of the tab's table: the products report's row, with its profit and its stock joined on by product id. */
export interface ProductLine extends ReportsProductRow {
  /** Net profit of the product's finished orders (delivered or returned), from the P&L; null when it has none yet. */
  profit: number | null;
  stock: ProductStock | null;
}

/** Whether a P&L row has anything finished to judge: an order delivered or returned. */
export function hasFinished(row: ProfitRow): boolean {
  return row.orders.delivered + row.orders.returned > 0;
}

export function joinProducts(
  products: readonly ReportsProductRow[],
  pnl: ProfitPnl | null,
  stock: ReadonlyMap<string, ProductStock> | null
): ProductLine[] {
  const profitById = new Map<string, ProfitRow>();
  if (pnl) {
    for (const row of pnl.rows) {
      if (isProductId(row.key)) profitById.set(row.key.toLowerCase(), row);
    }
  }
  return products.map((product) => {
    const row = profitById.get(product.productId.toLowerCase());
    return {
      ...product,
      profit: row && hasFinished(row) ? row.actual.netProfit : null,
      stock: stock?.get(product.productId) ?? null,
    };
  });
}

export interface ListedTotals {
  units: number;
  sales: number;
  /**
   * The products' delivery rates as one figure: their average, each product
   * weighing as many pieces as it sold (the report gives a rate per product
   * and the pieces ordered, not the pieces shipped). Null when nothing shipped.
   */
  deliveryRate: number | null;
  /** How many products that average is made of. */
  ratedProducts: number;
}

export function listedTotals(products: readonly ReportsProductRow[]): ListedTotals {
  let units = 0;
  let sales = 0;
  let weight = 0;
  let weighted = 0;
  let ratedProducts = 0;
  for (const product of products) {
    units += product.units;
    sales += product.sales;
    if (product.deliveryRate !== null && product.deliveryRate !== undefined && product.units > 0) {
      weight += product.units;
      weighted += product.deliveryRate * product.units;
      ratedProducts += 1;
    }
  }
  return { units, sales, deliveryRate: weight > 0 ? weighted / weight : null, ratedProducts };
}

// ------------------------------------------------------------------ chart --

/** One bar of the ranked chart. `productId` is null for a product that was deleted (no page to open). */
export interface RankedBar {
  key: string;
  label: string | null;
  value: number;
  productId: string | null;
}

/** The P&L's products with something finished, the most profitable first. A loss is a bar too. */
export function profitBars(pnl: ProfitPnl): RankedBar[] {
  return pnl.rows
    .filter(hasFinished)
    .sort((a, b) => b.actual.netProfit - a.actual.netProfit)
    .map((row) => ({
      key: row.key || "__none",
      label: row.label || (isProductId(row.key) ? null : row.key) || null,
      value: row.actual.netProfit,
      productId: isProductId(row.key) ? row.key : null,
    }));
}

/** The listed products that sold, the best seller first. */
export function salesBars(products: readonly ReportsProductRow[]): RankedBar[] {
  return products
    .filter((product) => product.sales > 0)
    .sort((a, b) => b.sales - a.sales)
    .map((product) => ({ key: product.productId, label: product.name, value: product.sales, productId: product.productId }));
}

/** Whether the P&L can rank products by profit: something was delivered in the range. */
export function canRankByProfit(pnl: ProfitPnl): boolean {
  return pnl.totals.orders.delivered > 0 && pnl.rows.some(hasFinished);
}

// --------------------------------------------------------------- flagged --

/**
 * The products that keep coming back: a return rate of HIGH_RETURN_RATE or
 * more with at least MIN_UNITS pieces ordered, the highest rate first — the
 * server's `high_return_product` insight, kept for every product it fits.
 */
export function highReturners<T extends ReportsProductRow>(products: readonly T[]): T[] {
  return products
    .filter((product) => product.units >= MIN_UNITS && product.returnRate !== null && product.returnRate >= HIGH_RETURN_RATE)
    .sort((a, b) => (b.returnRate ?? 0) - (a.returnRate ?? 0));
}

export interface WeakSellers<T> {
  products: T[];
  /** The conversion of the viewed products together, in percent; null when there are too few to compare. */
  average: number | null;
}

/**
 * Looked at a lot, bought little — the server's `low_converting_product`
 * insight: among the products viewed MIN_VIEWS times or more (two of them at
 * least), those whose conversion is under half of their joint conversion, the
 * most viewed first.
 */
export function weakSellers<T extends ReportsProductRow>(products: readonly T[]): WeakSellers<T> {
  const viewed = products.filter((product) => product.views >= MIN_VIEWS);
  if (viewed.length < 2) return { products: [], average: null };
  const views = viewed.reduce((sum, product) => sum + product.views, 0);
  const orders = viewed.reduce((sum, product) => sum + product.orders, 0);
  const average = views > 0 ? (orders / views) * 100 : null;
  if (average === null || average <= 0) return { products: [], average };
  return {
    products: viewed.filter((product) => (product.conversionRate ?? 0) * 2 < average).sort((a, b) => b.views - a.views),
    average,
  };
}

// ------------------------------------------------------------ the sentence --

export interface TakeawayFacts {
  /** Too little sold to say anything. */
  thin: boolean;
  earner: { name: string | null; productId: string | null; amount: number; by: "profit" | "sales" } | null;
  returner: ProductLine | null;
  weak: ProductLine | null;
  runningOut: { product: ProductLine; stock: ProductStock } | null;
}

/**
 * THE RULE OF THE TAB'S ONE SENTENCE — every figure is the tab's own.
 *
 * 0. Too thin: fewer than MIN_UNITS (5) pieces sold across the listed products.
 *    The sentence says that and nothing else.
 * 1. "The one that earns": the P&L's product with the highest delivered net
 *    profit — only when the P&L can be read, something was delivered, the best
 *    profit is above zero and at least MIN_COST_COVERAGE (80%) of the delivered
 *    pieces have a unit cost. Otherwise the best seller: the listed product
 *    with the highest sales.
 * 2. "The one that keeps coming back": the listed product with the highest
 *    return rate among those at HIGH_RETURN_RATE (30%) or more with at least
 *    MIN_UNITS (5) pieces ordered. When there is none: the most viewed product
 *    that is looked at and not bought (`weakSellers`: viewed 30 times or more,
 *    conversion under half the viewed products' own).
 * 3. "The one about to run out": a listed product that sold in the range and
 *    whose most urgent variant is out or must be reordered now, that variant
 *    having sold in the forecast's window; among several, the best seller.
 *
 * The clauses that exist are said in that order, as one sentence.
 */
export function takeawayFacts(lines: readonly ProductLine[], pnl: ProfitPnl | null): TakeawayFacts {
  const units = lines.reduce((sum, line) => sum + line.units, 0);
  if (units < MIN_UNITS) return { thin: true, earner: null, returner: null, weak: null, runningOut: null };

  let earner: TakeawayFacts["earner"] = null;
  if (pnl && canRankByProfit(pnl) && pnl.costCoverage !== null && pnl.costCoverage >= MIN_COST_COVERAGE) {
    const best = profitBars(pnl)[0];
    if (best && best.value > 0) earner = { name: best.label, productId: best.productId, amount: best.value, by: "profit" };
  }
  if (!earner) {
    const best = salesBars(lines)[0];
    if (best) earner = { name: best.label, productId: best.productId, amount: best.value, by: "sales" };
  }

  const returner = highReturners(lines)[0] ?? null;
  const weak = returner ? null : (weakSellers(lines).products[0] ?? null);

  const lowStock = lines
    .filter(
      (line) =>
        line.units > 0 &&
        line.stock !== null &&
        (line.stock.status === "out" || line.stock.status === "reorder_now") &&
        line.stock.worst.soldInWindow > 0
    )
    .sort((a, b) => b.sales - a.sales)[0];
  const runningOut = lowStock && lowStock.stock ? { product: lowStock, stock: lowStock.stock } : null;

  return { thin: false, earner, returner, weak, runningOut };
}

/**
 * A rate as "N of every 10" for a sentence — or "N of every 100" under one in
 * ten, where tenths would all read as zero or one. `less` marks a rate under
 * one in a hundred, said as "fewer than 1 of every 100".
 */
export function outOf(percent: number): { n: number; of: number; less: boolean } {
  if (percent >= 10) return { n: Math.min(10, Math.max(1, Math.round(percent / 10))), of: 10, less: false };
  if (percent < 1) return { n: 1, of: 100, less: true };
  return { n: Math.round(percent), of: 100, less: false };
}
