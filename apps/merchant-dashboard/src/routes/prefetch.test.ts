/// <reference types="node" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const source = read("./prefetch.ts");
const app = read("../App.tsx");

/** `registerPrefetch("/x", () => import("@/pages/…"))`, with the switch in front of it when there is one. */
const lines = [...source.matchAll(/^(?:if \((\w+)\) )?registerPrefetch\("([^"]+)", \(\) => import\("([^"]+)"\)\);\r?$/gm)].map(
  ([, flag, route, module]) => ({ flag: flag ?? null, route, module })
);

describe("the pages fetched ahead of a press", () => {
  it("are all pages App.tsx loads lazily, by the same import", () => {
    expect(lines.length).toBeGreaterThan(20);
    for (const line of lines) expect(app, line.route).toContain(`import("${line.module}")`);
  });

  it("leave a page behind a feature switch alone while the switch is off", () => {
    // In App.tsx a switched route reads `path="/x" element={FLAG ? <LazyRoute>… : <Navigate …`.
    const switched = new Map(
      [...app.matchAll(/path="([^":?]+?)(?:\/:\w+\??)?"\s+element=\{(\w+_ENABLED) \?/g)].map(([, route, flag]) => [route, flag])
    );
    expect(switched.size).toBeGreaterThan(10);
    for (const line of lines) {
      expect(line.flag, line.route).toBe(switched.get(line.route) ?? null);
    }
  });

  it("is loaded by main.tsx, and none of it is a service worker", () => {
    expect(read("../main.tsx")).toContain("import './routes/prefetch'");
    expect(source).not.toMatch(/serviceWorker|manifest/);
  });
});
