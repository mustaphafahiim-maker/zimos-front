// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SHOPPER_TOKEN_HEADER, isShopperToken, shopperTokenHeaders } from "@store-builder/api-client";
import {
  SHOPPER_TOKEN_MAX_AGE_MS,
  clearShopperToken,
  readShopperToken,
  saveShopperToken,
  shopperHeaders,
} from "./shopperToken";

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

const TOKEN = "ws_1.cus_1.1.1760000000.ab12cd34";
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_760_000_000_000;

describe("shopperTokenHeaders", () => {
  it("sends the header only for a usable token", () => {
    expect(shopperTokenHeaders(TOKEN)).toEqual({ [SHOPPER_TOKEN_HEADER]: TOKEN });
    expect(SHOPPER_TOKEN_HEADER).toBe("X-Shopper-Token");
    expect(shopperTokenHeaders(null)).toEqual({});
    expect(shopperTokenHeaders(undefined)).toEqual({});
    expect(shopperTokenHeaders("")).toEqual({});
  });

  it("refuses anything that is not token characters", () => {
    expect(isShopperToken("a b")).toBe(false);
    expect(isShopperToken("abc\r\nX-Other: 1")).toBe(false);
    expect(isShopperToken("<script>")).toBe(false);
    expect(isShopperToken("a".repeat(513))).toBe(false);
    expect(isShopperToken(42)).toBe(false);
  });
});

describe("shopper token storage", () => {
  it("keeps, reads and sends nothing while the feature is off", () => {
    const storage = memoryStorage();
    storage.setItem("zimos:shopper:ws_1", JSON.stringify({ token: TOKEN, expiresAt: NOW + DAY }));
    expect(saveShopperToken("ws_2", TOKEN, 3600, { storage, now: NOW })).toBe(false);
    expect(storage.getItem("zimos:shopper:ws_2")).toBeNull();
    expect(readShopperToken("ws_1", { storage, now: NOW })).toBeNull();
    expect(shopperHeaders("ws_1", { storage, now: NOW })).toEqual({});
  });

  it("keeps a token for the API's lifetime when that is shorter than 7 days", () => {
    const storage = memoryStorage();
    const on = { enabled: true, storage, now: NOW };
    expect(saveShopperToken("ws_1", TOKEN, 3600, on)).toBe(true);
    expect(readShopperToken("ws_1", on)).toBe(TOKEN);
    expect(readShopperToken("ws_1", { ...on, now: NOW + 3600 * 1000 })).toBeNull();
    expect(storage.getItem("zimos:shopper:ws_1")).toBeNull();
  });

  it("never keeps a token longer than 7 days, even when the API grants 30", () => {
    const storage = memoryStorage();
    const on = { enabled: true, storage, now: NOW };
    expect(saveShopperToken("ws_1", TOKEN, 30 * 24 * 3600, on)).toBe(true);
    expect(JSON.parse(storage.getItem("zimos:shopper:ws_1")!).expiresAt).toBe(NOW + SHOPPER_TOKEN_MAX_AGE_MS);
    expect(readShopperToken("ws_1", { ...on, now: NOW + 7 * DAY - 1 })).toBe(TOKEN);
    expect(readShopperToken("ws_1", { ...on, now: NOW + 7 * DAY })).toBeNull();
  });

  it("drops a stored token that claims to last past 7 days from now", () => {
    const storage = memoryStorage();
    storage.setItem("zimos:shopper:ws_1", JSON.stringify({ token: TOKEN, expiresAt: NOW + 30 * DAY }));
    expect(readShopperToken("ws_1", { enabled: true, storage, now: NOW })).toBeNull();
    expect(storage.getItem("zimos:shopper:ws_1")).toBeNull();
  });

  it("drops junk and keeps stores apart", () => {
    const storage = memoryStorage();
    const on = { enabled: true, storage, now: NOW };
    storage.setItem("zimos:shopper:ws_1", "not json");
    expect(readShopperToken("ws_1", on)).toBeNull();
    expect(storage.getItem("zimos:shopper:ws_1")).toBeNull();

    saveShopperToken("ws_2", TOKEN, null, on);
    expect(readShopperToken("ws_1", on)).toBeNull();
    expect(shopperHeaders("ws_2", on)).toEqual({ "X-Shopper-Token": TOKEN });

    clearShopperToken("ws_2", on);
    expect(readShopperToken("ws_2", on)).toBeNull();
  });

  it("refuses odd store ids, bad tokens and a lifetime already over", () => {
    const storage = memoryStorage();
    const on = { enabled: true, storage, now: NOW };
    expect(saveShopperToken("../ws", TOKEN, 3600, on)).toBe(false);
    expect(saveShopperToken("ws_1", "bad token", 3600, on)).toBe(false);
    expect(saveShopperToken("ws_1", TOKEN, 0, on)).toBe(false);
    expect(storage.length).toBe(0);
  });

  it("works without storage at all", () => {
    expect(saveShopperToken("ws_1", TOKEN, 3600, { enabled: true, storage: null })).toBe(false);
    expect(readShopperToken("ws_1", { enabled: true, storage: null })).toBeNull();
  });
});
