import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SITE_TRAFFIC_STRINGS, formatDuration } from "./siteTrafficStrings.ts";

describe("Site traffic strings", () => {
  it("Arabic says everything English says", () => {
    assert.deepEqual(Object.keys(SITE_TRAFFIC_STRINGS.ar).sort(), Object.keys(SITE_TRAFFIC_STRINGS.en).sort());
    for (const [key, value] of Object.entries(SITE_TRAFFIC_STRINGS.ar)) assert.ok(value.trim(), `ar.${key} is empty`);
  });

  it("names every reason the beacon's guard records, every device class and every step of a visit", () => {
    // backend siteAnalytics/siteEventsRoutes.js (bot classifier, refusals) and siteTrafficService.deviceClass.
    const keys = [
      ...["good_bot", "bad_bot", "rate_ip", "too_large", "invalid_json", "origin_mismatch", "invalid_body"].map((r) => `reason_${r}`),
      ...["mobile", "tablet", "desktop", "unknown"].map((d) => `device_${d}`),
      ...["view", "ping", "cta_register", "cta_login", "cta_click", "signup"].map((e) => `ev_${e}`),
      ...["visit", "signup_click", "signup"].map((s) => `step_${s}`),
      ...["today", "7d", "30d", "90d"].map((r) => `range_${r}`),
    ];
    for (const locale of ["en", "ar"]) {
      for (const key of keys) assert.ok(SITE_TRAFFIC_STRINGS[locale][key], `${locale}.${key} is missing`);
    }
  });

  it("time: seconds, minutes, hours, in both languages", () => {
    assert.equal(formatDuration(45, "en"), "45s");
    assert.equal(formatDuration(270, "en"), "4m 30s");
    assert.equal(formatDuration(270, "ar"), "4د 30ث");
    assert.equal(formatDuration(3 * 3600 + 120, "en"), "3h 2m");
  });
});
