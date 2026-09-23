import { describe, expect, it } from "vitest";
import {
  BLOCK_GROUPS,
  BLOCK_PRESETS,
  COLUMN_SETTING_SPECS,
  ROW_SETTING_SPECS,
  SECTION_SETTING_SPECS,
  columnSetting,
  createSection,
  insertSection,
  rowSetting,
  sectionElements,
  sectionIcon,
  sectionLabel,
  sectionSetting,
  setColumnSetting,
  setRowSetting,
  setSectionSetting,
  type BlockPreset,
  type SectionSettingSpec,
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

/** Every preset with a column layout, paired with its key for `it.each`. */
const LAID_OUT = BLOCK_PRESETS.filter((p) => p.rows).map((preset) => [preset.key, preset] as const);

/** A settings object only uses keys the given specs know, with values they offer. */
function expectKnownSettings(settings: Record<string, unknown> | undefined, specs: SectionSettingSpec[], where: string) {
  for (const key of Object.keys(settings ?? {})) {
    const spec = specs.find((s) => s.key === key);
    expect(spec, `${where}.${key}`).toBeDefined();
    expect(spec!.options.map((o) => o.value), `${where}.${key}`).toContain(settings![key]);
  }
}

describe("BLOCK_PRESETS", () => {
  it("offers a section library, not just bare elements", () => {
    // The point of the library: a merchant should never have to build a
    // section from a heading, a text and a button by hand.
    expect(LAID_OUT.length).toBeGreaterThanOrEqual(28);
  });

  it("gives every laid-out preset rows whose spans add up to the 12-column grid", () => {
    for (const [key, preset] of LAID_OUT) {
      expect(preset.rows!.length, key).toBeGreaterThan(0);
      preset.rows!.forEach((row, r) => {
        expect(row.columns.length, `${key} row ${r}`).toBeGreaterThan(0);
        const total = row.columns.reduce((n, col) => n + col.span, 0);
        expect(total, `${key} row ${r}`).toBe(12);
        for (const col of row.columns) {
          expect(Number.isInteger(col.span) && col.span >= 1 && col.span <= 12, `${key} row ${r}`).toBe(true);
          expect(col.elements.length, `${key} row ${r}`).toBeGreaterThan(0);
        }
      });
    }
  });

  it("keeps a laid-out preset's flattened elements equal to its rows, in document order", () => {
    for (const [key, preset] of LAID_OUT) {
      const flat = preset.rows!.flatMap((row) => row.columns.flatMap((col) => col.elements));
      expect(preset.elements, key).toEqual(flat);
      // `content` lives on the columns for these; a top-level one would be ignored.
      expect(preset.content, key).toBeUndefined();
    }
  });

  it("aligns each column's starting content with that column's elements", () => {
    for (const [key, preset] of LAID_OUT) {
      for (const row of preset.rows!) {
        for (const col of row.columns) {
          if (col.content) expect(col.content.length, key).toBeLessThanOrEqual(col.elements.length);
        }
      }
    }
  });

  it("only sets column and row settings the storefront knows how to read", () => {
    for (const [key, preset] of LAID_OUT) {
      preset.rows!.forEach((row, r) => {
        expectKnownSettings(row.settings, ROW_SETTING_SPECS, `${key} row ${r}`);
        row.columns.forEach((col, c) => {
          expectKnownSettings(col.settings, COLUMN_SETTING_SPECS, `${key} row ${r} column ${c}`);
        });
      });
    }
  });

  it("ships starting copy as instructions to the merchant, never as claims", () => {
    // Every string a laid-out preset starts with is either a prompt ("اكتب…"),
    // a section title, a button label or a link — never a number, a name or
    // a quote the store would appear to be making.
    for (const [key, preset] of LAID_OUT) {
      for (const row of preset.rows!) {
        for (const col of row.columns) {
          col.elements.forEach((type, i) => {
            const content = col.content?.[i];
            if (!content) return;
            if (type === "testimonial") {
              expect(content.quote, key).toBe("");
              expect(content.author, key).toBe("");
              expect(content.rating, key).toBe(0);
            }
            if (type === "image") expect(content.src ?? "", key).toBe("");
            if (type === "social_icons") expect(content.links, key).toEqual([]);
            if (type === "gallery") expect(content.images, key).toEqual([]);
            if (type === "map") expect(content.address, key).toBe("");
            // Western digits would be a statistic or a price; the numbered
            // steps use Arabic-Indic ordinals, which are labels, not data.
            for (const value of Object.values(content)) {
              if (typeof value === "string") expect(value, `${key}: ${value}`).not.toMatch(/[0-9]/);
            }
          });
        }
      }
    }
  });

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
  it.each(BLOCK_PRESETS.filter((p) => !p.rows).map((preset) => [preset.key, preset] as const))(
    "%s builds a one-column tree the backend accepts",
    (_key, preset) => {
      const section = createSection(preset);

      expect(section.type).toBe("section");
      expect(section.id).not.toBe("");
      expect(section.rows).toHaveLength(1);

      const [row] = section.rows;
      expect(row.type).toBe("row");
      expect(row.id).toBe(`${section.id}-r`);
      expect(row.columns).toHaveLength(1);

      const [column] = row.columns;
      expect(column.type).toBe("column");
      expect(column.id).toBe(`${section.id}-c`);
      expect(column.span).toBe(12);
      expect(column.elements.map((el) => el.type)).toEqual(preset.elements);

      for (const element of column.elements) {
        expect([...ALLOWED_ELEMENT_TYPES]).toContain(element.type);
        expect(element.id).not.toBe("");
        expect(element.props).toBeTypeOf("object");
      }
    }
  );

  it.each(LAID_OUT)("%s builds its rows and columns the way the seeder numbers them", (_key, preset) => {
    const section = createSection(preset);

    expect(section.type).toBe("section");
    expect(section.rows).toHaveLength(preset.rows!.length);

    section.rows.forEach((row, r) => {
      const wanted = preset.rows![r];
      expect(row.type).toBe("row");
      expect(row.id).toBe(`${section.id}-r${r + 1}`);
      expect(row.columns).toHaveLength(wanted.columns.length);
      if (wanted.settings) expect((row as { settings?: unknown }).settings).toEqual(wanted.settings);
      else expect((row as { settings?: unknown }).settings).toBeUndefined();

      row.columns.forEach((column, c) => {
        const spec = wanted.columns[c];
        expect(column.type).toBe("column");
        expect(column.id).toBe(`${section.id}-r${r + 1}-c${c + 1}`);
        expect(column.span).toBe(spec.span);
        expect(column.elements.map((el) => el.type)).toEqual(spec.elements);
        if (spec.settings) expect((column as { settings?: unknown }).settings).toEqual(spec.settings);
        else expect((column as { settings?: unknown }).settings).toBeUndefined();

        for (const element of column.elements) {
          expect([...ALLOWED_ELEMENT_TYPES]).toContain(element.type);
          expect(element.id).not.toBe("");
          expect(element.props).toBeTypeOf("object");
        }
      });
    });

    // The flattened view is what the inspector and the storefront both walk.
    expect(sectionElements(section).map((el) => el.type)).toEqual(preset.elements);
  });

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

  it.each(LAID_OUT)("%s applies each column's starting content over the element defaults", (_key, preset) => {
    const section = createSection(preset);
    section.rows.forEach((row, r) => {
      row.columns.forEach((column, c) => {
        const spec = preset.rows![r].columns[c];
        spec.content?.forEach((content, i) => {
          if (!content) return;
          for (const [key, value] of Object.entries(content)) {
            expect(column.elements[i].props?.[key], `${preset.key} r${r + 1}c${c + 1}[${i}].${key}`).toEqual(value);
          }
        });
      });
    });
  });

  it("names a laid-out section after its preset, and its one-column twin after the first match", () => {
    const split = BLOCK_PRESETS.find((p) => p.key === "hero-split")!;
    const section = createSection(split);
    expect(sectionLabel(section)).toBe(split.label);
    expect(sectionLabel(section, "ar")).toBe(presetText(split.key, split, "ar").label);
    expect(sectionIcon(section)).toBe(split.icon);

    // The same elements in a single column are still recognisable by shape.
    const flat: BlockPreset = { ...split, rows: undefined };
    expect(sectionLabel(createSection(flat))).toBe(split.label);
  });

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

describe("setColumnSetting / setRowSetting", () => {
  const section = createSection(BLOCK_PRESETS.find((p) => p.key === "image-text")!);
  const [row] = section.rows;
  const [picture, copy] = row.columns;

  it("writes a non-default choice onto that column alone", () => {
    const next = setColumnSetting(section, copy.id, "surface", "card");
    const [, nextCopy] = next.rows[0].columns;
    expect(columnSetting(nextCopy, "surface")).toBe("card");
    // The preset's own verticalAlign survives next to it.
    expect(columnSetting(nextCopy, "verticalAlign")).toBe("center");
    expect(next.rows[0].columns[0]).toBe(picture);
    expect(section.rows[0].columns[1]).toBe(copy);
  });

  it("drops the key on the default, and the object once nothing is left", () => {
    const styled = setColumnSetting(section, picture.id, "surface", "card");
    const back = setColumnSetting(styled, picture.id, "surface", "none");
    expect(columnSetting(back.rows[0].columns[0], "surface")).toBe("");
    const bare = setColumnSetting(back, picture.id, "verticalAlign", "");
    expect((bare.rows[0].columns[0] as { settings?: unknown }).settings).toBeUndefined();
  });

  it("gives a row its gap the same way", () => {
    expect(rowSetting(row, "gap")).toBe("");
    const loose = setRowSetting(section, row.id, "gap", "loose");
    expect(rowSetting(loose.rows[0], "gap")).toBe("loose");
    expect((setRowSetting(loose, row.id, "gap", "normal").rows[0] as { settings?: unknown }).settings).toBeUndefined();
  });

  it("leaves the section alone for an id it doesn't have", () => {
    expect(setColumnSetting(section, "nope", "surface", "card").rows[0].columns).toEqual(row.columns);
    expect(setRowSetting(section, "nope", "gap", "tight").rows[0]).toBe(row);
  });
});

describe("insertSection", () => {
  const preset = BLOCK_PRESETS[0];
  const page = [createSection(preset), createSection(preset), createSection(preset)];
  const ids = (sections: typeof page) => sections.map((s) => s.id);

  it("puts the new section at the chosen position", () => {
    const added = createSection(preset);
    expect(ids(insertSection(page, added, 0))).toEqual([added.id, ...ids(page)]);
    expect(ids(insertSection(page, added, 1))).toEqual([page[0].id, added.id, page[1].id, page[2].id]);
    expect(ids(insertSection(page, added, 3))).toEqual([...ids(page), added.id]);
  });

  it("appends when no position is given, as the library always did", () => {
    const added = createSection(preset);
    expect(ids(insertSection(page, added))).toEqual([...ids(page), added.id]);
    expect(ids(insertSection([], added))).toEqual([added.id]);
  });

  it("clamps a position outside the page instead of dropping the section", () => {
    const added = createSection(preset);
    expect(ids(insertSection(page, added, 99))).toEqual([...ids(page), added.id]);
    expect(ids(insertSection(page, added, -4))).toEqual([added.id, ...ids(page)]);
    expect(ids(insertSection(page, added, 1.7))).toEqual([page[0].id, added.id, page[1].id, page[2].id]);
    expect(ids(insertSection(page, added, Number.NaN))).toEqual([...ids(page), added.id]);
  });

  it("never mutates the page it was given", () => {
    const before = ids(page);
    insertSection(page, createSection(preset), 1);
    expect(ids(page)).toEqual(before);
  });
});
