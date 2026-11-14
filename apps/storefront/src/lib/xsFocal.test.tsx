// @vitest-environment node
import { describe, expect, it } from "vitest";
import { xsBackground, xsFocal } from "./xsPicture";

describe("a ground picture's focal point", () => {
  it("takes x% y% from 0 to 100, nothing else", () => {
    expect(xsFocal("70% 28%")).toBe("70% 28%");
    expect(xsFocal("100% 0%")).toBe("100% 0%");
    expect(xsFocal("101% 0%")).toBeNull();
    expect(xsFocal("left; color:red")).toBeNull();
    expect(xsFocal(undefined)).toBeNull();
  });

  it("is drawn as the ground's position, the look's own when none", () => {
    expect(xsBackground("/xs/05/hero-1.jpg", "70% 28%").backgroundPosition).toBe("70% 28%");
    expect(xsBackground("/xs/05/hero-1.jpg").backgroundPosition).toBeUndefined();
    expect(xsBackground("https://cdn.example.com/a.jpg", "10% 90%")).toEqual({ backgroundImage: 'url("https://cdn.example.com/a.jpg")', backgroundPosition: "10% 90%" });
  });
});
