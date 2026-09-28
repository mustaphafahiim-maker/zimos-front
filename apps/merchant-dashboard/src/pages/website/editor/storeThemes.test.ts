/// <reference types="node" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MIN_TEXT_CONTRAST, checkAccent, contrastRatio } from "@/lib/contrast";
import {
  ORIGINAL_LOOK,
  STORE_THEMES,
  THEME_CHOICES,
  THEME_SPECS,
  accentGrounds,
  readThemeChoice,
  type ColorMode,
  type ThemePalette,
} from "./storeThemes";

/**
 * The dashboard draws the themes and checks the merchant's accent against
 * them, but the themes themselves are the storefront's stylesheet. These tests
 * read that stylesheet and hold the two together, so a colour changed on one
 * side can't leave the contrast warning measuring something shoppers never see.
 */

const storefront = (file: string) =>
  readFileSync(fileURLToPath(new URL(`../../../../../storefront/src/${file}`, import.meta.url)), "utf8");

const themesCss = storefront("app/store-themes.css");
const globalsCss = storefront("app/globals.css");

/** The custom properties declared in the first block whose selector is exactly `selector`. */
function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No block for ${selector}`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const vars: Record<string, string> = {};
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[match[1]] = match[2].trim();
  return vars;
}

function cssPalette(vars: Record<string, string>): Partial<Record<keyof ThemePalette, string>> {
  return {
    paper: vars["--color-paper"],
    raised: vars["--color-paper-raised"],
    ink: vars["--color-ink"],
    inkSoft: vars["--color-ink-soft"],
    line: vars["--color-line"],
    accent: vars["--brand-primary-default"],
    secondary: vars["--brand-secondary"],
  };
}

const upper = (palette: object) =>
  Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, typeof v === "string" ? v.toUpperCase() : v]));

describe("the dashboard's themes are the storefront's themes", () => {
  it("names the same six themes as the storefront", () => {
    const source = storefront("lib/brandTheme.ts");
    const declared = /export const STORE_THEMES = \[([^\]]+)\]/.exec(source)?.[1] ?? "";
    expect(declared.match(/"(\w+)"/g)?.map((k) => k.slice(1, -1))).toEqual([...STORE_THEMES]);
    for (const key of STORE_THEMES) expect(themesCss).toContain(`.brand-theme[data-store-theme="${key}"] {`);
    expect(THEME_CHOICES).toEqual([ORIGINAL_LOOK, ...STORE_THEMES]);
  });

  it("uses each theme's own colours, in both modes", () => {
    for (const key of STORE_THEMES) {
      const light = block(themesCss, `.brand-theme[data-store-theme="${key}"]`);
      const dark = block(themesCss, `.dark .brand-theme[data-store-theme="${key}"]`);
      expect(upper(THEME_SPECS[key].palette.light), `${key} light`).toEqual(upper(cssPalette(light)));
      expect(upper(THEME_SPECS[key].palette.dark), `${key} dark`).toEqual(upper(cssPalette(dark)));
    }
  });

  it("uses the stock palette for the original look", () => {
    const root = block(globalsCss, ":root");
    const dark = block(globalsCss, ".dark");
    const stock = (vars: Record<string, string>) => ({ ...cssPalette(vars), secondary: vars["--brand-secondary"] });
    expect(upper(THEME_SPECS.original.palette.light)).toEqual(upper(stock(root)));
    expect(upper(THEME_SPECS.original.palette.dark)).toEqual(upper(stock(dark)));
  });

  it("measures Glass against its panes as the stylesheet draws them", () => {
    const pct = (v: string) => Number(v.replace("%", "")) / 100;
    const light = block(themesCss, '.brand-theme[data-store-theme="glass"]');
    const dark = block(themesCss, '.dark .brand-theme[data-store-theme="glass"]');
    expect(THEME_SPECS.glass.glass).toEqual({
      light: { alpha: pct(light["--zt-glass-alpha"]), tint: pct(light["--zt-glass-tint"]) },
      dark: { alpha: pct(dark["--zt-glass-alpha"]), tint: pct(dark["--zt-glass-tint"]) },
    });
  });
});

describe("every theme reads well out of the box", () => {
  const modes: ColorMode[] = ["light", "dark"];

  it("keeps body and secondary text at AA on its page and cards", () => {
    for (const key of THEME_CHOICES) {
      for (const mode of modes) {
        const p = THEME_SPECS[key].palette[mode];
        for (const [fg, bg, label] of [
          [p.ink, p.paper, "ink/page"],
          [p.ink, p.raised, "ink/card"],
          [p.inkSoft, p.paper, "soft/page"],
          [p.inkSoft, p.raised, "soft/card"],
        ] as const) {
          expect(contrastRatio(fg, bg), `${key} ${mode} ${label}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
        }
      }
    }
  });

  it("gives every theme a default accent that passes its own check in both modes", () => {
    for (const key of THEME_CHOICES) {
      for (const mode of modes) {
        const accent = THEME_SPECS[key].palette[mode].accent;
        const check = checkAccent(accent, accentGrounds(key, mode, accent));
        expect(check.ok, `${key} ${mode}: ${JSON.stringify(check)}`).toBe(true);
      }
    }
  });
});

describe("accentGrounds", () => {
  it("is the page and the card for a solid theme", () => {
    expect(accentGrounds("classic", "light", "#1F3A5F")).toEqual({ page: "#F7F4EE", card: "#FFFFFF" });
  });

  it("follows the merchant's accent into Glass's tinted pane", () => {
    const violet = accentGrounds("glass", "dark", "#A594FF").card;
    const green = accentGrounds("glass", "dark", "#00C853").card;
    expect(violet).not.toBe(green);
    expect(accentGrounds("glass", "dark", "#A594FF").page).toBe("#070A14");
  });
});

describe("readThemeChoice", () => {
  it("reads only real themes, everything else is the original look", () => {
    expect(readThemeChoice("glass")).toBe("glass");
    expect(readThemeChoice("perfume")).toBe(ORIGINAL_LOOK);
    expect(readThemeChoice(undefined)).toBe(ORIGINAL_LOOK);
    expect(readThemeChoice(3)).toBe(ORIGINAL_LOOK);
  });
});
