import { describe, expect, it } from "vitest";
import { lookToPreview, lookToWorkspacePatch, readStoreLook } from "./storeLook";

describe("store look", () => {
  it("reads defaults from a workspace that has saved nothing", () => {
    expect(readStoreLook({ themeSettings: {}, logoUrl: null })).toEqual({
      primaryColor: null,
      secondaryColor: null,
      fontFamily: "classic",
      cornerRadius: "soft",
      logoUrl: null,
    });
  });

  it("ignores values the storefront would not accept", () => {
    const look = readStoreLook({
      themeSettings: { primaryColor: "teal", fontFamily: "comic-sans", cornerRadius: 12 },
      logoUrl: "https://cdn.example/logo.png",
    });
    expect(look.primaryColor).toBeNull();
    expect(look.fontFamily).toBe("classic");
    expect(look.cornerRadius).toBe("soft");
    expect(look.logoUrl).toBe("https://cdn.example/logo.png");
  });

  it("merges into themeSettings without dropping keys it doesn't own", () => {
    const patch = lookToWorkspacePatch(
      { productCountdownHours: 6, primaryColor: "#111111" },
      { primaryColor: "#1E40AF", secondaryColor: null, fontFamily: "modern", cornerRadius: "round", logoUrl: null }
    );
    expect(patch).toEqual({
      logoUrl: null,
      themeSettings: {
        productCountdownHours: 6,
        primaryColor: "#1E40AF",
        fontFamily: "modern",
        cornerRadius: "round",
      },
    });
  });

  it("leaves an unset colour out of the preview, so the store default still applies", () => {
    const preview = lookToPreview(readStoreLook({ themeSettings: {}, logoUrl: null }));
    expect(preview).not.toHaveProperty("primaryColor");
    expect(preview.logoUrl).toBeNull();
  });
});
