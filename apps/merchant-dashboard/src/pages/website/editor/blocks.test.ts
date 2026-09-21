import { describe, expect, it } from "vitest";
import {
  BLOCK_GROUPS,
  BLOCK_PRESETS,
  SECTION_SETTING_SPECS,
  createSection,
  sectionElements,
  sectionSetting,
  setSectionSetting,
} from "./blocks";
import { presetText } from "./editorLocale";

/**
 * The block library is the one place in the app that *writes* a page tree, so
 * every preset has to land as a tree the backend will accept
 * (modules/pages/pageTree.js) — a strict section → row → column → element
 * shape whose element types are on a fixed allowlist. A preset that misses
 * either would only fail at save time, on the merchant's page.
 *
 * Copied from that file on purpose: importing PAGE_ELEMENT_TYPES would test
 * the editor against itself, and the allowlist is the contract.
 */
const ALLOWED_ELEMENT_TYPES = new Set([
  "heading",
  "text",
  "rich_text",
  "image",
  "gallery",
  "button",
  "video",
  "embed",
  "spacer",
  "divider",
  "icon",
  "list",
  "accordion",
  "faq",
  "testimonial",
  "countdown",
  "form",
  "map",
  "social_icons",
  "product_card",
  "product_list",
  "collection_list",
  "cart",
  "shader_hero",
  "product_3d",
  "orbit_gallery",
  "scroll_story",
  "marquee",
  "comparison",
]);

const SETTING_KEYS = new Set(SECTION_SETTING_SPECS.map((s) => s.key));

describe("BLOCK_PRESETS", () => {
  it("has unique keys and a known group for every preset", () => {
    const keys = BLOCK_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const preset of BLOCK_PRESETS) {
      expect(BLOCK_GROUPS).toContain(preset.group);
      expect(preset.elements.length).toBeGreaterThan(0);
    }
  });

  it("gives every preset an Arabic label and description", () => {
    for (const preset of BLOCK_PRESETS) {
      const ar = presetText(preset.key, preset, "ar");
      expect(ar.label, preset.key).not.toBe(preset.label);
      expect(ar.description, preset.key).not.toBe(preset.description);
    }
  });

  it("aligns any starting content with the preset's elements", () => {
    for (const preset of BLOCK_PRESETS) {
      if (!preset.content) continue;
      expect(preset.content.length, preset.key).toBeLessThanOrEqual(preset.elements.length);
    }
  });

  it("only sets section settings the storefront knows how to read", () => {
    for (const preset of BLOCK_PRESETS) {
      for (const key of Object.keys(preset.settings ?? {})) {
        expect([...SETTING_KEYS], preset.key).toContain(key);
        const spec = SECTION_SETTING_SPECS.find((s) => s.key === key)!;
        expect(spec.options.map((o) => o.value), `${preset.key}.${key}`).toContain(
          preset.settings![key]
        );
      }
    }
  });
});

describe("createSection", () => {
  it.each(BLOCK_PRESETS.map((preset) => [preset.key, preset] as const))(
    "%s builds a tree the backend accepts",
    (_key, preset) => {
      const section = createSection(preset);

      expect(section.type).toBe("section");
      expect(section.id).not.toBe("");
      expect(section.rows).toHaveLength(1);

      const [row] = section.rows;
      expect(row.type).toBe("row");
      expect(row.id).not.toBe("");
      expect(row.columns).toHaveLength(1);

      const [column] = row.columns;
      expect(column.type).toBe("column");
      expect(column.id).not.toBe("");
      expect(column.span).toBe(12);
      expect(column.elements.map((el) => el.type)).toEqual(preset.elements);

      for (const element of column.elements) {
        expect([...ALLOWED_ELEMENT_TYPES]).toContain(element.type);
        expect(element.id).not.toBe("");
        expect(element.props).toBeTypeOf("object");
      }
    }
  );

  it.each(BLOCK_PRESETS.filter((p) => p.content).map((preset) => [preset.key, preset] as const))(
    "%s applies its own starting content over the element defaults",
    (_key, preset) => {
      const elements = sectionElements(createSection(preset));

      preset.content!.forEach((content, i) => {
        if (!content) return;
        for (const [key, value] of Object.entries(content)) {
          expect(elements[i].props?.[key], `${preset.key}[${i}].${key}`).toEqual(value);
        }
      });
    }
  );

  it("applies a preset's section settings and leaves the rest without any", () => {
    for (const preset of BLOCK_PRESETS) {
      const section = createSection(preset);
      if (preset.settings) expect(section.settings).toEqual(preset.settings);
      else expect(section.settings).toBeUndefined();
    }
  });

  it("mints a fresh id every time, so two of the same preset can coexist", () => {
    const preset = BLOCK_PRESETS[0];
    expect(createSection(preset).id).not.toBe(createSection(preset).id);
  });

  it("starts the claims strip with instruction copy and a speed the storefront reads", () => {
    const preset = BLOCK_PRESETS.find((p) => p.key === "claims-strip")!;
    const [marquee] = sectionElements(createSection(preset));

    expect(marquee.type).toBe("marquee");
    const items = marquee.props?.items as string[];
    expect(items.length).toBeGreaterThan(1);
    // Starting copy tells the merchant what to write; it never claims anything.
    for (const item of items) expect(item).toContain("اكتب");
    expect(["slow", "normal", "fast"]).toContain(marquee.props?.speed);
    expect(["line", "primary"]).toContain(marquee.props?.tone);
  });

  it("starts the comparison preset with rows shaped the way the storefront reads them", () => {
    const preset = BLOCK_PRESETS.find((p) => p.key === "comparison")!;
    const table = sectionElements(createSection(preset)).find((el) => el.type === "comparison")!;

    expect(table.props?.usLabel).not.toBe("");
    expect(table.props?.themLabel).not.toBe("");

    const rows = table.props?.rows as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["label", "them", "us"]);
      // Every cell is a prompt to write, never a verdict about anyone else.
      expect(row.label).toContain("اكتب");
      expect(row.us).toContain("اكتب");
      expect(row.them).toContain("اكتب");
    }
  });

  it("starts the testimonials preset empty — a quote is a claim about a real person", () => {
    const preset = BLOCK_PRESETS.find((p) => p.key === "testimonials")!;
    const quotes = sectionElements(createSection(preset)).filter((el) => el.type === "testimonial");

    expect(quotes.length).toBeGreaterThan(0);
    for (const el of quotes) {
      expect(el.props?.quote).toBe("");
      expect(el.props?.author).toBe("");
      expect(el.props?.rating).toBe(0);
    }
  });
});

describe("setSectionSetting", () => {
  const plain = createSection(BLOCK_PRESETS.find((p) => p.key === "hero")!);

  it("stores a non-default choice without touching the rest of the section", () => {
    const next = setSectionSetting(plain, "background", "paper");
    expect(sectionSetting(next, "background")).toBe("paper");
    expect(next.rows).toBe(plain.rows);
    expect(plain.settings).toBeUndefined();
  });

  it("drops the key again when the default is chosen, leaving no settings behind", () => {
    const styled = setSectionSetting(plain, "background", "paper");
    expect(setSectionSetting(styled, "background", "none").settings).toBeUndefined();
    expect(setSectionSetting(styled, "background", "").settings).toBeUndefined();
  });

  it("keeps the other settings when one changes", () => {
    const both = setSectionSetting(
      setSectionSetting(plain, "background", "paper"),
      "padding",
      "roomy"
    );
    expect(both.settings).toEqual({ background: "paper", padding: "roomy" });
  });

  it("reads nothing out of a settings value of the wrong shape", () => {
    const odd = { ...plain, settings: "raised" as unknown as Record<string, unknown> };
    expect(sectionSetting(odd, "background")).toBe("");
  });
});
