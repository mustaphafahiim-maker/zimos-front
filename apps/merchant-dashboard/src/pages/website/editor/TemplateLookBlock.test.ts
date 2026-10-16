import { describe, expect, it } from "vitest";
import { lookToShellPreview, readStoreLook, sameShellParts } from "./storeLook";
import { TEMPLATE_FACES, readTemplateTokens, writeTemplateTokens } from "./TemplateLookBlock";

describe("TemplateLookBlock: one look for every section", () => {
  it("offers the storefront's faces, each with its Arabic partner", () => {
    expect(TEMPLATE_FACES.map((f) => f.key)).toEqual(["poppins", "playfair", "inter", "jost", "marcellus", "montserrat", "nunito", "opensans", "raleway", "roboto", "rubik", "lato", "syne", "cookie", "lalezar"]);
    for (const face of TEMPLATE_FACES) expect(face.label).toMatch(/·/);
  });

  it("saves only what differs from the template, nothing once all is the template's again", () => {
    expect(writeTemplateTokens({ display: "cookie", scale: 100, space: 100 })).toEqual({ display: "cookie" });
    expect(writeTemplateTokens({ scale: 100 })).toBeUndefined();
    expect(readTemplateTokens({ display: "nope", radius: 12, space: 140 })).toEqual({ radius: 12, space: 140 });
  });

  it("travels to the preview with the header and footer, and counts as a change to them", () => {
    const saved = readStoreLook({ themeSettings: { xsLook: "05" }, logoUrl: null });
    const changed = { ...saved, xsTokens: { display: "cookie" } };
    expect(sameShellParts(saved, changed)).toBe(false);
    expect(lookToShellPreview({ xsLook: "05" }, changed).tokens).toEqual({ display: "cookie" });
    expect(lookToShellPreview({ xsLook: "05" }, saved).tokens).toBeNull();
  });
});
