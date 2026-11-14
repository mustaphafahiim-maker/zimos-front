import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GOVERNORATE_CODES,
  STORE_TRAFFIC_STRINGS,
  clickIdLine,
  formatDwell,
  formatRatePct,
  governorateName,
  utmLine,
} from "./storeTrafficStrings.ts";

describe("Store traffic strings", () => {
  it("Arabic says everything English says", () => {
    assert.deepEqual(Object.keys(STORE_TRAFFIC_STRINGS.ar).sort(), Object.keys(STORE_TRAFFIC_STRINGS.en).sort());
    for (const [key, value] of Object.entries(STORE_TRAFFIC_STRINGS.ar)) assert.ok(value.trim(), `ar.${key} is empty`);
  });

  it("names the 27 governorates of the API, in both languages", () => {
    assert.equal(GOVERNORATE_CODES.length, 27);
    assert.equal(governorateName("cairo", "ar"), "القاهرة");
    assert.equal(governorateName("kafr-el-sheikh", "en"), "Kafr El Sheikh");
    assert.equal(governorateName(null, "en"), "—");
    assert.equal(governorateName("atlantis", "en", "?"), "?");
  });

  it("time on page: seconds, minutes, hours; nothing reported is a dash", () => {
    assert.equal(formatDwell(42_400, "en"), "42s");
    assert.equal(formatDwell(75_000, "en"), "1m 15s");
    assert.equal(formatDwell(75_000, "ar"), "1د 15ث");
    assert.equal(formatDwell(2 * 3600_000 + 5 * 60_000, "en"), "2h 5m");
    assert.equal(formatDwell(null, "en"), "—");
  });

  it("a visit's UTM values and click ids on one line, or nothing", () => {
    assert.equal(utmLine({ source: "facebook", medium: "cpc", campaign: "eid", utmContent: null, utmTerm: null }), "facebook / cpc / eid");
    assert.equal(utmLine({ source: null, medium: null, campaign: null, utmContent: null, utmTerm: null }), null);
    assert.equal(clickIdLine({ gclid: true, fbclid: true, ttclid: false }), "fbclid, gclid");
    assert.equal(clickIdLine({ gclid: false, fbclid: false, ttclid: false }), null);
  });

  it("a rate with nothing to divide by is a dash, never 0%", () => {
    assert.equal(formatRatePct(null), "—");
    assert.equal(formatRatePct(0), "0%");
    assert.equal(formatRatePct(54.5), "54.5%");
  });
});
