import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { HERO_DEFAULT_OVERLAY, heroFocusMarkup, heroHasText, heroLookMarkup, resolveHeroFocus, resolveHeroLook } from "./heroLook";
import { HeroSlider, type HeroSlide } from "./HeroSlider";

// Read from disk: this runner hands back an empty string for an imported stylesheet.
const css = readFileSync(resolve(__dirname, "../../../app/store-sections.css"), "utf8").replace(/\r\n/g, "\n");

// A plain anchor: the slider's button needs no store around it here.
vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const PICTURE = "https://cdn.zimos.test/hero.jpg";

/** A slide as showcase/index.tsx hands it over, from the props a merchant saved. `heading` "" is a slide with no text. */
function slideOf(props: Record<string, unknown>, enabled: boolean, heading = "Summer"): HeroSlide {
  const look = resolveHeroLook(props, enabled, heroHasText("", heading, ""));
  return {
    key: "0",
    image: PICTURE,
    mobileImage: null,
    alt: "",
    eyebrow: "",
    heading,
    subheading: "",
    buttonLabel: "",
    buttonHref: null,
    side: look.desktop.side,
    vertical: look.desktop.vertical,
    ...heroLookMarkup(look),
    ...heroFocusMarkup(resolveHeroFocus(props)),
    contentWidth: 620,
    text: props.text === "light" ? "light" : "dark",
  };
}

function draw(slides: HeroSlide[], more: Partial<ComponentProps<typeof HeroSlider>> = {}) {
  const view = render(
    <HeroSlider
      slides={slides}
      autoplay={false}
      seconds={5}
      startDelay={5}
      arrows
      dots
      wave={false}
      rtl={false}
      label="Offers"
      labels={{ previous: "Previous", next: "Next", slide: "Slide" }}
      {...more}
    />
  );
  return { ...view, slide: view.container.querySelector<HTMLElement>(".zs-hero__slide")! };
}

describe("a slide's place and veil", () => {
  it("draws a slide saved before them exactly as it was while the switch is off: no new attribute, no veil", () => {
    const { container, slide } = draw([slideOf({ side: "start", vertical: "top" }, false)]);
    expect(slide.getAttributeNames().sort()).toEqual(["class", "data-h", "data-text", "data-v"]);
    expect(slide.getAttribute("data-h")).toBe("start");
    expect(slide.getAttribute("data-v")).toBe("top");
    expect(slide.querySelector(".zs-hero__overlay")).toBeNull();
    expect(Array.from(slide.querySelector(".zs-hero__media")!.children, (child) => child.tagName)).toEqual(["PICTURE"]);
    // Nor anything new on the slider itself.
    expect(container.querySelector(".zs-hero")!.getAttributeNames().sort()).toEqual(["aria-label", "aria-roledescription", "class", "role"]);
  });

  it("adds only the default veil to such a slide once the switch is on, because it has text", () => {
    const { slide } = draw([slideOf({ side: "start", vertical: "top" }, true)]);
    expect(slide.getAttributeNames().sort()).toEqual(["class", "data-h", "data-text", "data-v"]);
    const veil = slide.querySelector<HTMLElement>(".zs-hero__overlay")!;
    expect(veil.style.getPropertyValue("--zs-ov")).toBe(String(HERO_DEFAULT_OVERLAY / 100));
    expect(veil.style.getPropertyValue("--zs-ov-m")).toBe(String(HERO_DEFAULT_OVERLAY / 100));
    expect(Array.from(slide.querySelector(".zs-hero__media")!.children, (child) => child.tagName)).toEqual(["PICTURE", "SPAN"]);
  });

  it("draws no default veil over a slide without text, or one that asks for none", () => {
    const bare = draw([slideOf({}, true, "")]);
    expect(bare.slide.querySelector(".zs-hero__overlay")).toBeNull();
    bare.unmount();

    const none = draw([slideOf({ overlay: 0 }, true)]);
    expect(none.slide.querySelector(".zs-hero__overlay")).toBeNull();
  });

  it("names the phone's place only where it differs, and draws the veil with an opacity for each device", () => {
    const { slide } = draw([slideOf({ side: "start", vertical: "top", sideMobile: "center", verticalMobile: "top", overlay: 40, overlayMobile: 20, text: "light" }, true)]);
    expect(slide.getAttribute("data-h")).toBe("start");
    expect(slide.getAttribute("data-hm")).toBe("center");
    // The same height on both: nothing to say for the phone.
    expect(slide.hasAttribute("data-vm")).toBe(false);
    expect(slide.getAttribute("data-text")).toBe("light");

    const veil = slide.querySelector<HTMLElement>(".zs-hero__overlay")!;
    expect(veil.getAttribute("aria-hidden")).toBe("true");
    expect(veil.style.getPropertyValue("--zs-ov")).toBe("0.4");
    expect(veil.style.getPropertyValue("--zs-ov-m")).toBe("0.2");
    // Inside the picture's own box, so it is clipped with it; the text sits above both.
    expect(veil.parentElement?.className).toBe("zs-hero__media");
  });

  it("draws none of it while the switch is off, whatever the slide holds", () => {
    const { slide } = draw([slideOf({ sideMobile: "end", verticalMobile: "top", overlay: 50, overlayMobile: 10 }, false)]);
    expect(slide.getAttributeNames().sort()).toEqual(["class", "data-h", "data-text", "data-v"]);
    expect(slide.querySelector(".zs-hero__overlay")).toBeNull();
  });
});

describe("the slider's text while the switch is on", () => {
  it("marks the slider only then", () => {
    const off = draw([slideOf({}, false)]);
    expect(off.container.querySelector(".zs-hero")!.hasAttribute("data-legible")).toBe(false);
    off.unmount();

    const on = draw([slideOf({}, true)], { legible: true });
    expect(on.container.querySelector(".zs-hero")!.getAttribute("data-legible")).toBe("");
  });

  it("draws the small lines at full strength, so the default veil's contrast holds for them too", () => {
    // As they always were: a little see-through.
    expect(css).toMatch(/\.zs-hero__eyebrow \{[^}]*opacity: 0\.9;/);
    expect(css).toMatch(/\.zs-hero__sub \{[^}]*opacity: 0\.92;/);
    expect(css).toMatch(/\.zs-hero\[data-legible\] \.zs-hero__eyebrow,\s*\.zs-hero\[data-legible\] \.zs-hero__sub \{\s*opacity: 1;\s*\}/);
  });

  it("makes the heading larger on a computer only, and never smaller than it was", () => {
    expect(css).toMatch(/\.zs-hero__heading \{[^}]*font-size: 50px;/);
    const from = css.indexOf("@media (min-width: 1025px) {\n  .zs-hero[data-legible] .zs-hero__heading {");
    expect(from).toBeGreaterThan(0);
    expect(css.slice(from, css.indexOf("\n}\n", from))).toContain("font-size: clamp(50px, 4vw, 60px);");
    // A tablet and a phone keep their sizes: the rule starts where the tablet's layout ends.
    expect(css).toContain("@media (max-width: 1024px) {\n  .zs-hero {");
    expect(css).toMatch(/\.zs-hero__heading \{ font-size: 30px; \}/);
  });
});

describe("the slider's height on a phone", () => {
  it("says nothing for a slider that names none: the phone keeps its 4:5 box", () => {
    for (const phoneHeight of [undefined, null]) {
      const { container, unmount } = draw([slideOf({}, false)], { phoneHeight, style: { "--zs-hero-h": "620px" } as React.CSSProperties });
      const hero = container.querySelector<HTMLElement>(".zs-hero")!;
      expect(hero.hasAttribute("data-phone-height")).toBe(false);
      expect(hero.style.getPropertyValue("--zs-hero-h-mobile")).toBe("");
      expect(hero.style.getPropertyValue("--zs-hero-h")).toBe("620px");
      unmount();
    }
  });

  it("marks the slider and hands the height over, beside the other two", () => {
    const { container } = draw([slideOf({}, false)], { phoneHeight: 320, style: { "--zs-hero-h": "620px", "--zs-hero-h-tablet": "520px" } as React.CSSProperties });
    const hero = container.querySelector<HTMLElement>(".zs-hero")!;
    expect(hero.getAttribute("data-phone-height")).toBe("");
    expect(hero.style.getPropertyValue("--zs-hero-h-mobile")).toBe("320px");
    expect(hero.style.getPropertyValue("--zs-hero-h")).toBe("620px");
    expect(hero.style.getPropertyValue("--zs-hero-h-tablet")).toBe("520px");
  });

  it("is that height on a phone-wide screen instead of the 4:5 box, and only for a slider that names one", () => {
    const from = css.indexOf("@media (max-width: 749px) {\n  .zs-hero {");
    expect(from).toBeGreaterThan(0);
    const phone = css.slice(from, css.indexOf("\n}\n", from));
    expect(phone).toMatch(/\.zs-hero \{\s*height: auto;\s*aspect-ratio: 4 \/ 5;\s*\}/);
    expect(phone).toMatch(/\.zs-hero\[data-phone-height\] \{\s*height: var\(--zs-hero-h-mobile\);\s*aspect-ratio: auto;\s*\}/);
    // After the 4:5 rule, which it replaces.
    expect(phone.indexOf(".zs-hero[data-phone-height]")).toBeGreaterThan(phone.indexOf("aspect-ratio: 4 / 5;"));
    // Nowhere else: a computer and a tablet never read the phone's height.
    expect(css.split("--zs-hero-h-mobile").length - 1).toBe(1);
  });
});

describe("the part of a slide's picture kept in view", () => {
  it("names an edge on the slide, and nothing for the centre", () => {
    const top = draw([slideOf({ focusY: "top" }, false)]);
    expect(top.slide.getAttribute("data-fy")).toBe("top");
    expect(top.slide.hasAttribute("data-fx")).toBe(false);
    top.unmount();

    const corner = draw([slideOf({ focusX: "end", focusY: "bottom" }, false)]);
    expect(corner.slide.getAttribute("data-fx")).toBe("end");
    expect(corner.slide.getAttribute("data-fy")).toBe("bottom");
    corner.unmount();

    const centre = draw([slideOf({ focusX: "center", focusY: "center" }, false)]);
    expect(centre.slide.getAttributeNames().sort()).toEqual(["class", "data-h", "data-text", "data-v"]);
  });

  it("holds the picture at the centre unless a slide names an edge", () => {
    const img = css.slice(css.indexOf(".zs-hero__media img {"), css.indexOf("}", css.indexOf(".zs-hero__media img {")));
    expect(img).toContain("object-fit: cover;");
    expect(img).toContain("object-position: var(--zs-fx, 50%) var(--zs-fy, 50%);");
    for (const rule of [
      '.zs-hero__slide[data-fx="start"] { --zs-fx: 0%; }',
      '.zs-hero__slide[data-fx="end"] { --zs-fx: 100%; }',
      '.zs-hero__slide[data-fy="top"] { --zs-fy: 0%; }',
      '.zs-hero__slide[data-fy="bottom"] { --zs-fy: 100%; }',
    ]) {
      expect(css).toContain(rule);
    }
  });

  it("turns start and end round on a right-to-left page, after the rules it overrides", () => {
    const start = '[dir="rtl"] .zs-hero__slide[data-fx="start"] { --zs-fx: 100%; }';
    const end = '[dir="rtl"] .zs-hero__slide[data-fx="end"] { --zs-fx: 0%; }';
    expect(css).toContain(start);
    expect(css).toContain(end);
    expect(css.indexOf(start)).toBeGreaterThan(css.indexOf('.zs-hero__slide[data-fx="end"] { --zs-fx: 100%; }'));
  });

  it("holds a background video at the same part as its picture", () => {
    const video = css.slice(css.indexOf(".zs-hero__video video {"), css.indexOf("}", css.indexOf(".zs-hero__video video {")));
    expect(video).toContain("object-position: var(--zs-fx, 50%) var(--zs-fy, 50%);");
  });
});

describe("the stylesheet behind them", () => {
  // The phone's block: from its comment to the brace that closes its media query.
  const from = css.indexOf("A phone's own veil");
  const phone = css.slice(from, css.indexOf("\n}\n", from));

  it("keeps the phone's rules in the hero's own narrow layout", () => {
    expect(from).toBeGreaterThan(0);
    expect(phone).toContain("@media (max-width: 749px) {");
  });

  it("moves the text on a phone for each of the six places", () => {
    for (const rule of [
      '[data-vm="top"] .zs-hero__shell { align-items: flex-start; }',
      '[data-vm="middle"] .zs-hero__shell { align-items: center; }',
      '[data-vm="bottom"] .zs-hero__shell { align-items: flex-end; }',
      '[data-hm="start"] .zs-hero__shell { justify-content: flex-start; }',
      '[data-hm="center"] .zs-hero__shell { justify-content: center; }',
      '[data-hm="end"] .zs-hero__shell { justify-content: flex-end; }',
    ]) {
      expect(phone).toContain(rule);
    }
    // After the computer's rules, so on a phone the phone's rule is the one that holds.
    expect(css.indexOf('[data-vm="top"]')).toBeGreaterThan(css.indexOf('.zs-hero__slide[data-v="top"]'));
  });

  it("falls back to the computer's veil on a phone, and to none at all", () => {
    expect(css).toContain("opacity: var(--zs-ov, 0);");
    expect(phone).toContain(".zs-hero__overlay { opacity: var(--zs-ov-m, var(--zs-ov, 0)); }");
  });

  it("is light under dark text and dark under light text, and never takes a press", () => {
    const base = css.slice(css.indexOf(".zs-hero__overlay {"), css.indexOf("}", css.indexOf(".zs-hero__overlay {")));
    expect(base).toContain("background: #fff;");
    expect(base).toContain("pointer-events: none;");
    expect(css).toMatch(/\.zs-hero__slide\[data-text="light"\] \.zs-hero__overlay \{\s*background: #000;/);
  });
});
