import { describe, expect, it } from "vitest";
import { THEME_SPECS } from "../editor/storeThemes";
import { buildXsTemplates } from "../templates/xs/xsTemplates";
import { takeTemplateLook, templateStoreTheme, templateXsLook, withTemplateTheme } from "./templateLook";

describe("the theme a template wears", () => {
  it("is read from its styles", () => {
    expect(templateStoreTheme({ themeSettings: { storeTheme: "warm" } })).toBe("warm");
  });

  it("is none for a template that brings none, or names something that is not a theme", () => {
    for (const styles of [undefined, null, {}, { primaryColor: "#7C2D12" }, { themeSettings: {} }, { themeSettings: { storeTheme: "original" } }, { themeSettings: { storeTheme: "neon" } }, { themeSettings: "warm" }]) {
      expect(templateStoreTheme(styles)).toBeNull();
    }
  });

  it("is none for every template written here: each wears its own look instead", () => {
    for (const template of buildXsTemplates()) {
      expect(templateStoreTheme(template.version.globalStyles), template.key).toBeNull();
      expect(templateXsLook(template.version.globalStyles), template.key).toBe(template.key.replace(/^xs-/, "").slice(0, 2));
    }
  });
});

describe("the look a template's preview is drawn in", () => {
  const asked = { primaryColor: "#7C2D12" };

  it("is the template's theme with the theme's own two accents, whatever was asked for", () => {
    const { light, dark } = THEME_SPECS.classic.palette;
    const classic = { storeTheme: "classic", primaryColor: light.accent, primaryColorDark: dark.accent };
    const styles = { primaryColor: "#7C2D12", themeSettings: { storeTheme: "classic" } };
    expect(withTemplateTheme(asked, styles)).toEqual(classic);
    // A store with a look of its own asks for nothing: the template is still shown as itself.
    expect(withTemplateTheme(null, styles)).toEqual(classic);
  });

  it("is the look asked for, or none, when the template brings no theme", () => {
    expect(withTemplateTheme(asked, { primaryColor: "#7C2D12" })).toBe(asked);
    expect(withTemplateTheme(null, { primaryColor: "#7C2D12" })).toBeNull();
  });

  it("is the look asked for for every template written here, none of which brings a theme", () => {
    for (const template of buildXsTemplates()) {
      expect(withTemplateTheme(asked, template.version.globalStyles), template.key).toBe(asked);
    }
  });
});

describe("a store taking a template's look", () => {
  const styles = { primaryColor: "#1F3A5F", themeSettings: { storeTheme: "classic", footer: { layout: "rich" } } };

  it("takes the theme and the fuller footer, and the colour marked as the template's", () => {
    expect(takeTemplateLook({}, styles, "#1F3A5F")).toEqual({
      storeTheme: "classic",
      footer: { layout: "rich" },
      primaryColor: "#1F3A5F",
      primaryColorSource: "template",
    });
  });

  it("keeps what the store already wrote in its footer and everything the template does not name", () => {
    const current = { productCountdownHours: 6, footer: { text: "Open every day", groups: [{ title: "Help", links: [] }] }, header: { sticky: false } };
    expect(takeTemplateLook(current, styles, "#1F3A5F")).toEqual({
      productCountdownHours: 6,
      header: { sticky: false },
      footer: { text: "Open every day", groups: [{ title: "Help", links: [] }], layout: "rich" },
      storeTheme: "classic",
      primaryColor: "#1F3A5F",
      primaryColorSource: "template",
    });
    // The store's own settings are not written into.
    expect(current.footer).not.toHaveProperty("layout");
  });

  it("takes the colour alone from a template with no look in its styles", () => {
    for (const plain of [{ primaryColor: "#7C2D12" }, { primaryColor: "#7C2D12", themeSettings: "warm" }, undefined]) {
      expect(takeTemplateLook({ fontFamily: "modern" }, plain, "#7C2D12")).toEqual({ fontFamily: "modern", primaryColor: "#7C2D12", primaryColorSource: "template" });
    }
  });
});
