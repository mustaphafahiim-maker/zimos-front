import { describe, expect, it } from "vitest";
import { validateFunnel } from "./FunnelEditorPage";
import { tempId, uniqueStepKey, type UiEdge, type UiFunnel, type UiStep, type UiStepType } from "./funnelAdapter";

const step = (key: string, type: UiStepType = "landing", offerId: string | null = null): UiStep => ({
  id: null,
  key,
  name: key.toUpperCase(),
  type,
  offerId,
  experimentId: null,
  seo: {},
  x: 0,
  y: 0,
});

const edge = (from: string, to: string): UiEdge => ({
  id: `${from}->${to}`,
  serverId: null,
  fromStepKey: from,
  toStepKey: to,
  condition: "always",
  priority: 0,
});

const funnel = (steps: UiStep[], edges: UiEdge[]): UiFunnel => ({
  id: "f1",
  name: "F",
  subdomain: null,
  status: "draft",
  publishedRevisionId: null,
  publishedRevisionNumber: null,
  steps,
  edges,
  createdAt: "",
  updatedAt: "",
});

describe("validateFunnel", () => {
  it("valid graph -> []", () => {
    const f = funnel([step("a"), step("b", "checkout"), step("c", "upsell", "offer1"), step("d", "thank_you")], [edge("a", "b"), edge("b", "c"), edge("c", "d")]);
    expect(validateFunnel(f)).toEqual([]);
  });

  it("no steps", () => {
    expect(validateFunnel(funnel([], []))).toHaveLength(1);
  });

  it("no entry (cycle)", () => {
    const p = validateFunnel(funnel([step("a"), step("b")], [edge("a", "b"), edge("b", "a")]));
    expect(p).toHaveLength(1);
  });

  it("many entries", () => {
    const p = validateFunnel(funnel([step("a"), step("b")], []));
    expect(p).toHaveLength(1);
    expect(p[0]).toContain("A");
    expect(p[0]).toContain("B");
  });

  it("unreachable step", () => {
    // c is only reachable from d, d from c: a is the single entry, c/d unreachable.
    const p = validateFunnel(funnel([step("a"), step("b"), step("c"), step("d")], [edge("a", "b"), edge("c", "d"), edge("d", "c")]));
    expect(p).toHaveLength(2);
    expect(p.join("\n")).toContain("C");
    expect(p.join("\n")).toContain("D");
  });

  it("dangling edge", () => {
    const p = validateFunnel(funnel([step("a")], [edge("a", "ghost")]));
    expect(p.some((m) => m.includes("ghost"))).toBe(true);
  });

  it("upsell without offer", () => {
    const p = validateFunnel(funnel([step("a"), step("u", "upsell")], [edge("a", "u")]));
    expect(p).toHaveLength(1);
    expect(p[0]).toContain("U");
  });

  it("localises to ar", () => {
    const p = validateFunnel(funnel([], []), "ar");
    expect(p[0]).toMatch(/[؀-ۿ]/);
  });
});

describe("funnelAdapter helpers", () => {
  it("uniqueStepKey slugs and de-duplicates", () => {
    expect(uniqueStepKey("Thank You!", [])).toBe("thank-you");
    expect(uniqueStepKey("landing", ["landing", "landing-2"])).toBe("landing-3");
    expect(uniqueStepKey("!!!", [])).toBe("step");
  });
  it("tempId is prefixed and unique", () => {
    const a = tempId();
    expect(a.startsWith("tmp-")).toBe(true);
    expect(tempId()).not.toBe(a);
  });
});
