/// <reference types="node" />
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { IMAGE_RATIOS } from "../editor/blocks";
import { STORE_THEMES } from "../editor/storeThemes";
import { buildStoreTemplates, buildTemplateArt, type StoreTemplate } from "./storeTemplates";
import { elementsOf, pictureSlots, templateProblems } from "./templateRules";

/**
 * The store templates as they are built, held to their rules, and held equal
 * to the files that are checked in: one JSON file per template beside this
 * test, and the stand-in pictures in the storefront's public folder. Those
 * files are what the server's migration and the storefront read, so a change
 * to a definition that is not written out (`npm run templates:build`) fails
 * here rather than going unnoticed.
 */

const GENERATED = fileURLToPath(new URL("./generated/", import.meta.url));
/** Each template's version alone, as the platform console's "add version" takes it. */
const CONSOLE = fileURLToPath(new URL("./generated/console/", import.meta.url));
const ART = fileURLToPath(new URL("../../../../../storefront/public/template-art/", import.meta.url));
/** `npm run templates:build` sets it: the files are written instead of compared. */
const WRITE = process.env.UPDATE_STORE_TEMPLATES === "1";

const templates = buildStoreTemplates();
const art = buildTemplateArt();
const artNames = art.map((a) => a.file);
const fileOf = (template: StoreTemplate) => `${JSON.stringify(template, null, 2)}\n`;
/** A checkout on Windows may hand the file back with CRLF line ends. */
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/** Writes (in writing mode) or compares each file, and leaves no file in `dir` that is not one of them. */
function holdFolder(dir: string, files: Array<{ name: string; content: string }>, ending: string) {
  if (WRITE) {
    mkdirSync(dir, { recursive: true });
    for (const stale of readdirSync(dir).filter((name) => name.endsWith(ending) && !files.some((f) => f.name === name))) rmSync(join(dir, stale));
    for (const file of files) writeFileSync(join(dir, file.name), file.content, "utf8");
  }
  expect(existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(ending)).sort() : []).toEqual(files.map((f) => f.name).sort());
  for (const file of files) expect(read(join(dir, file.name)), file.name).toBe(file.content);
}

describe("the store templates", () => {
  it("are the four of this round, each on a theme of its own", () => {
    expect(templates.map((t) => t.key)).toEqual(["home-living", "drinks", "departments", "single-product"]);
    const themes = templates.map((t) => t.version.globalStyles.themeSettings.storeTheme);
    expect(new Set(themes).size).toBe(themes.length);
    for (const theme of themes) expect(STORE_THEMES).toContain(theme);
    expect(new Set(templates.map((t) => t.name)).size).toBe(templates.length);
  });

  it("build the same data every time", () => {
    expect(JSON.stringify(buildStoreTemplates())).toBe(JSON.stringify(templates));
    expect(buildTemplateArt()).toEqual(art);
  });

  it.each(templates.map((t) => [t.key, t] as const))("%s keeps every rule", (_key, template) => {
    expect(templateProblems(template, artNames)).toEqual([]);
  });

  it.each(templates.map((t) => [t.key, t] as const))("%s has a home page and two more, read right to left", (_key, template) => {
    expect(template.rtl).toBe(true);
    expect(template.version.pages.map((p) => p.pageType)).toEqual(["home", "static", "static"]);
    expect(template.version.pages[0].builderData.sections.length).toBeGreaterThanOrEqual(6);
  });

  it("carry a theme and the fuller footer, and no header menu", () => {
    for (const template of templates) {
      const look = template.version.globalStyles.themeSettings as Record<string, unknown>;
      expect(Object.keys(look).sort()).toEqual(["footer", "storeTheme"]);
      expect(look.footer).toEqual({ layout: "rich" });
      expect(look.header).toBeUndefined();
    }
  });

  it("give every picture a box of its own", () => {
    for (const template of templates) {
      for (const page of template.version.pages) {
        const slots = pictureSlots(page.path, page.builderData);
        // A picture in a band or a grid takes that one's box; a picture on its own names a shape.
        for (const element of elementsOf(page.builderData).filter((e) => e.type === "image")) {
          expect(IMAGE_RATIOS.map((r) => r.value), element.id).toContain(element.props?.ratio);
        }
        for (const slot of slots) expect(slot.url, slot.elementId).toMatch(/^\/template-art\/[a-z0-9-]+\.svg$/);
      }
    }
    expect(templates.flatMap((t) => t.version.pages.flatMap((p) => pictureSlots(p.path, p.builderData))).length).toBeGreaterThan(20);
  });

  it("name every drawing that is made, and no other", () => {
    const named = new Set(templates.flatMap((t) => t.version.pages.flatMap((p) => pictureSlots(p.path, p.builderData).map((s) => s.url.split("/").pop()))));
    expect([...named].sort()).toEqual([...artNames].sort());
  });

  it("write a sound page tree: unique ids named by place, and the editor's default props under every element", () => {
    for (const template of templates) {
      for (const page of template.version.pages) {
        const ids = JSON.stringify(page.builderData).match(/"id":"[^"]+"/g) ?? [];
        expect(new Set(ids).size).toBe(ids.length);
        for (const section of page.builderData.sections) expect(section.id).toMatch(/^[a-z]+-\d+-[a-z0-9-]+$/);
      }
    }
    const home = templates[1].version.pages[0].builderData;
    const cards = elementsOf(home).find((e) => e.type === "product_cards");
    // Set by the template, and left as the editor starts them.
    expect(cards?.props).toMatchObject({ heading: "الأكتر طلبًا", limit: 8, columns: 4, showDiscount: true, tone: "plain", collection: "" });
  });
});

describe("the rules a template is held to", () => {
  const broken = (change: (template: StoreTemplate) => void): string[] => {
    const template = structuredClone(templates[0]);
    change(template);
    return templateProblems(template, artNames);
  };
  const firstImage = (template: StoreTemplate) => elementsOf(template.version.pages[0].builderData).find((e) => e.type === "image")!;

  it("refuse a picture without a shape", () => {
    expect(broken((t) => delete firstImage(t).props!.ratio).join("\n")).toMatch(/names no shape/);
  });

  it("refuse a picture that is not one of our drawings, and any address outside the store", () => {
    expect(broken((t) => (firstImage(t).props!.src = "/uploads/photo.jpg")).join("\n")).toMatch(/not one of our own drawings/);
    expect(broken((t) => (firstImage(t).props!.src = "https://example.com/photo.jpg")).join("\n")).toMatch(/outside the store/);
    expect(broken((t) => (firstImage(t).props!.src = "/template-art/missing.svg")).join("\n")).toMatch(/no drawing is made/);
  });

  it("refuse a header menu, or anything else, in the look", () => {
    expect(broken((t) => Object.assign(t.version.globalStyles.themeSettings, { header: { menu: [] } })).join("\n")).toMatch(/a theme and the footer only/);
    expect(broken((t) => Object.assign(t.version.globalStyles.themeSettings.footer, { groups: [] })).join("\n")).toMatch(/fuller layout and nothing else/);
  });

  it("refuse a row that does not add up to twelve, a repeated id, and words that are not Arabic", () => {
    const tree = (t: StoreTemplate) => t.version.pages[0].builderData;
    expect(broken((t) => (tree(t).sections[0].rows[0].columns[0].span = 5)).join("\n")).toMatch(/add up to 12/);
    expect(broken((t) => (tree(t).sections[1].id = tree(t).sections[0].id)).join("\n")).toMatch(/used twice/);
    expect(broken((t) => (elementsOf(tree(t))[0].props!.text = "Welcome to the shop")).join("\n")).toMatch(/not in Arabic/);
  });

  it("refuse a review card that could pass for a review: stars, a name, or words that are not a prompt", () => {
    const review = (t: StoreTemplate) => elementsOf(t.version.pages[0].builderData).find((e) => e.type === "testimonial")!;
    expect(review(templates[0]).props).toMatchObject({ rating: 0, author: "" });
    expect(broken((t) => (review(t).props!.rating = 5)).join("\n")).toMatch(/carries no stars/);
    expect(broken((t) => (review(t).props!.author = "منى ع.")).join("\n")).toMatch(/names no one/);
    expect(broken((t) => (review(t).props!.quote = "منتج ممتاز ووصل بسرعة")).join("\n")).toMatch(/only says what to write/);
  });

  it("refuse a link to a page the template does not bring", () => {
    const button = (t: StoreTemplate) => elementsOf(t.version.pages[0].builderData).find((e) => e.type === "button")!;
    expect(broken((t) => (button(t).props!.href = "/sale")).join("\n")).toMatch(/leads to no page/);
  });
});

describe("the generated files", () => {
  it("hold each template exactly as it is built", () => {
    holdFolder(GENERATED, templates.map((t) => ({ name: `${t.key}.json`, content: fileOf(t) })), ".json");
  });

  it("hold each template's version alone, ready to paste into the platform console", () => {
    holdFolder(CONSOLE, templates.map((t) => ({ name: `${t.key}.json`, content: `${JSON.stringify(t.version, null, 2)}\n` })), ".json");
    for (const template of templates) {
      const pasted = JSON.parse(read(join(CONSOLE, `${template.key}.json`))) as Record<string, unknown>;
      // Exactly the three keys the console's form expects.
      expect(Object.keys(pasted)).toEqual(["globalStyles", "pages", "sections"]);
    }
  });

  it("hold each stand-in picture exactly as it is drawn", () => {
    holdFolder(ART, art.map((a) => ({ name: a.file, content: a.svg })), ".svg");
  });

  it("are small, self-contained drawings of plain shapes", () => {
    for (const { file, svg } of art) {
      expect(svg, file).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="\d+" viewBox="0 0 \d+ \d+"/);
      // Nothing fetched, nothing run, no words to translate.
      expect(svg.replace('xmlns="http://www.w3.org/2000/svg"', ""), file).not.toMatch(/https?:|href|<image|<script|<text|<foreignObject|url\((?!#g\))/);
      expect(svg.length, file).toBeLessThan(4000);
    }
  });
});
