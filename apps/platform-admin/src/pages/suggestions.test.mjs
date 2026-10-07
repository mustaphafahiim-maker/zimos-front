import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The console's Suggestions page: gated like the support pages (support.view
 * to see it, support.manage to answer), in the Support menu, and its
 * notification type known to the bell in both languages. This app's tests run
 * without a DOM, so they read the source.
 */
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Suggestions page", () => {
  it("is routed behind support.view and listed under Support", () => {
    assert.match(read("../App.tsx"), /<Route path="\/suggestions" element=\{gated\(P\.SUPPORT_VIEW, <SuggestionsPage \/>\)\} \/>/);
    assert.match(read("../lib/nav.ts"), /\{ label: "Suggestions", to: "\/suggestions", icon: Lightbulb, permission: P\.SUPPORT_VIEW \}/);
  });

  it("answers only with support.manage", () => {
    const page = read("./SuggestionsPage.tsx");
    assert.match(page, /const canManage = can\(P\.SUPPORT_MANAGE\);/);
    assert.match(read("../lib/permissions.ts"), /SUPPORT_MANAGE: "support\.manage"/);
  });

  it("knows the 'suggestion' notification type, in English and Arabic", () => {
    const api = read("../lib/notificationsApi.ts");
    assert.match(api, /\| "suggestion";/);
    assert.match(api, /"suggestion",\n\];/);
    const strings = read("../lib/notificationStrings.ts");
    assert.match(strings, /type_suggestion: "New suggestion"/);
    assert.match(strings, /type_suggestion: "اقتراح جديد"/);
  });
});
