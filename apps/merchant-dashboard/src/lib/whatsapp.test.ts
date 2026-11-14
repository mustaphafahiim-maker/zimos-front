import { describe, expect, it } from "vitest";
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  fillWhatsAppTemplate,
  toWhatsAppNumber,
  whatsAppConfirmUrl,
  whatsAppItemsText,
} from "./whatsapp";

describe("toWhatsAppNumber", () => {
  it("puts Egyptian mobiles in international form, whatever way they were typed", () => {
    for (const typed of [
      "01012345678",
      "010 1234 5678",
      "010-1234-5678",
      "+20 10 1234 5678",
      "+201012345678",
      "00201012345678",
      "201012345678",
      "1012345678",
      "٠١٠١٢٣٤٥٦٧٨",
      "+20 (0)10 1234 5678",
    ]) {
      expect(toWhatsAppNumber(typed), typed).toBe("201012345678");
    }
  });

  it("keeps another country's international number, and refuses what can't be dialled", () => {
    expect(toWhatsAppNumber("+966 50 123 4567")).toBe("966501234567");
    expect(toWhatsAppNumber("0501234567")).toBeNull();
    expect(toWhatsAppNumber("12")).toBeNull();
    expect(toWhatsAppNumber("")).toBeNull();
    expect(toWhatsAppNumber(null)).toBeNull();
  });
});

describe("the message", () => {
  const order = {
    orderNumber: "ORD-1042",
    totalAmount: "35000",
    currency: "EGP",
    contactSnapshot: { fullName: "منى علي", phone: "01012345678" },
    items: [
      { productNameSnapshot: "كوب", quantity: 2, variantOptionsSnapshot: { color: "أحمر" } },
      { productNameSnapshot: "Bundle", quantity: 1, offerNameSnapshot: "عرض 3 قطع" },
    ],
  };

  it("fills every placeholder and leaves an unknown one visible", () => {
    const text = fillWhatsAppTemplate("{customerName} {orderNumber} {store} {total} {items} {oops}", {
      customerName: "A",
      orderNumber: "B",
      store: "C",
      total: "D",
      items: "E",
    });
    expect(text).toBe("A B C D E {oops}");
  });

  it("lists items with their options or offer name", () => {
    expect(whatsAppItemsText(order.items)).toBe("2 × كوب (أحمر)\n1 × عرض 3 قطع");
  });

  it("builds a wa.me link with the default Arabic message", () => {
    const url = whatsAppConfirmUrl(order, "متجر النيل");
    expect(url).not.toBeNull();
    const parsed = new URL(url as string);
    expect(parsed.origin + parsed.pathname).toBe("https://wa.me/201012345678");
    const text = parsed.searchParams.get("text") ?? "";
    expect(text).toContain("منى علي");
    expect(text).toContain("ORD-1042");
    expect(text).toContain("متجر النيل");
    expect(text).toContain("2 × كوب (أحمر)");
    expect(text).not.toMatch(/\{\w+\}/);
    expect(DEFAULT_WHATSAPP_TEMPLATE).toContain("{orderNumber}");
  });

  it("uses the store's own message when it has one, and needs a number", () => {
    const url = whatsAppConfirmUrl(order, "S", "رقم {orderNumber}");
    expect(new URL(url as string).searchParams.get("text")).toBe("رقم ORD-1042");
    expect(whatsAppConfirmUrl({ ...order, contactSnapshot: { fullName: "x", phone: null } }, "S")).toBeNull();
  });
});
