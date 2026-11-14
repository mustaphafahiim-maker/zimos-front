import { describe, expect, it } from "vitest";
import { STORE_WORD_DEFAULTS, readStoreWordsOf, withStoreWord } from "./StoreWordsBlock";

describe("StoreWordsBlock: the shop pages' words, per language", () => {
  it("knows the storefront's 27 words in both languages", () => {
    expect(Object.keys(STORE_WORD_DEFAULTS)).toHaveLength(27);
    for (const [en, ar] of Object.values(STORE_WORD_DEFAULTS)) {
      expect(en.length).toBeGreaterThan(0);
      expect(ar).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it("saves one language's word without touching the other's, nothing once all are emptied", () => {
    const one = withStoreWord(undefined, "ar", "product.orderNow", "اطلبها دلوقتي");
    const two = withStoreWord(one, "en", "cart.title", "Your bag");
    expect(two).toEqual({ ar: { "product.orderNow": "اطلبها دلوقتي" }, en: { "cart.title": "Your bag" } });
    expect(readStoreWordsOf(two, "ar")).toEqual({ "product.orderNow": "اطلبها دلوقتي" });
    expect(withStoreWord(withStoreWord(two, "en", "cart.title", ""), "ar", "product.orderNow", "")).toBeUndefined();
    expect(readStoreWordsOf({ ar: { "not.a.word": "x" } }, "ar")).toEqual({});
  });
});
