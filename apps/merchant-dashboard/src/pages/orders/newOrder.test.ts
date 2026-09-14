import { describe, expect, it } from "vitest";
import type { Order } from "@store-builder/api-client";
import {
  buildCreateOrderPayload,
  draftFromOrder,
  emptyDraft,
  filterOrders,
  governorateCodeFromProvince,
  isChunkLoadError,
  isValidEgPhone,
  normalizeEgPhone,
  toCsv,
  validateDraft,
  whatsappUrl,
} from "./newOrder";

const M = {
  phoneRequired: "pr",
  phoneInvalid: "pi",
  nameRequired: "nr",
  governorateRequired: "gr",
  cityRequired: "cr",
  addressRequired: "ar",
  itemsRequired: "ir",
  lineVariantRequired: "lv",
  lineQuantityInvalid: "lq",
};

describe("Egyptian phone", () => {
  it("accepts 010/011/012/015 mobiles and normalizes +20", () => {
    expect(isValidEgPhone("01012345678")).toBe(true);
    expect(isValidEgPhone("+20 115 123 4567")).toBe(true);
    expect(isValidEgPhone("٠١٢٣٤٥٦٧٨٩٠")).toBe(true);
    expect(isValidEgPhone("01312345678")).toBe(false);
    expect(isValidEgPhone("0101234567")).toBe(false);
    expect(normalizeEgPhone("0020 1512345678")).toBe("01512345678");
  });
  it("builds wa.me links with +20", () => {
    expect(whatsappUrl("01012345678")).toBe("https://wa.me/201012345678");
    expect(whatsappUrl("123")).toBeNull();
  });
});

describe("order draft", () => {
  it("validates required fields with API-shaped keys", () => {
    const e = validateDraft(emptyDraft(), M);
    expect(e["contact.phone"]).toBe("pr");
    expect(e["shippingAddress.province"]).toBe("gr");
    expect(e.items).toBe("ir");
  });

  it("builds the create payload the API expects", () => {
    const d = {
      ...emptyDraft(),
      phone: "+201012345678",
      fullName: " Manual Order Test ",
      governorate: "cairo",
      city: "Nasr City",
      addressLine: "1 Street",
      discountCode: "",
      lines: [{ key: "a", productId: "p", variantId: "v", offerId: "", quantity: 2 }],
    };
    expect(validateDraft(d, M)).toEqual({});
    expect(buildCreateOrderPayload(d)).toEqual({
      items: [{ variantId: "v", quantity: 2 }],
      contact: { fullName: "Manual Order Test", phone: "01012345678" },
      shippingAddress: { country: "EG", province: "القاهرة (Cairo)", city: "Nasr City", addressLine: "1 Street" },
      paymentMethod: "cod",
    });
  });

  it("maps provinces back to governorate codes and duplicates orders", () => {
    expect(governorateCodeFromProvince("الجيزة (Giza)")).toBe("giza");
    expect(governorateCodeFromProvince("Giza")).toBe("giza");
    const order = {
      customerId: "c",
      contactSnapshot: { phone: "01012345678", fullName: "A" },
      shippingAddressSnapshot: { province: "الجيزة (Giza)", city: "X", addressLine: "Y" },
      notes: null,
      paymentMethod: "cod",
      items: [{ productId: "p", variantId: "v", offerId: null, quantity: 3 }],
    } as unknown as Order;
    const d = draftFromOrder(order);
    expect(d.governorate).toBe("giza");
    expect(d.lines[0]).toMatchObject({ variantId: "v", quantity: 3, offerId: "" });
  });
});

describe("list helpers", () => {
  it("CSV has a BOM and escapes", () => {
    expect(toCsv([["a", 'b"c'], ["x,y", "ع"]])).toBe('﻿a,"b""c"\r\n"x,y",ع');
  });
  it("filters by text and date range", () => {
    const rows = [
      { orderNumber: "ORD-1", createdAt: "2026-09-01T10:00:00", contactSnapshot: { fullName: "Sara" } },
      { orderNumber: "ORD-2", createdAt: "2026-09-10T10:00:00", contactSnapshot: { fullName: "Omar" } },
    ] as unknown as Order[];
    expect(filterOrders(rows, "omar", "", "")).toHaveLength(1);
    expect(filterOrders(rows, "", "2026-09-05", "")).toHaveLength(1);
    expect(filterOrders(rows, "", "", "2026-09-01")).toHaveLength(1);
  });
  it("detects chunk load errors", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /a.js"))).toBe(true);
    expect(isChunkLoadError(new Error("boom"))).toBe(false);
  });
});
