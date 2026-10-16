// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ApiError } from "@store-builder/api-client";
import { limitLines, preorderFor, purchaseLimitMessage, stepperLimits, takesPreorders } from "./buyInfo";
import { fulfilmentCopy } from "./fulfilmentCopy";
import { holidaySentence, holidayView } from "./holidayText";
import { getDictionary } from "./i18n";
import { redirectTarget } from "./urlRedirects";

describe("a store on holiday, as the shopper is told", () => {
  it("is open as usual when the API names no holiday", () => {
    const view = holidayView(null, fulfilmentCopy("en"), "en");
    expect(view).toMatchObject({ holiday: null, paused: false, delayed: false, title: "", line: "", pausedLabel: null });
  });

  it("pauses the order buttons and says when ordering opens again", () => {
    const view = holidayView({ mode: "pause", until: "2026-10-11T08:00:00.000Z", shipsFrom: null, message: { en: "Eid break." } }, fulfilmentCopy("en"), "en");
    expect(view.paused).toBe(true);
    expect(view.pausedLabel).toBe("Orders are paused for now");
    expect(view.title).toBe("We're on holiday until October 11");
    expect(view.message).toBe("Eid break.");
    expect(view.detail).toContain("Ordering opens again on October 11");
    expect(holidaySentence(view)).toBe("We're on holiday until October 11 — Orders are paused for now");
  });

  it("takes orders and says when they ship, in Egyptian Arabic", () => {
    const view = holidayView({ mode: "delay", until: null, shipsFrom: "2026-10-11T08:00:00.000Z", message: null }, fulfilmentCopy("ar"), "ar");
    expect(view.delayed).toBe(true);
    expect(view.pausedLabel).toBeNull();
    expect(view.title).toBe("المتجر في إجازة");
    expect(view.line).toMatch(/^الطلبات هتتشحن من /);
  });

  it("falls back to the store's message in its other language", () => {
    const view = holidayView({ mode: "pause", until: null, shipsFrom: null, message: { ar: "راجعين قريب" } }, fulfilmentCopy("en"), "en");
    expect(view.message).toBe("راجعين قريب");
  });

  it("has every holiday sentence in French too", () => {
    const fr = fulfilmentCopy("fr");
    expect(Object.keys(fr).sort()).toEqual(Object.keys(fulfilmentCopy("en")).sort());
    expect(fr.ordersPaused).toBe("Les commandes sont suspendues pour le moment");
  });
});

describe("pre-orders and purchase limits on the product page", () => {
  const taking = { preorder: { shipsAt: "2026-11-15", message: null, limited: false } };

  it("sells a sold-out variant as a pre-order only when the product takes them", () => {
    expect(takesPreorders(taking)).toBe(true);
    expect(preorderFor(taking, { inStock: false })).toMatchObject({ shipsAt: "2026-11-15" });
    expect(preorderFor(taking, { inStock: true })).toBeNull();
    expect(preorderFor({ preorder: null }, { inStock: false })).toBeNull();
    expect(preorderFor(taking, undefined)).toBeNull();
  });

  it("bounds the quantity stepper and names the limits", () => {
    const product = { purchaseLimits: { min: 2, max: 5, maxPerCustomer: 10 } };
    expect(stepperLimits(product)).toEqual({ min: 2, max: 5 });
    expect(limitLines(product, getDictionary("en").buyInfo)).toEqual(["Min 2 per order", "Max 5 per order", "Max 10 per customer"]);
    expect(stepperLimits({ purchaseLimits: null })).toEqual({});
    expect(limitLines({}, getDictionary("en").buyInfo)).toEqual([]);
  });

  it("puts a refused order in the shopper's words, and is null for any other error", () => {
    const refused = new ApiError("Purchase limit", 422, "PURCHASE_LIMIT" as never, {
      error: { code: "PURCHASE_LIMIT", details: [{ field: "quantity", message: 'At most 3 of "Linen shirt" per order', productId: "p1", max: 3 }] },
    });
    expect(purchaseLimitMessage(refused, "en")).toBe("At most 3 of “Linen shirt” per order");
    expect(purchaseLimitMessage(refused, "ar")).toContain("بحد أقصى");
    expect(purchaseLimitMessage(new ApiError("Nope", 500, "INTERNAL_SERVER_ERROR", {}), "en")).toBeNull();
  });
});

describe("where a found redirect may send the shopper", () => {
  const to = (target: string, current = "/old") => redirectTarget({ to: target, statusCode: 301 }, "/store/ws1", current);

  it("keeps a store path inside the store", () => {
    expect(to("/new-page")).toBe("/store/ws1/new-page");
    expect(redirectTarget({ to: "/new-page", statusCode: 301 }, "", "/old")).toBe("/new-page");
  });

  it("never lets a path leave the store through a double slash", () => {
    expect(to("//evil.example/x")).toBe("/store/ws1/evil.example/x");
  });

  it("follows a full address only over https", () => {
    expect(to("https://example.com/sale")).toBe("https://example.com/sale");
    expect(to("http://example.com/sale")).toBeNull();
    expect(to("javascript:alert(1)")).toBeNull();
    expect(to("example.com/sale")).toBeNull();
  });

  it("does not send the shopper back to the address they are on", () => {
    expect(to("/old", "/old")).toBeNull();
  });
});
