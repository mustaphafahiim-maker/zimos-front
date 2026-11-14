// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getDictionary } from "./i18n";
import { STORE_WORDS, readAllStoreWords, readStoreWords, withStoreWords } from "./storeWords";

describe("storeWords: the store's own words on its shop pages", () => {
  it("names only words the dictionary has, in every language", () => {
    for (const locale of ["ar", "en"] as const) {
      const t = getDictionary(locale) as unknown as Record<string, Record<string, unknown>>;
      for (const path of STORE_WORDS) {
        const [group, key] = path.split(".");
        expect([locale, path, typeof t[group]?.[key]]).toEqual([locale, path, "string"]);
      }
    }
  });

  it("puts the store's words in place, leaves the rest, and ignores what is not on the list", () => {
    const ts = { storeWords: { ar: { "product.orderNow": "اطلبها دلوقتي", "common.save": "x", "cart.title": "   " }, en: { "cart.title": "Your bag" } } };
    expect(readStoreWords(ts, "ar")).toEqual({ "product.orderNow": "اطلبها دلوقتي" });
    const ar = withStoreWords(getDictionary("ar"), readStoreWords(ts, "ar"));
    expect(ar.product.orderNow).toBe("اطلبها دلوقتي");
    expect(ar.product.addToCart).toBe(getDictionary("ar").product.addToCart);
    // The dictionary itself is never changed.
    expect(getDictionary("ar").product.orderNow).not.toBe("اطلبها دلوقتي");
    expect(readAllStoreWords(ts)).toEqual({ ar: { "product.orderNow": "اطلبها دلوقتي" }, en: { "cart.title": "Your bag" } });
    expect(withStoreWords(getDictionary("en"), {})).toBe(getDictionary("en"));
  });
});
