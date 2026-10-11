import { describe, expect, it } from "vitest";
import { buildStoreTemplates } from "../templates/storeTemplates";
import { takeTemplateLook, templateStoreTheme, withTemplateTheme } from "./templateLook";

describe("the theme a template wears", () => {
  it("is read from its styles", () => {
    expect(templateStoreTheme({ themeSettings: { storeTheme: "warm" } })).toBe("warm");
  });

  it("is none for a template that brings none, or names something that is not a theme", () => {
    for (const styles of [undefined, null, {}, { primaryColor: "#7C2D12" }, { themeSettings: {} }, { themeSettings: { storeTheme: "original" } }, { themeSettings: { storeTheme: "neon" } }, { themeSettings: "warm" }]) {
      expect(templateStoreTheme(styles)).toBeNull();
    }
  });

  it("is one of the storefront's for every template written here", () => {
    for (const template of buildStoreTemplates()) {
      expect(templateStoreTheme(template.version.globalStyles)).toBe(template.version.globalStyles.themeSettings.storeTheme);
    }
  });
});

describe("the look a template's preview is drawn in", () => {
  const asked = { primaryColor: "#7C2D12" };

  it("is the template's theme alone, since a theme keeps its own accent", () => {
    expect(withTemplateTheme(asked, { primaryColor: "#7C2D12", themeSettings: { storeTheme: "classic" } })).toEqual({ storeTheme: "classic" });
  });

  it("is the look asked for when the template brings no theme", () => {
    expect(withTemplateTheme(asked, { primaryColor: "#7C2D12" })).toBe(asked);
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
