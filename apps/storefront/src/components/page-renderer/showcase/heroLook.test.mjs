import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HERO_DEFAULT_OVERLAY,
  HERO_OVERLAY_MAX,
  heroFocusMarkup,
  heroHasText,
  heroLookMarkup,
  heroPhoneHeight,
  resolveHeroFocus,
  resolveHeroLook,
} from "./heroLook.ts";

/**
 * Pins the promise the hero's new settings make: a slide saved before they
 * existed resolves to what the store always drew and adds nothing to its
 * markup, and a phone falls back to the computer's value one setting at a
 * time.
 */

const OLD = { desktop: { side: "center", vertical: "bottom", overlay: 0 }, phone: { side: "center", vertical: "bottom", overlay: 0 } };

describe("resolveHeroLook", () => {
  it("draws a slide with no settings as it always was, switch on or off", () => {
    for (const enabled of [true, false]) {
      assert.deepEqual(resolveHeroLook({}, enabled), OLD);
      assert.deepEqual(resolveHeroLook({ image: "https://cdn.test/a.jpg", heading: "Summer" }, enabled), OLD);
    }
  });

  it("keeps a saved computer place on both devices when the phone sets nothing", () => {
    for (const enabled of [true, false]) {
      const look = resolveHeroLook({ side: "start", vertical: "top" }, enabled);
      assert.deepEqual(look.desktop, { side: "start", vertical: "top", overlay: 0 });
      assert.deepEqual(look.phone, look.desktop);
    }
  });

  it("falls back to the computer one setting at a time", () => {
    const look = resolveHeroLook({ side: "end", vertical: "middle", overlay: 40, verticalMobile: "bottom" }, true);
    assert.deepEqual(look.desktop, { side: "end", vertical: "middle", overlay: 40 });
    assert.deepEqual(look.phone, { side: "end", vertical: "bottom", overlay: 40 });
  });

  it("lets a phone have a place and a veil of its own", () => {
    const look = resolveHeroLook({ side: "start", vertical: "top", overlay: 20, sideMobile: "center", verticalMobile: "bottom", overlayMobile: 55 }, true);
    assert.deepEqual(look.desktop, { side: "start", vertical: "top", overlay: 20 });
    assert.deepEqual(look.phone, { side: "center", vertical: "bottom", overlay: 55 });
  });

  it("takes 0 on a phone as no veil there, not as unset", () => {
    assert.equal(resolveHeroLook({ overlay: 30, overlayMobile: 0 }, true).phone.overlay, 0);
    assert.equal(resolveHeroLook({ overlay: 30 }, true).phone.overlay, 30);
    assert.equal(resolveHeroLook({ overlayMobile: 25 }, true).desktop.overlay, 0);
    assert.equal(resolveHeroLook({ overlayMobile: 25 }, true).phone.overlay, 25);
  });

  it("holds the veil inside 0 to 60 and rounds it", () => {
    assert.equal(HERO_OVERLAY_MAX, 60);
    assert.equal(resolveHeroLook({ overlay: 95 }, true).desktop.overlay, 60);
    assert.equal(resolveHeroLook({ overlay: -5 }, true).desktop.overlay, 0);
    assert.equal(resolveHeroLook({ overlay: 12.6 }, true).desktop.overlay, 13);
    assert.equal(resolveHeroLook({ overlay: "35" }, true).desktop.overlay, 35);
    assert.equal(resolveHeroLook({ overlay: 10, overlayMobile: 300 }, true).phone.overlay, 60);
  });

  it("reads anything that is not a known value as unset", () => {
    const junk = { side: "left", vertical: 3, sideMobile: "", verticalMobile: null, overlay: "lots", overlayMobile: {} };
    assert.deepEqual(resolveHeroLook(junk, true), OLD);
    // An unknown phone value falls back to the computer's, not to the default.
    const look = resolveHeroLook({ side: "end", vertical: "top", overlay: 30, sideMobile: "up", verticalMobile: [], overlayMobile: "" }, true);
    assert.deepEqual(look.phone, { side: "end", vertical: "top", overlay: 30 });
  });

  it("reads none of the new settings while the switch is off", () => {
    const slide = { side: "end", vertical: "top", sideMobile: "start", verticalMobile: "bottom", overlay: 50, overlayMobile: 20 };
    const look = resolveHeroLook(slide, false);
    assert.deepEqual(look.desktop, { side: "end", vertical: "top", overlay: 0 });
    assert.deepEqual(look.phone, look.desktop);
  });
});

describe("heroLookMarkup", () => {
  it("adds nothing for a slide that sets nothing", () => {
    assert.deepEqual(heroLookMarkup(resolveHeroLook({}, true)), { overlay: null });
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ side: "start", vertical: "top" }, true)), { overlay: null });
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ side: "end", sideMobile: "start", overlay: 40 }, false)), { overlay: null });
  });

  it("names the phone's place only where it differs", () => {
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ side: "start", sideMobile: "start", verticalMobile: "top" }, true)), {
      overlay: null,
      phoneVertical: "top",
    });
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ sideMobile: "end", verticalMobile: "bottom" }, true)), { overlay: null, phoneSide: "end" });
  });

  it("gives the veil as an opacity for each device", () => {
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ overlay: 40 }, true)).overlay, { desktop: 0.4, phone: 0.4 });
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ overlay: 40, overlayMobile: 0 }, true)).overlay, { desktop: 0.4, phone: 0 });
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ overlayMobile: 60 }, true)).overlay, { desktop: 0, phone: 0.6 });
    assert.equal(heroLookMarkup(resolveHeroLook({ overlay: 0, overlayMobile: 0 }, true)).overlay, null);
  });
});

describe("the default veil of a slide with text", () => {
  it("is drawn on both devices while the switch is on and the slide sets none", () => {
    const look = resolveHeroLook({ side: "start" }, true, true);
    assert.equal(look.desktop.overlay, HERO_DEFAULT_OVERLAY);
    assert.equal(look.phone.overlay, HERO_DEFAULT_OVERLAY);
    assert.deepEqual(heroLookMarkup(look).overlay, { desktop: 0.55, phone: 0.55 });
  });

  it("is not drawn for a slide without text, which has nothing to keep readable", () => {
    assert.deepEqual(resolveHeroLook({}, true, false), OLD);
    assert.equal(heroLookMarkup(resolveHeroLook({}, true, false)).overlay, null);
  });

  it("gives way to the veil a slide sets, none included", () => {
    assert.equal(resolveHeroLook({ overlay: 0 }, true, true).desktop.overlay, 0);
    assert.equal(heroLookMarkup(resolveHeroLook({ overlay: 0 }, true, true)).overlay, null);
    assert.equal(resolveHeroLook({ overlay: 20 }, true, true).desktop.overlay, 20);
    assert.equal(resolveHeroLook({ overlay: 60 }, true, true).phone.overlay, 60);
    // A value that is not a veil is not a choice: the default still applies.
    assert.equal(resolveHeroLook({ overlay: "lots" }, true, true).desktop.overlay, HERO_DEFAULT_OVERLAY);
  });

  it("leaves a phone its own veil, and the default where the phone sets none", () => {
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ overlayMobile: 0 }, true, true)).overlay, { desktop: 0.55, phone: 0 });
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ overlayMobile: 30 }, true, true)).overlay, { desktop: 0.55, phone: 0.3 });
    assert.deepEqual(heroLookMarkup(resolveHeroLook({ overlay: 0 }, true, true)).overlay, null);
  });

  it("is never drawn while the switch is off: a slide with text is as it always was", () => {
    assert.deepEqual(resolveHeroLook({}, false, true), OLD);
    assert.deepEqual(resolveHeroLook({ heading: "Summer", overlay: 40 }, false, true), OLD);
    assert.deepEqual(heroLookMarkup(resolveHeroLook({}, false, true)), { overlay: null });
  });

  it("counts a small line, a heading or a line under it as text, and blanks as none", () => {
    assert.equal(heroHasText("", "Summer", ""), true);
    assert.equal(heroHasText("New", "", ""), true);
    assert.equal(heroHasText("", "", "Free delivery"), true);
    assert.equal(heroHasText("", "", ""), false);
    assert.equal(heroHasText(" ", "\n", "\t"), false);
    assert.equal(heroHasText(), false);
  });
});

/**
 * How readable the slide's text is over a picture, by the WCAG contrast ratio.
 * The veil is white under dark text and black under light text, laid over the
 * picture at the veil's strength (store-sections.css; storeSections.test.mjs
 * pins those four colours). The two pictures that are hardest on the text are
 * a black one under dark text and a white one under light text.
 */
describe("the default veil's contrast", () => {
  const DARK_TEXT = 0x1c; // #1c1c1c
  const LIGHT_TEXT = 255; // #fff
  const BLACK = 0;
  const WHITE = 255;
  /** Relative luminance of a grey, from its 0–255 level. */
  const luminance = (level) => {
    const s = level / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  /** The grey a shopper sees where a veil of `percent` lies over a picture. */
  const veiled = (picture, veil, percent) => picture + (veil - picture) * (percent / 100);
  const darkOnBlack = (percent) => contrast(DARK_TEXT, veiled(BLACK, WHITE, percent));
  const lightOnWhite = (percent) => contrast(LIGHT_TEXT, veiled(WHITE, BLACK, percent));
  const AA = 4.5; // text of any size
  const AA_LARGE = 3; // the heading: 50px bold on a computer, 30px bold on a phone

  it("is one of the veil's own steps, inside its range", () => {
    assert.equal(HERO_DEFAULT_OVERLAY, 55);
    assert.equal(HERO_DEFAULT_OVERLAY % 5, 0);
    assert.ok(HERO_DEFAULT_OVERLAY <= HERO_OVERLAY_MAX);
  });

  it("is needed: with no veil, text of the wrong colour for its picture cannot be read", () => {
    assert.ok(darkOnBlack(0) < 1.3);
    assert.ok(lightOnWhite(0) < 1.1);
  });

  it("keeps dark text readable over a black picture and light text over a white one", () => {
    assert.ok(darkOnBlack(HERO_DEFAULT_OVERLAY) >= AA, `dark on black: ${darkOnBlack(HERO_DEFAULT_OVERLAY).toFixed(2)}`);
    assert.ok(lightOnWhite(HERO_DEFAULT_OVERLAY) >= AA, `light on white: ${lightOnWhite(HERO_DEFAULT_OVERLAY).toFixed(2)}`);
    assert.equal(darkOnBlack(HERO_DEFAULT_OVERLAY).toFixed(2), "5.08");
    assert.equal(lightOnWhite(HERO_DEFAULT_OVERLAY).toFixed(2), "4.76");
  });

  it("is the lowest step that does: five less fails for the small lines", () => {
    const below = HERO_DEFAULT_OVERLAY - 5;
    assert.ok(darkOnBlack(below) < AA);
    assert.ok(lightOnWhite(below) < AA);
    // The heading alone, being large, would still pass there, and down to 45.
    assert.ok(darkOnBlack(45) >= AA_LARGE && lightOnWhite(45) >= AA_LARGE);
    assert.ok(darkOnBlack(40) < AA_LARGE && lightOnWhite(40) < AA_LARGE);
  });

  it("changes nothing where the text already suits the picture", () => {
    // Dark text over a white picture and light text over a black one: the veil is the picture's own colour.
    assert.equal(contrast(DARK_TEXT, veiled(WHITE, WHITE, HERO_DEFAULT_OVERLAY)).toFixed(1), "17.0");
    assert.equal(contrast(LIGHT_TEXT, veiled(BLACK, BLACK, HERO_DEFAULT_OVERLAY)).toFixed(1), "21.0");
  });

  it("lifts a mid-grey picture, where neither colour passed, well clear", () => {
    const GREY = 128;
    assert.ok(contrast(DARK_TEXT, GREY) < AA && contrast(LIGHT_TEXT, GREY) < AA);
    assert.ok(contrast(DARK_TEXT, veiled(GREY, WHITE, HERO_DEFAULT_OVERLAY)) > 9);
    assert.ok(contrast(LIGHT_TEXT, veiled(GREY, BLACK, HERO_DEFAULT_OVERLAY)) > 11);
  });
});

describe("heroPhoneHeight", () => {
  it("is nothing for a slider that names none, so a phone keeps its 4:5 box", () => {
    for (const unset of [undefined, null, "", "  ", "tall", {}, [], true, NaN, 0, -40]) assert.equal(heroPhoneHeight(unset), null);
  });

  it("is the height that is named, as a whole number of px", () => {
    assert.equal(heroPhoneHeight(320), 320);
    assert.equal(heroPhoneHeight("450"), 450);
    assert.equal(heroPhoneHeight(399.6), 400);
  });

  it("is held inside 200 to 900", () => {
    assert.equal(heroPhoneHeight(40), 200);
    assert.equal(heroPhoneHeight(5000), 900);
  });
});

describe("resolveHeroFocus", () => {
  it("holds a picture at its centre while the slide names no edge, as it always was", () => {
    assert.deepEqual(resolveHeroFocus({}), { x: "center", y: "center" });
    assert.deepEqual(resolveHeroFocus({ image: "https://cdn.test/a.jpg", side: "start", vertical: "top" }), { x: "center", y: "center" });
    assert.deepEqual(resolveHeroFocus({ focusX: "center", focusY: "center" }), { x: "center", y: "center" });
  });

  it("reads each direction on its own", () => {
    assert.deepEqual(resolveHeroFocus({ focusY: "top" }), { x: "center", y: "top" });
    assert.deepEqual(resolveHeroFocus({ focusX: "end" }), { x: "end", y: "center" });
    assert.deepEqual(resolveHeroFocus({ focusX: "start", focusY: "bottom" }), { x: "start", y: "bottom" });
  });

  it("reads anything that is not a known edge as the centre", () => {
    // "middle" and "left" are words of other settings, not of this one.
    assert.deepEqual(resolveHeroFocus({ focusX: "left", focusY: "middle" }), { x: "center", y: "center" });
    assert.deepEqual(resolveHeroFocus({ focusX: 0, focusY: null }), { x: "center", y: "center" });
    assert.deepEqual(resolveHeroFocus({ focusX: "", focusY: ["top"] }), { x: "center", y: "center" });
  });
});

describe("heroFocusMarkup", () => {
  it("adds nothing for the centre", () => {
    assert.deepEqual(heroFocusMarkup(resolveHeroFocus({})), {});
    assert.deepEqual(heroFocusMarkup(resolveHeroFocus({ focusX: "center", focusY: "center" })), {});
  });

  it("names only the edges a slide asks for", () => {
    assert.deepEqual(heroFocusMarkup(resolveHeroFocus({ focusY: "top" })), { focusY: "top" });
    assert.deepEqual(heroFocusMarkup(resolveHeroFocus({ focusX: "start" })), { focusX: "start" });
    assert.deepEqual(heroFocusMarkup(resolveHeroFocus({ focusX: "end", focusY: "bottom" })), { focusX: "end", focusY: "bottom" });
  });
});
