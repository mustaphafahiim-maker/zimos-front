import { describe, expect, it } from "vitest";
import type { MerchantNotificationDto } from "@store-builder/api-client";
import { NOTIFICATION_STRINGS, notificationText, type NotificationStrings } from "./notificationText";

// The bell reads the wallet's notifications in the viewer's language,
// whatever language the stored title was written in.
const note = (type: string, data: Record<string, unknown> = {}) =>
  ({ id: "n1", type, title: "stored", body: "stored", link: null, data, readAt: null, createdAt: "2030-01-01T00:00:00Z" }) as unknown as MerchantNotificationDto;

describe("wallet notifications in the bell", () => {
  it("says the store fell back to pay per order, in English and Arabic", () => {
    const en = notificationText(NOTIFICATION_STRINGS.en as NotificationStrings, note("wallet.fallback", { fromPlan: "Starter", fee: 400 }));
    expect(en.title).toBe("Your subscription ended: your store is now on pay per order");
    expect(en.body).toMatch(/choose a subscription again at any time/);
    const ar = notificationText(NOTIFICATION_STRINGS.ar as NotificationStrings, note("wallet.fallback"));
    expect(ar.title).toBe("انتهى اشتراكك: متجرك الآن على الدفع لكل طلب");
  });
});
