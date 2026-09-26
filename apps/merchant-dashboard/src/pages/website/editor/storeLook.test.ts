import { describe, expect, it } from "vitest";
import { lookToPreview, lookToWorkspacePatch, readStoreLook, type StoreLook } from "./storeLook";

/** A look with every field set, so a test only has to override what it cares about. */
function baseLook(overrides: Partial<StoreLook> = {}): StoreLook {
  return {
    primaryColor: "#1E40AF",
    secondaryColor: null,
    fontFamily: "modern",
    cornerRadius: "round",
    logoUrl: null,
    announcement: { enabled: false, messages: [], href: null, background: null, color: null },
    ...overrides,
  };
}

describe("store look", () => {
  it("reads defaults from a workspace that has saved nothing", () => {
    expect(readStoreLook({ themeSettings: {}, logoUrl: null })).toEqual({
      primaryColor: null,
      secondaryColor: null,
      fontFamily: "classic",
      cornerRadius: "soft",
      logoUrl: null,
      announcement: { enabled: false, messages: [], href: null, background: null, color: null },
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
      baseLook({ secondaryColor: null, fontFamily: "modern", cornerRadius: "round", logoUrl: null })
    );
    expect(patch).toEqual({
      logoUrl: null,
      themeSettings: {
        productCountdownHours: 6,
        primaryColor: "#1E40AF",
        fontFamily: "modern",
        cornerRadius: "round",
        header: { announcement: { enabled: false } },
      },
    });
  });

  it("leaves an unset colour out of the preview, so the store default still applies", () => {
    const preview = lookToPreview(readStoreLook({ themeSettings: {}, logoUrl: null }));
    expect(preview).not.toHaveProperty("primaryColor");
    expect(preview.logoUrl).toBeNull();
  });

  it("never puts the announcement bar in the preview payload — the preview bridge doesn't know the field", () => {
    const look = baseLook({ announcement: { enabled: true, messages: ["Sale!"], href: null, background: null, color: null } });
    const preview = lookToPreview(look);
    expect(preview).not.toHaveProperty("announcement");
  });

  describe("announcement bar", () => {
    it("turning it on with every message blank saves as turned off, not refused", () => {
      const look = baseLook({
        announcement: { enabled: true, messages: ["", "  "], href: null, background: null, color: null },
      });
      const patch = lookToWorkspacePatch({}, look);
      expect(patch.themeSettings.header).toEqual({ announcement: { enabled: false } });
    });

    it("a single message round-trips through the exact shape announcementOf reads: text set, no messages array", () => {
      const look = baseLook({
        announcement: {
          enabled: true,
          messages: ["Free shipping over 500 EGP"],
          href: "/sale",
          background: "#1F5D5B",
          color: "#FFFFFF",
        },
      });
      const patch = lookToWorkspacePatch({}, look);
      const saved = patch.themeSettings.header as { announcement: Record<string, unknown> };
      expect(saved.announcement).toEqual({
        enabled: true,
        text: "Free shipping over 500 EGP",
        href: "/sale",
        background: "#1F5D5B",
        color: "#FFFFFF",
      });
      expect(saved.announcement).not.toHaveProperty("messages");

      // readStoreLook opens the same value back up, unchanged.
      const reopened = readStoreLook({ themeSettings: { header: saved }, logoUrl: null });
      expect(reopened.announcement).toEqual(look.announcement);
    });

    it("two or more messages are written as a `messages` array of the same length, `text` staying the first one", () => {
      const look = baseLook({
        announcement: {
          enabled: true,
          messages: ["Free shipping", "Eid sale", "New arrivals"],
          href: null,
          background: null,
          color: null,
        },
      });
      const patch = lookToWorkspacePatch({}, look);
      const saved = patch.themeSettings.header as { announcement: Record<string, unknown> };
      expect(saved.announcement.text).toBe("Free shipping");
      expect(saved.announcement.messages).toEqual(["Free shipping", "Eid sale", "New arrivals"]);
      expect((saved.announcement.messages as string[]).length).toBeGreaterThanOrEqual(2);

      const reopened = readStoreLook({ themeSettings: { header: saved }, logoUrl: null });
      expect(reopened.announcement.messages).toEqual(["Free shipping", "Eid sale", "New arrivals"]);
      expect(reopened.announcement.enabled).toBe(true);
    });

    it("blank lines mixed with real ones are dropped before saving", () => {
      const look = baseLook({
        announcement: { enabled: true, messages: ["  ", "Real message", ""], href: null, background: null, color: null },
      });
      const patch = lookToWorkspacePatch({}, look);
      const saved = patch.themeSettings.header as { announcement: Record<string, unknown> };
      expect(saved.announcement.text).toBe("Real message");
      expect(saved.announcement).not.toHaveProperty("messages");
    });

    it("keeps other header keys untouched when saving the announcement", () => {
      const look = baseLook({
        announcement: { enabled: false, messages: [], href: null, background: null, color: null },
      });
      const patch = lookToWorkspacePatch({ header: { somethingElse: 1 } }, look);
      expect(patch.themeSettings.header).toEqual({ somethingElse: 1, announcement: { enabled: false } });
    });

    it("a store that never saved one reads back as disabled with no messages", () => {
      const look = readStoreLook({ themeSettings: {}, logoUrl: null });
      expect(look.announcement).toEqual({ enabled: false, messages: [], href: null, background: null, color: null });
    });
  });
});
