import { describe, expect, it } from "vitest";
import type { ProductEconomics } from "@/mock/types2";
import { computeBreakEven, computeMetrics, verdictFor, type AdEntityStats } from "./adMetrics";

const base: AdEntityStats = {
  spendAmount: 100_000,
  impressions: 50_000,
  clicks: 1_000,
  orders: 50,
  confirmedOrders: 40,
  deliveredOrders: 25,
  revenueAmount: 500_000,
  costOfDeliveredAmount: 200_000,
};

describe("computeMetrics", () => {
  it("computes cost-per metrics, ROAS and net profit", () => {
    const m = computeMetrics(base);
    expect(m.cpm).toBe(2_000);
    expect(m.ctr).toBeCloseTo(0.02);
    expect(m.cpc).toBe(100);
    expect(m.cpo).toBe(2_000);
    expect(m.cpco).toBe(2_500);
    expect(m.cpd).toBe(4_000);
    expect(m.roas).toBe(5);
    expect(m.netProfit).toBe(200_000);
    expect(m.margin).toBeCloseTo(0.4);
    expect(m.confirmationRate).toBeCloseTo(0.8);
    expect(m.deliveryRate).toBeCloseTo(0.625);
    // returned defaults to confirmed − delivered
    expect(m.rtoRate).toBeCloseTo(15 / 40);
  });

  it("treats unknown cost of delivered as 0", () => {
    const { costOfDeliveredAmount: _c, ...rest } = base;
    expect(computeMetrics(rest).netProfit).toBe(400_000);
  });

  it("is safe with zero denominators", () => {
    const m = computeMetrics({
      spendAmount: 0,
      impressions: 0,
      clicks: 0,
      orders: 0,
      confirmedOrders: 0,
      deliveredOrders: 0,
      revenueAmount: 0,
    });
    for (const k of ["cpm", "ctr", "cpc", "cr", "cpo", "cpco", "cpd", "confirmationRate", "deliveryRate", "rtoRate", "roas", "margin"] as const) {
      expect(m[k]).toBeNull();
    }
    expect(m.landingViewRate).toBeNull();
    expect(m.netProfit).toBe(0);
  });
});

const econ: ProductEconomics = {
  sellingPriceAmount: 50_000,
  cogsAmount: 15_000,
  shippingCostAmount: 5_000,
  carrierFeeAmount: 1_000,
  paymentFeeAmount: 500,
  packagingAmount: 500,
  returnCostAmount: 6_000,
  returnRateBp: 2_500,
} as ProductEconomics;

describe("computeBreakEven", () => {
  it("includes expected return cost by default", () => {
    const be = computeBreakEven(econ);
    // 50000 − 22000 − 6000×0.25
    expect(be.contribution).toBe(26_500);
    expect(be.cpd).toBe(26_500);
    expect(be.roas).toBeCloseTo(50_000 / 26_500);
  });

  it("can exclude RTO cost", () => {
    expect(computeBreakEven(econ, { includeReturnCost: false }).cpd).toBe(28_000);
  });

  it("subtracts target margin × price", () => {
    const be = computeBreakEven(econ, { targetMargin: 0.2 });
    expect(be.contribution).toBe(26_500);
    expect(be.cpd).toBe(16_500);
  });

  it("clamps to 0 and returns null ROAS when unprofitable", () => {
    const be = computeBreakEven(econ, { targetMargin: 0.9 });
    expect(be.cpd).toBe(0);
    expect(be.roas).toBeNull();
  });
});

describe("verdictFor", () => {
  it("scales below 80%", () => expect(verdictFor(79, 100)).toBe("scale"));
  it("holds at 80%..100%", () => {
    expect(verdictFor(80, 100)).toBe("hold");
    expect(verdictFor(100, 100)).toBe("hold");
  });
  it("kills above 100%", () => expect(verdictFor(101, 100)).toBe("kill"));
  it("returns null when break-even is missing or non-positive", () => {
    expect(verdictFor(50, null)).toBeNull();
    expect(verdictFor(null, 100)).toBeNull();
    expect(verdictFor(50, 0)).toBeNull();
  });
});
