import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageTree } from "@store-builder/api-client";

// saveFunnelDiff talks to the API; record the calls instead.
const api = vi.hoisted(() => ({
  funnelsCreateStep: vi.fn(async () => ({})),
  funnelsUpdateStep: vi.fn(async () => ({})),
  funnelsCreateEdge: vi.fn(async () => ({})),
  funnelsUpdateEdge: vi.fn(async () => ({})),
  funnelsDeleteEdge: vi.fn(async () => ({})),
  funnelsDeleteStep: vi.fn(async () => ({})),
  funnelsUpdate: vi.fn(async () => ({})),
}));
vi.mock("@store-builder/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@store-builder/api-client")>()),
  ...api,
}));

import { STARTER_TEMPLATE_IDS, saveFunnelDiff, starterPlan, type StarterTemplateId, type UiFunnel, type UiStep } from "./funnelAdapter";
import {
  addStepAfter,
  applyStarterPlan,
  collectFunnelProblems,
  groupProblems,
  insertStepOnEdge,
  layoutFlow,
  problemStepKey,
  removeStep,
  tidyFunnel,
} from "./funnelFlow";
import { pageElementCount, stepPageTree } from "./funnelPages";

/**
 * Every starter and every step the editor creates has to be something the
 * backend will store AND publish. The rules below are copied from the backend
 * on purpose (modules/funnels/funnelGraph.js + funnelsValidation.js,
 * modules/pages/pageTree.js) — importing the editor's own lists would test it
 * against itself.
 */
const STEP_TYPES = new Set(["landing", "sales", "opt_in", "checkout", "upsell", "downsell", "thank_you", "custom"]);
const OFFER_STEP_TYPES = new Set(["upsell", "downsell"]);
const CONDITIONS = new Set(["always", "completed_checkout", "accepted_offer", "declined_offer"]);
const STEP_KEY = /^[a-z0-9](?:[a-z0-9-_]*[a-z0-9])?$/;
const ALLOWED_ELEMENT_TYPES = new Set([
  "heading",
  "text",
  "rich_text",
  "image",
  "gallery",
  "button",
  "video",
  "embed",
  "spacer",
  "divider",
  "icon",
  "list",
  "accordion",
  "faq",
  "testimonial",
  "countdown",
  "form",
  "map",
  "social_icons",
  "product_card",
  "product_list",
  "collection_list",
  "cart",
  "shader_hero",
  "product_3d",
  "orbit_gallery",
  "scroll_story",
  "marquee",
  "comparison",
]);

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

/** pageTree.validatePageTree with requireContent: every problem, as strings. */
function treeProblems(data: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(data) || !Array.isArray(data.sections)) return ["not a tree"];
  const ids = new Set<string>();
  const node = (n: unknown, type: string, path: string) => {
    if (!isObj(n)) return errors.push(`${path}: not an object`), false;
    if (typeof n.id !== "string" || !n.id.trim()) errors.push(`${path}: no id`);
    else if (ids.has(n.id)) errors.push(`${path}: duplicate id ${n.id}`);
    else ids.add(n.id);
    if (type !== "element" && n.type !== type) errors.push(`${path}: type ${String(n.type)}`);
    return true;
  };
  let elements = 0;
  data.sections.forEach((s, i) => {
    if (!node(s, "section", `s${i}`) || !Array.isArray((s as { rows?: unknown }).rows)) return errors.push(`s${i}: rows`);
    (s as { rows: unknown[] }).rows.forEach((r, j) => {
      if (!node(r, "row", `s${i}r${j}`) || !Array.isArray((r as { columns?: unknown }).columns)) return errors.push(`s${i}r${j}: columns`);
      (r as { columns: unknown[] }).columns.forEach((c, k) => {
        if (!node(c, "column", `s${i}r${j}c${k}`) || !Array.isArray((c as { elements?: unknown }).elements)) return errors.push("elements");
        const span = (c as { span?: unknown }).span;
        if (span !== undefined && !(Number.isInteger(span) && (span as number) >= 1 && (span as number) <= 12)) errors.push("span");
        for (const el of (c as { elements: unknown[] }).elements) {
          elements++;
          if (!node(el, "element", "el")) continue;
          const e = el as { type?: unknown; props?: unknown };
          if (typeof e.type !== "string" || !ALLOWED_ELEMENT_TYPES.has(e.type)) errors.push(`element type ${String(e.type)}`);
          if (e.props !== undefined && !isObj(e.props)) errors.push("props");
        }
      });
    });
  });
  if (data.sections.length === 0 || elements === 0) errors.push("no content");
  return errors;
}

interface PlanLike {
  steps: Array<{ key: string; type: string; name: string; tree: unknown; offerId?: string | null }>;
  edges: Array<{ from: string; to: string; condition: string; priority: number }>;
}

/** funnelGraph.validateGraph(steps, edges, { requireContent: true }) + create-time field rules. */
function publishProblems(plan: PlanLike): string[] {
  const problems: string[] = [];
  const keys = new Set<string>();
  for (const s of plan.steps) {
    if (keys.has(s.key)) problems.push(`duplicate key ${s.key}`);
    keys.add(s.key);
    if (!STEP_KEY.test(s.key) || s.key.length > 100) problems.push(`bad key ${s.key}`);
    if (!STEP_TYPES.has(s.type)) problems.push(`bad type ${s.type}`);
    if (!s.name || s.name.length > 200) problems.push(`bad name ${s.key}`);
    if (OFFER_STEP_TYPES.has(s.type) && !s.offerId) problems.push(`offer:${s.key}`);
    for (const p of treeProblems(s.tree)) problems.push(`${s.key}: ${p}`);
  }
  for (const e of plan.edges) {
    if (!keys.has(e.from) || !keys.has(e.to)) problems.push(`dangling ${e.from}->${e.to}`);
    if (!CONDITIONS.has(e.condition)) problems.push(`condition ${e.condition}`);
    if (!Number.isInteger(e.priority)) problems.push("priority");
  }
  const targeted = new Set(plan.edges.map((e) => e.to));
  const entries = [...keys].filter((k) => !targeted.has(k));
  if (entries.length !== 1) return [...problems, `entries: ${entries.length}`];
  const seen = new Set([entries[0]]);
  const queue = [entries[0]];
  while (queue.length) {
    const cur = queue.shift() as string;
    for (const e of plan.edges) if (e.from === cur && !seen.has(e.to)) seen.add(e.to), queue.push(e.to);
  }
  for (const k of keys) if (!seen.has(k)) problems.push(`unreachable ${k}`);
  return problems;
}

/** Every string anywhere in a tree's props. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (isObj(value)) return Object.values(value).flatMap(strings);
  return [];
}

function uiFunnel(steps: UiStep[] = [], edges: UiFunnel["edges"] = []): UiFunnel {
  return {
    id: "f1",
    name: "Test",
    subdomain: null,
    status: "draft",
    publishedRevisionId: null,
    publishedRevisionNumber: null,
    steps,
    edges,
    createdAt: "",
    updatedAt: "",
  };
}

function asPlan(f: UiFunnel): PlanLike {
  return {
    steps: f.steps.map((s) => ({ key: s.key, type: s.type, name: s.name, tree: s.tree, offerId: s.offerId })),
    edges: f.edges.map((e) => ({ from: e.fromStepKey, to: e.toStepKey, condition: e.condition, priority: e.priority })),
  };
}

const LOCALES = ["en", "ar"] as const;

describe("starter templates", () => {
  for (const locale of LOCALES) {
    for (const id of STARTER_TEMPLATE_IDS) {
      it(`${id} (${locale}) is publishable once its offer steps have an offer`, () => {
        const plan = starterPlan(id, locale);
        const problems = publishProblems(plan);
        // The only thing left for the merchant: pick an offer for each upsell/downsell.
        const offerSteps = plan.steps.filter((s) => OFFER_STEP_TYPES.has(s.type)).map((s) => `offer:${s.key}`);
        expect(problems.sort()).toEqual(offerSteps.sort());
      });
    }
  }

  it("the COD upsell template is product → COD checkout → upsell → thank-you, with a yes and a no path", () => {
    const plan = starterPlan("cod-upsell", "ar");
    expect(plan.steps.map((s) => s.type)).toEqual(["landing", "checkout", "upsell", "thank_you"]);
    const out = (from: string) => plan.edges.filter((e) => e.from === from);
    expect(out("checkout")).toEqual([expect.objectContaining({ to: "upsell", condition: "completed_checkout" })]);
    const answers = out("upsell").map((e) => [e.condition, e.to]);
    expect(answers).toEqual(expect.arrayContaining([["accepted_offer", "thank-you"], ["declined_offer", "thank-you"]]));
  });

  it("the COD bundle template sells a bundle through a product grid", () => {
    const plan = starterPlan("cod-bundle", "en");
    expect(plan.steps.map((s) => s.type)).toEqual(["landing", "checkout", "thank_you"]);
    const types = plan.steps[0].tree.sections.flatMap((s) => s.rows.flatMap((r) => r.columns.flatMap((c) => c.elements.map((e) => e.type))));
    expect(types).toContain("product_list");
  });

  it("lays yes above no, left to right in flow order", () => {
    const plan = starterPlan("upsell-downsell", "en");
    const at = new Map(plan.steps.map((s) => [s.key, s]));
    expect(at.get("landing")!.x).toBeLessThan(at.get("checkout")!.x);
    expect(at.get("checkout")!.x).toBeLessThan(at.get("upsell")!.x);
    // thank-you is the "yes" branch of the upsell, downsell the "no" branch.
    expect(at.get("thank-you")!.y).toBeLessThan(at.get("downsell")!.y);
    const spots = plan.steps.map((s) => `${s.x},${s.y}`);
    expect(new Set(spots).size).toBe(spots.length);
  });
});

describe("step pages", () => {
  const TYPES = ["landing", "sales", "opt_in", "checkout", "upsell", "downsell", "thank_you", "custom"] as const;

  for (const locale of LOCALES) {
    it(`every step type starts with a valid page that has content (${locale})`, () => {
      for (const type of TYPES) {
        const tree = stepPageTree(type, locale);
        expect(treeProblems(tree), type).toEqual([]);
        expect(pageElementCount(tree)).toBeGreaterThan(0);
      }
      expect(treeProblems(stepPageTree("landing", locale, "bundle"))).toEqual([]);
    });

    it(`starting copy invents no prices, numbers or links out (${locale})`, () => {
      for (const type of TYPES) {
        const elements = stepPageTree(type, locale).sections.flatMap((s) => s.rows.flatMap((r) => r.columns.flatMap((c) => c.elements)));
        for (const el of elements) {
          const { href, ...rest } = el.props ?? {};
          // Buttons either stay unlinked (the funnel decides what's next) or go back to the store.
          if (href !== undefined) expect(["", "/"]).toContain(href);
          for (const text of strings(rest)) expect(text, `${type}: ${text}`).not.toMatch(/[0-9٠-٩%]|EGP|ج\.م|جنيه|https?:/);
        }
      }
    });
  }

  it("carries the website editor's element defaults, so the shared inspector finds every field", () => {
    const upsell = stepPageTree("upsell", "en");
    const card = upsell.sections[0].rows[0].columns[0].elements.find((e) => e.type === "product_card");
    expect(card?.props).toMatchObject({ productId: "", showPrice: true });
  });
});

describe("editing the flow", () => {
  const plan = starterPlan("blank", "en");
  const base = applyStarterPlan(uiFunnel(), plan, []);

  it("fills an empty funnel from a template with keys that don't clash with saved ones", () => {
    const f = applyStarterPlan(uiFunnel(), plan, ["landing", "checkout"]);
    const keys = f.steps.map((s) => s.key);
    expect(keys).not.toContain("landing");
    expect(new Set(keys).size).toBe(keys.length);
    expect(publishProblems(asPlan(f))).toEqual([]);
    expect(collectFunnelProblems(f)).toEqual([]);
  });

  it("inserts a step into a connection and keeps the funnel publishable", () => {
    const edge = base.edges.find((e) => e.fromStepKey === "landing")!;
    const result = insertStepOnEdge(base, edge.id, "sales", "en", base.steps.map((s) => s.key))!;
    const { funnel, key } = result;
    // The original edge is reused (same id) and now points at the new step.
    expect(funnel.edges.find((e) => e.id === edge.id)?.toStepKey).toBe(key);
    expect(funnel.edges).toContainEqual(expect.objectContaining({ fromStepKey: key, toStepKey: "checkout", condition: "always" }));
    expect(publishProblems(asPlan(funnel))).toEqual([]);
  });

  it("gives an inserted offer step both a yes and a no path", () => {
    const edge = base.edges.find((e) => e.fromStepKey === "checkout")!;
    const { funnel, key } = insertStepOnEdge(base, edge.id, "upsell", "en", base.steps.map((s) => s.key))!;
    const out = funnel.edges.filter((e) => e.fromStepKey === key).map((e) => e.condition);
    expect(out.sort()).toEqual(["accepted_offer", "declined_offer"]);
    expect(publishProblems(asPlan(funnel))).toEqual([`offer:${key}`]);
    expect(collectFunnelProblems(funnel).map((p) => problemStepKey(p))).toEqual([key]);
  });

  it("adds a step after another with the condition that step type implies", () => {
    const afterCheckout = addStepAfter(base, "checkout", "upsell", "en", base.steps.map((s) => s.key));
    expect(afterCheckout.funnel.edges.at(-1)).toMatchObject({ fromStepKey: "checkout", condition: "completed_checkout" });

    const up = afterCheckout.key;
    const yes = addStepAfter(afterCheckout.funnel, up, "thank_you", "en", afterCheckout.funnel.steps.map((s) => s.key));
    expect(yes.funnel.edges.at(-1)).toMatchObject({ fromStepKey: up, condition: "accepted_offer" });
    const no = addStepAfter(yes.funnel, up, "downsell", "en", yes.funnel.steps.map((s) => s.key));
    expect(no.funnel.edges.at(-1)).toMatchObject({ fromStepKey: up, condition: "declined_offer" });
    // A new card never lands on top of another one.
    const spots = no.funnel.steps.map((s) => `${s.x},${s.y}`);
    expect(new Set(spots).size).toBe(spots.length);
  });

  it("removing the middle of a chain joins its neighbours", () => {
    const f = removeStep(base, "checkout");
    expect(f.steps.map((s) => s.key)).toEqual(["landing", "thank-you"]);
    expect(f.edges).toEqual([expect.objectContaining({ fromStepKey: "landing", toStepKey: "thank-you" })]);
    expect(publishProblems(asPlan(f))).toEqual([]);
  });

  it("removing a branching step drops its connections without guessing", () => {
    const f = applyStarterPlan(uiFunnel(), starterPlan("upsell-downsell", "en"), []);
    const g = removeStep(f, "upsell");
    expect(g.edges.some((e) => e.fromStepKey === "upsell" || e.toStepKey === "upsell")).toBe(false);
    expect(g.edges.some((e) => e.fromStepKey === "checkout")).toBe(false);
  });

  it("tidy layout puts steps the entry can't reach below the flow", () => {
    const keys = ["a", "b", "stray"];
    const pos = layoutFlow(keys, [{ fromStepKey: "a", toStepKey: "b", condition: "always", priority: 0 }]);
    expect(pos.get("stray")!.y).toBeGreaterThan(pos.get("b")!.y);
    const tidy = tidyFunnel(applyStarterPlan(uiFunnel(), starterPlan("cod-upsell", "en"), []));
    expect(tidy.steps.map((s) => s.key)).toEqual(["product", "checkout", "upsell", "thank-you"]);
  });
});

describe("publish problems", () => {
  it("names the step a server problem is about", () => {
    expect(problemStepKey({ field: "steps.upsell.offerId", message: "" })).toBe("upsell");
    expect(problemStepKey({ field: "steps.thank-you", message: "" })).toBe("thank-you");
    expect(problemStepKey({ field: "steps.x.data.sections", message: "", stepKey: "landing" })).toBe("landing");
    expect(problemStepKey({ field: "edges[0].condition", message: "" })).toBeNull();
    expect(problemStepKey({ field: "steps", message: "" })).toBeNull();
  });

  it("groups problems by step and keeps the rest general", () => {
    const { byStep, general } = groupProblems(
      [
        { field: "steps.upsell.offerId", message: "a" },
        { field: "steps.gone.offerId", message: "b" },
        { field: "steps", message: "c" },
      ],
      ["upsell"]
    );
    expect(byStep.get("upsell")?.map((p) => p.message)).toEqual(["a"]);
    expect(general.map((p) => p.message)).toEqual(["b", "c"]);
  });

  it("flags an empty page before the server does", () => {
    const f = applyStarterPlan(uiFunnel(), starterPlan("blank", "en"), []);
    const emptied = { ...f, steps: f.steps.map((s) => (s.key === "checkout" ? { ...s, tree: { version: 1, sections: [] } } : s)) };
    const problems = collectFunnelProblems(emptied);
    expect(problems.map((p) => p.stepKey)).toEqual(["checkout"]);
  });
});

describe("saving step pages", () => {
  beforeEach(() => Object.values(api).forEach((fn) => fn.mockClear()));

  function saved(overrides: Partial<UiStep> = {}): UiStep {
    return { id: "s1", key: "landing", name: "Landing", type: "landing", offerId: null, experimentId: null, seo: {}, tree: stepPageTree("landing", "en"), x: 40, y: 64, ...overrides };
  }

  it("sends builderData only when the page changed", async () => {
    const before = uiFunnel([saved()]);
    await saveFunnelDiff("w1", before, uiFunnel([saved({ x: 300 })]));
    expect(api.funnelsUpdateStep).toHaveBeenCalledTimes(1);
    expect(api.funnelsUpdateStep.mock.calls[0]).not.toContainEqual(expect.objectContaining({ builderData: expect.anything() }));

    api.funnelsUpdateStep.mockClear();
    const tree: PageTree = { ...before.steps[0].tree, sections: before.steps[0].tree.sections.slice(1) };
    await saveFunnelDiff("w1", before, uiFunnel([saved({ tree })]));
    expect(api.funnelsUpdateStep).toHaveBeenCalledWith(expect.anything(), "w1", "f1", "s1", { builderData: tree });
  });

  it("creates a new step with its own page", async () => {
    const tree = stepPageTree("checkout", "en");
    await saveFunnelDiff("w1", uiFunnel(), uiFunnel([saved({ id: null, key: "checkout", type: "checkout", tree })]));
    expect(api.funnelsCreateStep).toHaveBeenCalledWith(expect.anything(), "w1", "f1", expect.objectContaining({ key: "checkout", builderData: tree }));
  });
});

// Keeps the list above honest if a starter is added without a test run over it.
const _exhaustive: Record<StarterTemplateId, true> = { blank: true, "cod-single": true, "cod-upsell": true, "cod-bundle": true, "upsell-downsell": true, "lead-magnet": true };
void _exhaustive;
