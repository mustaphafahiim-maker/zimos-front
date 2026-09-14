import { describe, expect, it } from "vitest";
import { isElementVisible, sectionHasContent } from "../PageRenderer";
import { SECTION_BY_ID } from "../sections";
import type { TreeElement, TreeSection } from "../tree";

const NOW = Date.parse("2026-09-14T12:00:00Z");

function withElementProps(section: TreeSection, type: string, props: Record<string, unknown>): TreeSection {
  return {
    ...section,
    rows: section.rows.map((r) => ({
      ...r,
      columns: r.columns.map((c) => ({
        ...c,
        elements: c.elements.map((e) => (e.type === type ? { ...e, props: { ...e.props, ...props } } : e)),
      })),
    })),
  };
}

describe("live-store visibility (no fake content)", () => {
  it("hides the whole testimonials section until a real quote exists", () => {
    const empty = SECTION_BY_ID.testimonials.create();
    expect(sectionHasContent(empty, NOW)).toBe(false);
    const filled = withElementProps(empty, "testimonial", { quote: "وصلني الطلب بسرعة", author: "منى" });
    expect(sectionHasContent(filled, NOW)).toBe(true);
  });

  it("hides the countdown section without a real future end date", () => {
    const empty = SECTION_BY_ID.countdown.create();
    expect(sectionHasContent(empty, NOW)).toBe(false);
    expect(sectionHasContent(withElementProps(empty, "countdown", { endsAt: "2026-09-10T00:00:00Z" }), NOW)).toBe(false);
    expect(sectionHasContent(withElementProps(empty, "countdown", { endsAt: "2026-09-20T00:00:00Z" }), NOW)).toBe(true);
  });

  it("never renders a legacy relative countdown (endsInHours) as a fake timer", () => {
    const el: TreeElement = { id: "c", type: "countdown", props: { endsInHours: 24 } };
    expect(isElementVisible(el, NOW)).toBe(false);
  });

  it("hides buttons without a safe link and images without src unless they are theme placeholders", () => {
    expect(isElementVisible({ id: "b", type: "button", props: { label: "x", href: "" } })).toBe(false);
    expect(isElementVisible({ id: "b", type: "button", props: { label: "x", href: "javascript:alert(1)" } })).toBe(false);
    expect(isElementVisible({ id: "b", type: "button", props: { label: "x", href: "/track" } })).toBe(true);
    expect(isElementVisible({ id: "i", type: "image", props: { src: "" } })).toBe(false);
    expect(isElementVisible({ id: "i", type: "image", props: { src: "", placeholder: true } })).toBe(true);
  });
});
