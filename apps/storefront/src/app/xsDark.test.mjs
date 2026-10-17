import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { darkDeclarations, darkRulesOf, darkSelector, mapValue, tokensOf, xsDarkCss } from "../../scripts/xs-dark.mjs";
import { hashOf, xsDarkSource, xsLookBundles } from "../../scripts/xs-look-css.mjs";
import { DARK, NATIVE_DARK_LOOKS, contrast, darkTokensOf, parseColor, toHex } from "../lib/xsDarkPalette.mjs";
import { XS_READABLE } from "../lib/xsReadable.ts";

/**
 * The imported templates' dark mode (scripts/xs-dark.mjs): worked out from the
 * light looks, linked only by a store that can be dark, and every look's words
 * readable in both modes — the "easier to read" check (lib/xsReadable.ts) in
 * the light, the same 4.5:1 in the dark.
 */

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const manifest = JSON.parse(read("../lib/xsLookCss.json"));
const LOOKS = Object.keys(manifest.looks).sort();
const BASE = tokensOf(read("./xs-sections.css"));
const tokens = (look) => (look === "01" ? BASE : { ...BASE, ...tokensOf(read(`./xs-look-${look}.css`)) });
const decl = (prop, value) => ({ prop, value, important: false });
const dark = (...decls) => Object.fromEntries(darkDeclarations(decls).map((d) => [d.prop, d.value]));

/** A colour as drawn on its ground (a see-through word is blended). */
function onGround(colour, ground) {
  const [r, g, b, a] = parseColor(colour);
  const [R, G, B] = parseColor(ground);
  return toHex([r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)]);
}

/** The words of a look that read under 4.5:1 on its ground, as "name ratio". */
function tooLight(look, values, grounds) {
  const out = [];
  for (const name of ["--xs-ink", "--xs-ink-soft", "--xs-muted"]) {
    for (const ground of grounds) {
      const ratio = contrast(onGround(values[name].trim(), ground), ground);
      if (ratio < 4.5) out.push(`${look} ${name} ${ratio.toFixed(2)}`);
    }
  }
  return out;
}

describe("the imported templates' words in light and dark", () => {
  it("read at 4.5:1 in the light with the Template look's easier-to-read shades — all but XS 19", () => {
    const failing = LOOKS.flatMap((look) => {
      const values = { ...tokens(look), ...(XS_READABLE[look] ?? {}) };
      return tooLight(look, values, [values["--xs-ground"].trim()]);
    });
    // XS 19 is a dark template whose body and small words are white at 30%: 2.7:1 on its own ground.
    assert.deepEqual(failing, ["19 --xs-ink-soft 2.73", "19 --xs-muted 2.73"]);
  });

  it("read at 4.5:1 in the dark on both dark grounds, in every light look", () => {
    for (const look of LOOKS.filter((l) => !NATIVE_DARK_LOOKS.includes(l))) {
      const values = darkTokensOf(tokens(look));
      assert.deepEqual(tooLight(look, values, [DARK.ground, DARK.tint]), [], `look ${look}`);
      for (const [name, value] of Object.entries(values)) {
        if (!name.endsWith("-text")) continue;
        for (const ground of [DARK.ground, DARK.tint]) assert.ok(contrast(value, ground) >= 4.5, `look ${look} ${name} ${value} on ${ground}`);
      }
      // The footer's words: on the look's own dark band, and on a footer that was light and is now the tint.
      const band = tokens(look)["--xs-dark"]?.trim();
      if (band && parseColor(band)) assert.ok(contrast(values["--xs-footer-ink"], band) >= 4.5, `look ${look} footer on ${band}`);
      assert.ok(contrast(values["--xs-footer-ink"], DARK.tint) >= 4.5, `look ${look} footer on the tint`);
    }
  });

  it("keep the dashboard's count of too-light words in step with the storefront's shades", () => {
    const block = read("../../../merchant-dashboard/src/pages/website/editor/TemplateLookBlock.tsx");
    const counts = JSON.parse(/TOO_LIGHT: Record<string, number> = (\{[^}]*\})/.exec(block)[1]);
    assert.deepEqual(counts, Object.fromEntries(Object.entries(XS_READABLE).map(([look, shades]) => [look, Object.keys(shades).length])));
  });
});

describe("the dark copies of the looks' rules", () => {
  it("turn literal light grounds, dark words, light lines and white veils dark", () => {
    assert.deepEqual(dark(decl("background", "#fff")), { background: "var(--xs-ground)" });
    assert.deepEqual(dark(decl("background-color", "#f5f5f5")), { "background-color": "var(--xs-tint)" });
    assert.deepEqual(dark(decl("background", "linear-gradient(to top, rgba(255, 255, 255, 0.8), transparent)")), {
      background: "linear-gradient(to top, rgba(20, 20, 20, 0.8), transparent)",
    });
    assert.deepEqual(dark(decl("color", "#222")), { color: "var(--xs-ink)" });
    assert.deepEqual(dark(decl("color", "#888")), { color: "var(--xs-ink-soft)" });
    assert.deepEqual(dark(decl("border-bottom", "1px solid #e5e5e5")), { "border-bottom": "1px solid var(--xs-line)" });
    // A red word stays red, light enough to read.
    const red = dark(decl("color", "#c0392b")).color;
    assert.ok(contrast(red, DARK.tint) >= 4.5 && parseColor(red)[0] > parseColor(red)[2]);
  });

  it("read a rule whole: words on a coloured ground, the template's ink as a ground", () => {
    // A yellow button with ink words keeps the light-mode ink (the ink itself turns light).
    assert.deepEqual(dark(decl("background", "var(--xs-button)"), decl("color", "var(--xs-ink)")), { color: "var(--xs-ink-day, var(--xs-ink))" });
    // The template's ink under white words stays a dark ground.
    assert.deepEqual(dark(decl("background", "var(--xs-ink)"), decl("color", "#fff")), { background: "var(--xs-ink-solid, var(--xs-ink))" });
    // Ink under words in the ground: a pair that flips by itself.
    assert.deepEqual(dark(decl("background", "var(--xs-ink)"), decl("color", "var(--xs-ground, #fff)")), {});
    // An accent as words on the ground is lightened; its fallback stays its own.
    assert.deepEqual(dark(decl("color", "var(--xs-brand, var(--xs-accent))")), {
      color: "var(--xs-brand-text, var(--xs-brand, var(--xs-accent-text, var(--xs-accent))))",
    });
    // White words, words on a dark band, and anything already in the tokens: nothing to copy.
    assert.deepEqual(dark(decl("color", "#fff")), {});
    assert.deepEqual(dark(decl("background", "var(--xs-dark)"), decl("color", "#999")), {});
    assert.deepEqual(dark(decl("background", "var(--xs-ground, #fff)"), decl("color", "var(--xs-ink)")), {});
  });

  it("leave a var's fallback to its token", () => {
    assert.equal(mapValue("var(--xs-ground, #fff) #fff", { colour: () => "X" }), "var(--xs-ground, #fff) X");
  });

  it("keep each rule's specificity, hung from the dark store wrapper, inside the same @media", () => {
    assert.equal(darkSelector('[data-xs-look="05"] .xs-card'), ':where(.brand-theme[data-color-mode="dark"]) [data-xs-look="05"] .xs-card');
    assert.equal(darkSelector(".brand-theme[data-xs-shell] > :not([data-xs-look])"), '.brand-theme:where([data-color-mode="dark"])[data-xs-shell] > :not([data-xs-look])');
    assert.equal(darkSelector("html body"), null);
    const css = darkRulesOf("@media (max-width: 991px) { .xs-card { background: #fff; padding: 4px } .xs-x { color: var(--xs-ink) } }");
    assert.match(css, /^@media \(max-width: 991px\) \{\s*:where\(\.brand-theme\[data-color-mode="dark"\]\) \.xs-card \{\s*background: var\(--xs-ground\)\s*\}\s*\}$/);
  });

  it("leave the templates that are dark already as they are", () => {
    const css = xsDarkSource();
    for (const look of NATIVE_DARK_LOOKS) {
      assert.doesNotMatch(css, new RegExp(`\\[data-xs-shell="${look}"\\]`));
      assert.doesNotMatch(css, new RegExp(`\\[data-xs-look="${look}"\\]`));
    }
    for (const look of LOOKS.filter((l) => !NATIVE_DARK_LOOKS.includes(l))) {
      assert.match(css, new RegExp(`\\.brand-theme\\[data-color-mode="dark"\\]\\[data-xs-shell="${look}"\\]`));
    }
    // A store's own brand colour as words: from the shade the layout works out.
    assert.match(xsDarkCss({ shared: "", looks: { "01": "" }, baseTokens: BASE }), /--xs-brand-text: var\(--xs-own-accent-text,/);
  });

  it("are the file the store links, built from the sources as they are now", () => {
    const bundles = xsLookBundles();
    assert.equal(manifest.dark, `/xs/dark.${hashOf(bundles.dark)}.css`, "the dark file is stale: run node scripts/xs-look-css.mjs");
    assert.ok(existsSync(new URL(`../../public${manifest.dark}`, import.meta.url)));
  });
});

describe("the store's colour mode", () => {
  it("is drawn by the server on the store wrapper, and the dark file is linked only by a store that can be dark", () => {
    const layout = read("./store/[workspaceId]/layout.tsx");
    assert.match(layout, /data-color-mode=\{dark \? "dark" : undefined\}/);
    assert.match(layout, /\{colorOptions\.capable && <XsDarkStyles \/>\}/);
    assert.match(layout, /const colorMode = await getStoreColorMode\(store\);/);
  });
});
