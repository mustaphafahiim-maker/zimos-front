import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatMinorMoney,
  formatMinorMoneyCompact,
  formatMinorMoneyExact,
  minorUnitDigits,
  toMajorAmount,
  toMinorAmount,
} from "./format.ts";

/**
 * Every money figure the /admin API sends is in minor units (plans'
 * monthlyPrice, a subscription's mrr, the overview's mrr, charges). These are
 * the only places the console divides by the minor unit.
 */
describe("minor units → what the console shows", () => {
  it("shows a 799 plan as 799, in the plan's own currency", () => {
    assert.equal(formatMinorMoney(79900, "USD"), "$799");
    assert.equal(formatMinorMoney(79900, "EGP"), "EGP 799");
    assert.equal(formatMinorMoneyExact(79900, "USD"), "$799.00");
  });

  it("shows a yearly plan's monthly run rate (799000 / 12, rounded by the API)", () => {
    assert.equal(formatMinorMoney(66583, "USD"), "$666");
    assert.equal(formatMinorMoneyExact(66583, "USD"), "$665.83");
  });

  it("keeps compact totals in whole units", () => {
    assert.equal(formatMinorMoneyCompact(12_345_600, "EGP"), "EGP 123.5K");
  });

  it("respects currencies whose minor unit is not a hundredth", () => {
    assert.equal(minorUnitDigits("JPY"), 0);
    assert.equal(formatMinorMoney(799, "JPY"), "¥799");
    assert.equal(minorUnitDigits("KWD"), 3);
    assert.equal(toMajorAmount(1500, "KWD"), 1.5);
  });
});

describe("what a person types → minor units", () => {
  it("round-trips a plan price", () => {
    assert.equal(toMinorAmount(799, "USD"), 79900);
    assert.equal(toMajorAmount(79900, "USD"), 799);
    assert.equal(toMinorAmount(toMajorAmount(29900, "EGP"), "EGP"), 29900);
  });

  it("rounds to the currency's own unit instead of sending a fraction", () => {
    assert.equal(toMinorAmount(0.1 + 0.2, "USD"), 30);
    assert.equal(toMinorAmount(19.999, "USD"), 2000);
    assert.equal(toMinorAmount(799, "JPY"), 799);
  });
});
