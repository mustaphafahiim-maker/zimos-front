import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Modal and Drawer are position: fixed. A backdrop-blur or a transform on any
 * ancestor makes fixed follow that box instead of the window: a Modal opened
 * inside a Drawer (TemplatesPage's version viewer) was held to the drawer's
 * width, and an entrance animation that filled "both" left a transform on the
 * drawer for good. This app's tests run without a DOM, so they read the source
 * and the stylesheet.
 */
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
// This app's own rules, then the base it shares with the merchant dashboard
// (`.animate-slide-in-start` is defined there).
const css = `${read("../index.css")}\n${read("../../../../packages/ui/src/theme/app.css")}`;

function ruleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `no ${selector} rule in index.css or app.css`);
  return match[1];
}

/** Anything that makes an element the box `position: fixed` inside it is placed against. */
const CONTAINING_BLOCK = /\b(transform|translate|scale|rotate|perspective|filter|backdrop-filter|will-change|contain|container-type)\s*:/;

describe("Modal and Drawer", () => {
  // Since the console took the merchant dashboard's frame, overlays are drawn in
  // the layout's overlay root: inside `.glass-app main` (so a dialog's fields and
  // buttons look as they do on a page), outside the page column and the bars.
  for (const file of ["./Modal.tsx", "./Drawer.tsx", "./SignOutDialog.tsx"]) {
    it(`${file} is drawn in the overlay root, outside the box that uses it`, () => {
      const source = read(file);
      assert.match(source, /import \{ createPortal \} from "react-dom";/);
      assert.match(source, /return createPortal\(/);
      assert.match(source, /import \{ overlayTarget \} from "\.\/overlayRoot";/);
      assert.match(source, /overlayTarget\(\)/);
    });
  }

  it("the overlay root falls back to <body> where there is no layout (the sign-in page)", () => {
    assert.match(read("./overlayRoot.tsx"), /\?\? document\.body;/);
  });

  it("the layout keeps the overlay root in <main>, after the page column and outside it", () => {
    const layout = read("./AdminLayout.tsx").replace(/\r\n/g, "\n");
    const main = layout.slice(layout.indexOf("<main"), layout.indexOf("</main>"));
    const column = main.indexOf('className="page-in"');
    const root = main.indexOf("<OverlayRoot />");
    assert.ok(column > 0 && root > column, "<OverlayRoot /> must follow the .page-in column inside <main>");
    // The column closes before the root opens: the root is its sibling, not inside it.
    const between = main.slice(column, root);
    assert.equal((between.match(/<div\b/g) ?? []).length + 1, (between.match(/<\/div>/g) ?? []).length);
  });

  it("nothing the theme puts on the page pane holds a fixed overlay to it", () => {
    const theme = ["app.css", "tokens.css", "looks.css", "liquid-glass.css", "shell.css"].map((file) => read(`../../../../packages/ui/src/theme/${file}`)).join("\n");
    const rules = [...theme.matchAll(/(?:^|[\n,}])\s*\.glass-app main\s*(?:,[^{]*)?\{([^}]*)\}/g)].map((m) => m[1]);
    assert.ok(rules.length >= 2, "expected the theme to style .glass-app main");
    for (const body of rules) assert.doesNotMatch(body, CONTAINING_BLOCK);
    // The page column's entrance leaves nothing behind either.
    assert.match(ruleBody(".page-in"), /\bbackwards\b/);
    assert.doesNotMatch(ruleBody(".page-in"), /\b(both|forwards)\b/);
  });

  it("TemplatesPage still opens its version Modal from inside the Drawer (the case this fixes)", () => {
    const page = read("../pages/TemplatesPage.tsx");
    assert.match(page, /<Modal open onClose=\{\(\) => setViewing\(null\)\}/);
  });
});

describe("entrance animations", () => {
  for (const [selector, name] of [
    [".animate-slide-up", "slide-up"],
    [".animate-slide-in-end", "slide-in-end"],
    [".animate-slide-in-start", "slide-in-start"],
  ]) {
    it(`${selector} plays and leaves no transform behind`, () => {
      const body = ruleBody(selector);
      assert.match(body, new RegExp(`animation:\\s*${name}\\b`));
      assert.match(body, /\bbackwards\b/);
      assert.doesNotMatch(body, /\b(both|forwards)\b/);
    });
  }
});
