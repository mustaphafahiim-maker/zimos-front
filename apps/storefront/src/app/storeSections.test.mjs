import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

/**
 * The page builder's full-width bands are drawn by components/page-renderer/
 * showcase and styled by app/store-sections.css alone. For a while that file
 * was in the tree but never loaded: the slider drew its picture at the
 * picture's own size, ignored its heights, set its text as plain text under
 * the picture and filled its wave black. These pin the load, and the few
 * rules the slider's size and wave rest on.
 */

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const globals = read("./globals.css");
const sections = read("./store-sections.css");

/** The declarations of the first rule whose selector is exactly `selector`, outside any media query when `from` is 0. */
function rule(css, selector, from = 0) {
  const at = css.indexOf(`${selector} {`, from);
  assert.notEqual(at, -1, `no rule for ${selector}`);
  return css.slice(at, css.indexOf("}", at));
}

describe("the showcase stylesheet", () => {
  it("is loaded by the storefront's one global stylesheet", () => {
    const imports = [...globals.matchAll(/^@import\s+"([^"]+)";/gm)].map((match) => match[1]);
    assert.deepEqual(imports, ["tailwindcss", "./store-themes.css", "./store-sections.css"]);
  });

  it("is imported before any rule, where an import still counts", () => {
    const lastImport = globals.lastIndexOf("@import ");
    const firstRule = globals.search(/^(?:@custom-variant|@theme|@layer|:root|\.[a-z])/m);
    assert.ok(firstRule > lastImport, "an @import after a rule is ignored by the browser");
  });

  it("has a rule for every class the showcase components write", () => {
    const dir = new URL("../components/page-renderer/showcase/", import.meta.url);
    const written = new Set();
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".tsx") || name.includes(".test.")) continue;
      const source = readFileSync(new URL(name, dir), "utf8");
      // Class names only: `--zs-…` is a custom property, not a class.
      for (const match of source.matchAll(/(?<![-\w])zs(?:-[a-z0-9]+)+(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+)?(?![\w-])/g)) written.add(match[0]);
    }
    assert.ok(written.has("zs-hero") && written.has("zs-cats") && written.has("zs-banner__wave"), "the scan found the bands");
    assert.ok(written.size > 100, `only ${written.size} class names found`);
    const unstyled = [...written].filter((name) => !new RegExp(`\\.${name}(?![a-z0-9_-])`).test(sections)).sort();
    // Three wrappers hold other parts together and have no rule of their own.
    assert.deepEqual(unstyled, ["zs-need", "zs-need__stage", "zs-shelf__heading-block"]);
  });
});

describe("the picture slider's size", () => {
  it("is the height it is given on a computer and on a tablet, never the picture's own", () => {
    assert.match(rule(sections, ".zs-hero"), /height: var\(--zs-hero-h, 620px\);/);
    assert.match(rule(sections, ".zs-hero"), /overflow: hidden;/);
    const tablet = sections.slice(sections.indexOf("@media (max-width: 1024px) {\n  .zs-hero {"));
    assert.match(rule(tablet, ".zs-hero"), /height: var\(--zs-hero-h-tablet, 520px\);/);
  });

  it("is a box 4 wide to 5 tall on a phone, or the height the slider names for a phone", () => {
    const phone = sections.slice(sections.indexOf("@media (max-width: 749px) {\n  .zs-hero {"));
    assert.match(rule(phone, ".zs-hero"), /height: auto;\s*aspect-ratio: 4 \/ 5;/);
    const own = rule(phone, ".zs-hero[data-phone-height]");
    assert.match(own, /height: var\(--zs-hero-h-mobile\);/);
    assert.match(own, /aspect-ratio: auto;/);
  });

  it("fills that box with the picture, cropped rather than stretched or letting it grow", () => {
    const media = rule(sections, ".zs-hero__media");
    assert.match(media, /position: absolute;/);
    assert.match(media, /inset: 0;/);
    const img = rule(sections, ".zs-hero__media img");
    assert.match(img, /width: 100%;/);
    assert.match(img, /height: 100%;/);
    assert.match(img, /object-fit: cover;/);
  });
});

describe("the wave under a slider or a banner", () => {
  it("is filled with the page's own background colour, not left black", () => {
    // The page is painted with --color-paper (globals.css, `body`), light or dark, and by every store theme.
    assert.match(globals, /body \{\s*background-color: var\(--color-paper\);/);
    assert.match(rule(sections, ".zs-hero__wave path"), /fill: var\(--color-paper\);/);
    assert.match(rule(sections, ".zs-banner__wave path"), /fill: var\(--color-paper\);/);
  });
});
