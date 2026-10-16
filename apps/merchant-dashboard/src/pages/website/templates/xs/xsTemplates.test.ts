import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BLOCK_PRESETS } from "../../editor/blocks";
import { buildXsTemplates } from "./xsTemplates";

/**
 * The imported templates as they are built, held equal to the files that are
 * checked in beside this test — what the platform console (or the backend's
 * scripts/load-xs-templates.js) takes. Run with UPDATE_XS_TEMPLATES=1 to
 * write the files instead of comparing them.
 */

const GENERATED = fileURLToPath(new URL("./generated/", import.meta.url));
const ART = fileURLToPath(new URL("../../../../../../storefront/public/xs/", import.meta.url));
const WRITE = process.env.UPDATE_XS_TEMPLATES === "1";

const templates = buildXsTemplates();
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

function elementsOf(template: (typeof templates)[number]) {
  return template.version.pages.flatMap((page) =>
    page.builderData.sections.flatMap((section) => section.rows.flatMap((row) => row.columns.flatMap((column) => column.elements)))
  );
}

/** Every string in a value, however deep. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("the imported (xs) templates", () => {
  it("each bring a home page made of their own look's bands, and that look as the store's shell", () => {
    for (const template of templates) {
      // "xs-01b" is another home page of look 01.
      const look = template.key.replace(/^xs-/, "").slice(0, 2);
      const elements = elementsOf(template);
      expect(elements.length, template.key).toBeGreaterThan(0);
      for (const element of elements) {
        expect(element.type.startsWith("xs_"), `${template.key}: ${element.type}`).toBe(true);
        expect((element.props as { look?: string }).look, template.key).toBe(look);
      }
      expect(template.version.globalStyles.themeSettings.xsLook, template.key).toBe(look);
    }
  });

  it("offer the same bands as blocks in the editor's library", () => {
    const presetTypes = new Set(BLOCK_PRESETS.filter((preset) => preset.key.startsWith("xs-")).flatMap((preset) => preset.elements));
    for (const template of templates) {
      for (const element of elementsOf(template)) expect(presetTypes.has(element.type), element.type).toBe(true);
    }
  });

  it("name no picture the storefront does not carry", () => {
    for (const template of templates) {
      const pictures = strings(template.version).filter((value) => value.startsWith("/xs/"));
      expect(pictures.length, template.key).toBeGreaterThan(0);
      for (const picture of pictures) expect(existsSync(join(ART, picture.slice("/xs/".length))), picture).toBe(true);
    }
  });

  it("come in Arabic too, right to left, with no English word left on show", () => {
    const english = templates.filter((template) => !template.rtl);
    for (const template of english) {
      const arabic = templates.find((t) => t.key === `${template.key}-ar`);
      expect(arabic, `${template.key} has no Arabic template`).toBeDefined();
      expect(arabic!.rtl).toBe(true);
      // Shown words only: settings, addresses, e-mail addresses and phone numbers stay as they are.
      const shown = (value: unknown, key = ""): string[] => {
        if (/^(look|variant|layout|image|images|icon|kind|url|collection|align|headingWeight|imageRatio|imageFit|endsAt|xsLook|primaryColor|primaryColorSource|id|type|width|padding|pageType|path)$/.test(key) || /(Href|href|Color|Url)$/.test(key)) return [];
        if (typeof value === "string") return [value];
        if (Array.isArray(value)) return value.flatMap((item) => shown(item, key));
        if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => shown(v, k));
        return [];
      };
      const left = shown(arabic!.version).filter((text) => /[A-Za-z]{3}/.test(text) && !/[؀-ۿ]/.test(text) && !/@|^\+?[\d\s()-]+$/.test(text));
      expect(left, arabic!.key).toEqual([]);
    }
  });

  it("hold each template exactly as it is built", () => {
    if (WRITE) mkdirSync(GENERATED, { recursive: true });
    for (const template of templates) {
      const file = join(GENERATED, `${template.key}.json`);
      const content = `${JSON.stringify(template, null, 2)}\n`;
      if (WRITE) writeFileSync(file, content, "utf8");
      expect(existsSync(file), file).toBe(true);
      expect(read(file), template.key).toBe(content);
    }
  });
});
