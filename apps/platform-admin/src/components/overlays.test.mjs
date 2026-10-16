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
const css = read("../index.css");

function ruleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `no ${selector} rule in index.css`);
  return match[1];
}

describe("Modal and Drawer", () => {
  for (const file of ["./Modal.tsx", "./Drawer.tsx"]) {
    it(`${file} is drawn in <body>, outside every ancestor`, () => {
      const source = read(file);
      assert.match(source, /import \{ createPortal \} from "react-dom";/);
      assert.match(source, /return createPortal\(/);
      assert.match(source, /document\.body\s*\);\s*\}/);
    });
  }

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
