/**
 * Media-buyer metrics for COD e-commerce. One place to compute CPM / CTR /
 * CPO / CPCO / CPD / ROAS / net profit and the break-even verdict so the ads
 * table, campaign detail, analytics tabs and P&L all agree.
 *
 * All money is in integer minor units (piastres). Rates are fractions (0–1).
 */
import type { AdCreative, Campaign, ProductEconomics } from "@/mock/types2";

/** The subset of fields every ad entity (campaign, ad set, creative) shares. */
export interface AdEntityStats {
  spendAmount: number;
  impressions: number;
  clicks: number;
  orders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  revenueAmount: number;
  /** Only campaigns carry these; optional everywhere else. */
  landingViews?: number;
  addToCarts?: number;
  checkouts?: number;
  returnedOrders?: number;
  costOfDeliveredAmount?: number;
}

export interface AdMetrics {
  /** Cost per 1,000 impressions, minor units. */
  cpm: number | null;
  ctr: number | null;
  cpc: number | null;
  landingViewRate: number | null;
  atcRate: number | null;
  checkoutRate: number | null;
  /** Orders ÷ clicks. */
  cr: number | null;
  cpo: number | null;
  cpco: number | null;
  cpd: number | null;
  confirmationRate: number | null;
  deliveryRate: number | null;
  /** Returned ÷ confirmed. */
  rtoRate: number | null;
  /** Delivered revenue ÷ spend. */
  roas: number | null;
  netProfit: number;
  /** Net profit ÷ delivered revenue. */
  margin: number | null;
}

export type Verdict = "scale" | "hold" | "kill";

export interface BreakEven {
  /** Max cost per delivered order that still breaks even. */
  cpd: number;
  /** sellingPrice ÷ breakEvenCpd. */
  roas: number | null;
  /** Contribution per delivered order before ad spend (same as cpd). */
  contribution: number;
}

function ratio(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

export function computeMetrics(e: AdEntityStats): AdMetrics {
  const returned = e.returnedOrders ?? Math.max(e.confirmedOrders - e.deliveredOrders, 0);
  // When cost-of-delivered is unknown (ad sets, creatives) estimate it as 0 so the
  // caller can decide; campaigns always carry the real number.
  const cost = e.costOfDeliveredAmount ?? 0;
  const netProfit = e.revenueAmount - e.spendAmount - cost;
  return {
    cpm: e.impressions > 0 ? (e.spendAmount / e.impressions) * 1000 : null,
    ctr: ratio(e.clicks, e.impressions),
    cpc: ratio(e.spendAmount, e.clicks),
    landingViewRate: e.landingViews === undefined ? null : ratio(e.landingViews, e.clicks),
    atcRate: e.addToCarts === undefined ? null : ratio(e.addToCarts, e.landingViews ?? e.clicks),
    checkoutRate: e.checkouts === undefined ? null : ratio(e.checkouts, e.addToCarts ?? e.clicks),
    cr: ratio(e.orders, e.clicks),
    cpo: ratio(e.spendAmount, e.orders),
    cpco: ratio(e.spendAmount, e.confirmedOrders),
    cpd: ratio(e.spendAmount, e.deliveredOrders),
    confirmationRate: ratio(e.confirmedOrders, e.orders),
    deliveryRate: ratio(e.deliveredOrders, e.confirmedOrders),
    rtoRate: ratio(returned, e.confirmedOrders),
    roas: ratio(e.revenueAmount, e.spendAmount),
    netProfit,
    margin: ratio(netProfit, e.revenueAmount),
  };
}

/**
 * Net profit for an ad set / creative, estimated with the per-unit cost of the
 * parent campaign so nested rows are comparable with the campaign row.
 */
export function withEstimatedCost<T extends AdEntityStats>(entity: T, campaign: Campaign): T & { costOfDeliveredAmount: number } {
  const perDelivered = campaign.deliveredOrders > 0 ? campaign.costOfDeliveredAmount / campaign.deliveredOrders : 0;
  return { ...entity, costOfDeliveredAmount: Math.round(perDelivered * entity.deliveredOrders) };
}

/** Sum ad set / creative stats into one AdEntityStats. */
export function sumStats(items: AdEntityStats[]): AdEntityStats {
  return items.reduce<AdEntityStats>(
    (acc, x) => ({
      spendAmount: acc.spendAmount + x.spendAmount,
      impressions: acc.impressions + x.impressions,
      clicks: acc.clicks + x.clicks,
      orders: acc.orders + x.orders,
      confirmedOrders: acc.confirmedOrders + x.confirmedOrders,
      deliveredOrders: acc.deliveredOrders + x.deliveredOrders,
      revenueAmount: acc.revenueAmount + x.revenueAmount,
      landingViews: (acc.landingViews ?? 0) + (x.landingViews ?? 0),
      addToCarts: (acc.addToCarts ?? 0) + (x.addToCarts ?? 0),
      checkouts: (acc.checkouts ?? 0) + (x.checkouts ?? 0),
      returnedOrders: (acc.returnedOrders ?? 0) + (x.returnedOrders ?? 0),
      costOfDeliveredAmount: (acc.costOfDeliveredAmount ?? 0) + (x.costOfDeliveredAmount ?? 0),
    }),
    { spendAmount: 0, impressions: 0, clicks: 0, orders: 0, confirmedOrders: 0, deliveredOrders: 0, revenueAmount: 0, landingViews: 0, addToCarts: 0, checkouts: 0, returnedOrders: 0, costOfDeliveredAmount: 0 }
  );
}

/** Scale campaign totals to a shorter/longer range (mock data is 30d). */
export function scaleCampaign(c: Campaign, factor: number): Campaign {
  if (factor === 1) return c;
  const s = (n: number) => Math.round(n * factor);
  return {
    ...c,
    spendAmount: s(c.spendAmount),
    impressions: s(c.impressions),
    clicks: s(c.clicks),
    landingViews: s(c.landingViews),
    addToCarts: s(c.addToCarts),
    checkouts: s(c.checkouts),
    orders: s(c.orders),
    confirmedOrders: s(c.confirmedOrders),
    deliveredOrders: s(c.deliveredOrders),
    returnedOrders: s(c.returnedOrders),
    revenueAmount: s(c.revenueAmount),
    costOfDeliveredAmount: s(c.costOfDeliveredAmount),
  };
}

/**
 * Break-even CPD from product economics.
 * contribution = price − cogs − shipping − carrierFee − paymentFee − packaging
 *                − returnCost × RTO rate (expected return cost per delivered order)
 * With `targetMargin` (0–1) the max CPD is reduced by margin × price.
 */
export function computeBreakEven(econ: ProductEconomics, opts?: { targetMargin?: number; includeReturnCost?: boolean }): BreakEven {
  const includeReturn = opts?.includeReturnCost ?? true;
  const rto = econ.returnRateBp / 10000;
  const expectedReturn = includeReturn ? econ.returnCostAmount * rto : 0;
  const contribution =
    econ.sellingPriceAmount - econ.cogsAmount - econ.shippingCostAmount - econ.carrierFeeAmount - econ.paymentFeeAmount - econ.packagingAmount - expectedReturn;
  const cpd = Math.max(contribution - econ.sellingPriceAmount * (opts?.targetMargin ?? 0), 0);
  return { cpd, roas: cpd > 0 ? econ.sellingPriceAmount / cpd : null, contribution };
}

export function verdictFor(cpd: number | null, breakEvenCpd: number | null): Verdict | null {
  if (cpd === null || breakEvenCpd === null || breakEvenCpd <= 0) return null;
  const r = cpd / breakEvenCpd;
  if (r < 0.8) return "scale";
  if (r <= 1) return "hold";
  return "kill";
}

type LabelLocale = "en" | "ar";

const VERDICT_LABELS: Record<LabelLocale, Record<Verdict, string>> = {
  en: { scale: "Scale", hold: "Hold", kill: "Kill" },
  ar: { scale: "كبّر", hold: "استمر", kill: "أوقف" },
};

/** Localised verdict label. Defaults to English for callers without a locale. */
export function verdictLabel(v: Verdict, locale: LabelLocale = "en"): string {
  return VERDICT_LABELS[locale][v];
}

/** @deprecated English only — prefer `verdictLabel(v, locale)`. */
export const VERDICT_LABEL: Record<Verdict, string> = VERDICT_LABELS.en;
export const VERDICT_CLASS: Record<Verdict, string> = {
  scale: "bg-success-soft text-success border-success/30",
  hold: "bg-warning-soft text-warning border-warning/30",
  kill: "bg-danger-soft text-danger border-danger/30",
};

/** Platform names are brand names and stay in Latin script in every locale. */
export function platformLabel(p: Campaign["platform"], _locale: LabelLocale = "en"): string {
  return PLATFORM_LABEL[p];
}

export const PLATFORM_LABEL: Record<Campaign["platform"], string> = {
  facebook: "Facebook",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  google: "Google",
};

export const PLATFORM_CLASS: Record<Campaign["platform"], string> = {
  facebook: "bg-[#1877F2]/10 text-[#1877F2]",
  tiktok: "bg-ink/10 text-ink",
  snapchat: "bg-[#FFFC00]/40 text-ink",
  google: "bg-[#EA4335]/10 text-[#EA4335]",
};

// ------------------------------------------------------- formatting ---

export function fmtPct(v: number | null, digits = 1): string {
  return v === null ? "—" : `${(v * 100).toFixed(digits)}%`;
}

export function fmtX(v: number | null, digits = 2): string {
  return v === null ? "—" : `${v.toFixed(digits)}x`;
}

/** Best (lowest) and worst (highest) CPD among creatives; null when < 2 have a CPD. */
export function rankCreativesByCpd(creatives: AdCreative[]): { winnerId: string | null; loserId: string | null } {
  const ranked = creatives
    .map((c) => ({ id: c.id, cpd: computeMetrics(c).cpd }))
    .filter((c): c is { id: string; cpd: number } => c.cpd !== null)
    .sort((a, b) => a.cpd - b.cpd);
  if (ranked.length < 2) return { winnerId: null, loserId: null };
  return { winnerId: ranked[0].id, loserId: ranked[ranked.length - 1].id };
}
