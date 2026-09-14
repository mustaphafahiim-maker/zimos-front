import { afterEach, describe, expect, it, vi } from "vitest";
import { GOVERNORATES } from "./data";
import { clearState, initialState, loadState, saveState, type WizardState } from "./state";

describe("wizard resume state", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("round-trips through sessionStorage", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
    const state: WizardState = {
      ...initialState(),
      step: "delivery",
      skipped: ["look"],
      workspaceId: "ws1",
      basics: { name: "Shop", slug: "shop", currency: "EGP", locale: "ar", categories: ["home"] },
      delivery: { zoneId: "z", regionCodes: ["cairo"], feeMinor: 5_000 },
    };
    expect(loadState("u1")).toBeNull();
    saveState("u1", state);
    expect(loadState("u1")).toEqual(state);
    expect(loadState("u2")).toBeNull();
    clearState("u1");
    expect(loadState("u1")).toBeNull();
  });

  it("ignores corrupt data and missing storage", () => {
    vi.stubGlobal("sessionStorage", { getItem: () => "{not json", setItem: () => {}, removeItem: () => {} });
    expect(loadState("u1")).toBeNull();
    vi.stubGlobal("sessionStorage", { getItem: () => "{}", setItem: () => {}, removeItem: () => {} });
    expect(loadState("u1")).toBeNull();
    vi.stubGlobal("sessionStorage", undefined);
    expect(loadState("u1")).toBeNull();
    expect(() => saveState("u1", initialState())).not.toThrow();
  });
});

describe("GOVERNORATES", () => {
  it("has 27 entries with unique codes and ar/en names", () => {
    expect(GOVERNORATES).toHaveLength(27);
    for (const field of ["code", "ar", "en"] as const) {
      const values = GOVERNORATES.map((g) => g[field]);
      expect(new Set(values).size).toBe(27);
      for (const v of values) expect(v.trim()).not.toBe("");
    }
  });
});
