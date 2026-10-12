import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

/**
 * The console is drawn with the merchant dashboard's theme: one copy of the
 * stylesheets and of the look's store, in packages/ui. What cannot be shared
 * as a file is held together here instead: the list of layers each app loads,
 * and the script that sets the look before the first paint. This app's tests
 * run without a DOM, so they read the sources.
 */
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const adminMain = read("./main.tsx");
const dashboardMain = read("../../merchant-dashboard/src/main.tsx");
const adminPage = read("../index.html");
const dashboardPage = read("../../merchant-dashboard/index.html");
const entry = read("./index.css");
const dashboardEntry = read("../../merchant-dashboard/src/index.css");

/** The stylesheets a main.tsx loads from the shared theme, in the order it loads them. */
const sharedLayers = (source) => [...source.matchAll(/^import '(@store-builder\/ui\/(?:styles\.css|theme\/[^']+))'/gm)].map((m) => m[1]);
/** Every stylesheet it loads, the app's own included. */
const layers = (source) => [...source.matchAll(/^import '([^']+\.css)'/gm)].map((m) => m[1]);
const script = (page) => /<script>([\s\S]*?)<\/script>/.exec(page)?.[1];

describe("the console's theme is the merchant dashboard's", () => {
  it("loads the same shared layers, in the same order", () => {
    const shared = sharedLayers(adminMain);
    assert.ok(shared.length >= 15, `only ${shared.length} shared layers`);
    assert.deepEqual(shared, sharedLayers(dashboardMain));
  });

  it("loads them after its own index.css, and nothing else of its own on top", () => {
    assert.deepEqual(layers(adminMain), ["@store-builder/ui/styles.css", "./index.css", ...sharedLayers(adminMain).slice(1)]);
  });

  it("builds its index.css from the dashboard's base, straight after Tailwind", () => {
    const imports = (source) => [...source.matchAll(/^@import "([^"]+)";/gm)].map((m) => m[1]);
    assert.deepEqual(imports(entry), imports(dashboardEntry));
    assert.equal(imports(entry).at(-1), "../../../packages/ui/src/theme/app.css");
    // The palette lives in that one copy: no colour token is set again here.
    assert.doesNotMatch(entry, /--color-[a-z-]+\s*:/);
    assert.doesNotMatch(entry, /--brand\s*:/);
  });

  it("every layer it names is a file of the shared theme", () => {
    for (const layer of sharedLayers(adminMain)) {
      const file = layer.replace("@store-builder/ui/", "../../../packages/ui/src/");
      assert.ok(existsSync(new URL(file, import.meta.url)), layer);
    }
  });

  it("reads the look from the shared store, on every page", () => {
    assert.match(adminMain, /^import '@store-builder\/ui\/appearance'$/m);
    assert.match(read("./components/ThemeToggle.tsx"), /export \{ ThemeToggle \} from "@store-builder\/ui\/appearance";/);
  });
});

describe("the look before first paint", () => {
  it("is set by the dashboard's own script, word for word", () => {
    assert.ok(script(adminPage), "no inline script in index.html");
    assert.equal(script(adminPage), script(dashboardPage));
  });

  it("covers the three looks, the tone, the glass switch and the glow colours", () => {
    const text = script(adminPage);
    for (const key of ["zimos.look", "zimos.darkLook", "zimos.darkTone", "zimos.glass", "zimos.glowLeft", "zimos.glowRight", "zimos.glowIntensity", "theme"]) {
      assert.ok(text.includes(`get("${key}")`), key);
    }
    assert.ok(text.includes('e.setAttribute("data-look", s)'));
    assert.ok(text.includes('e.setAttribute("data-glass", "off")'));
    assert.ok(text.includes("(prefers-color-scheme: dark)"));
  });

  it("loads the same fonts as the dashboard (Tajawal draws the Arabic)", () => {
    const fonts = (page) => /href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/.exec(page)?.[1];
    assert.ok(fonts(adminPage)?.includes("family=Tajawal"));
    assert.equal(fonts(adminPage), fonts(dashboardPage));
  });
});
