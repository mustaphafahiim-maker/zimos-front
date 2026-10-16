import { describe, expect, it } from "vitest";
import { getDictionary } from "./i18n";
import { nextOpeningText, weekdayName } from "./storeHours";

// The closed store's next opening, from GET /store/:id delivery.hours.nextOpen.
describe("next opening text", () => {
  it("says today, tomorrow or the day, in each language", () => {
    expect(nextOpeningText({ weekday: 3, time: "18:00", inDays: 0 }, getDictionary("en"), "en")).toBe("Opens today at 18:00");
    expect(nextOpeningText({ weekday: 4, time: "10:00", inDays: 1 }, getDictionary("ar"), "ar")).toBe("هيفتح بكرة الساعة 10:00");
    expect(nextOpeningText({ weekday: 5, time: "12:00", inDays: 2 }, getDictionary("en"), "en")).toBe("Opens on Friday at 12:00");
    expect(nextOpeningText({ weekday: 0, time: "09:00", inDays: 3 }, getDictionary("fr"), "fr")).toBe("Ouvre dimanche à 09:00");
  });

  it("names Sunday as day 0", () => {
    expect(weekdayName(0, "en")).toBe("Sunday");
    expect(weekdayName(6, "en")).toBe("Saturday");
  });
});
