import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catalogFromFeatureTable, featureLabelIn } from "./planFeatures.ts";

const CATALOG = [
  { key: "staff_accounts", type: "boolean", available: true, label: { en: "Staff accounts", ar: "حسابات الفريق" } },
  { key: "api_access", type: "boolean", available: false, label: { en: "API access", ar: "الوصول عبر API" } },
];

describe("plan feature names come from the API's catalogue", () => {
  it("names a key from the catalogue, and falls back to the key itself", () => {
    assert.equal(featureLabelIn(CATALOG, "api_access"), "API access");
    assert.equal(featureLabelIn(CATALOG, "teleport"), "teleport");
    assert.equal(featureLabelIn(undefined, "staff_accounts"), "staff_accounts");
  });

  it("reads the catalogue off a store's feature table, availability included", () => {
    const table = [
      { key: "staff_accounts", type: "boolean", available: true, label: CATALOG[0].label, inPlan: true, enabled: true, source: "plan", override: null, expiredOverride: null },
      { key: "api_access", type: "boolean", available: false, label: CATALOG[1].label, inPlan: false, enabled: false, source: "none", override: null, expiredOverride: null },
    ];
    assert.deepEqual(catalogFromFeatureTable(table), CATALOG);
  });

  it("treats a table from a server without the catalogue as available, named by key", () => {
    const old = [{ key: "funnels", type: "boolean", inPlan: true, enabled: true, source: "plan", override: null, expiredOverride: null }];
    assert.deepEqual(catalogFromFeatureTable(old), [{ key: "funnels", type: "boolean", available: true, label: { en: "funnels", ar: "funnels" } }]);
  });
});
