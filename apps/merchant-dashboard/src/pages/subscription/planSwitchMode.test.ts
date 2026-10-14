import { describe, expect, it } from "vitest";
import { formatHours } from "./planSwitchMode";

// The hours a plan switch's charge lives, in words (the confirmation's line).
describe("formatHours", () => {
  it("in English", () => {
    expect(formatHours(1, "en")).toBe("1 hour");
    expect(formatHours(48, "en")).toBe("48 hours");
  });

  it("in Arabic, with its number forms", () => {
    expect(formatHours(1, "ar")).toBe("ساعة واحدة");
    expect(formatHours(2, "ar")).toBe("ساعتان");
    expect(formatHours(5, "ar")).toBe("٥ ساعات");
    expect(formatHours(48, "ar")).toBe("٤٨ ساعة");
  });
});
