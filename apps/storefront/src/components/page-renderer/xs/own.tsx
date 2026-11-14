import type { CSSProperties, ReactNode } from "react";
import { DEVICE_MEDIA, perDevice, type PerDevice } from "@/lib/deviceValue";
import { type Props } from "../showcase/shared";

/**
 * A band's own look: what a merchant changed about one band in the editor,
 * over the look its template gives it.
 *
 *   colours    headings, text, accents (buttons, links, badges), the ground
 *   layout     columns, the band's height, which side its picture stands on,
 *              how wide its content runs, the space above and below it, the
 *              gap between its items, where its words line up
 *   type       the size of its headings, of its items' titles and of its
 *              text, and how heavy its headings are
 *   pictures   their shape or height, how they fill their box, their corners,
 *              and the width of a picture that stands alone
 *   buttons    the size of their words and their corners
 *
 * None of it is written into the band's own markup. The band is wrapped in a
 * box that takes no space of its own (`display: contents`) and carries the
 * choices as custom properties and marker attributes; app/xs-shell.css turns
 * each marker into the few rules that apply it. A band with nothing changed
 * gets no wrapper at all and is drawn exactly as its look draws it.
 *
 * The same names and ranges are offered by the editor (merchant-dashboard
 * editor/xsBlocks.ts).
 *
 * Each choice may differ by screen: one value, or `{ base, tablet, mobile }`
 * (lib/deviceValue). A computer's value goes the way described above. A
 * tablet's and a phone's are written as a small stylesheet of their own,
 * scoped to this band (`data-xs-own`) and held in media queries — exactly
 * the size set there, never the scaled-down computer one. Every value is a
 * clamped whole number, a keyword from a table or a #rrggbb colour; nothing
 * typed reaches the CSS as text.
 */

const HEX = /^#[0-9a-f]{6}$/i;

/** prop → [marker, custom property] */
const COLOURS: Record<string, [string, string]> = {
  headingColor: ["heading", "--xs-own-heading"],
  textColor: ["text", "--xs-own-text"],
  accentColor: ["accent", "--xs-own-accent"],
  backgroundColor: ["ground", "--xs-own-ground"],
};

/** prop → [marker, custom property, least, most, unit] — whole numbers only. */
const NUMBERS: Record<string, [string, string, number, number, string]> = {
  columns: ["cols", "--xs-own-cols", 1, 6, ""],
  height: ["height", "--xs-own-height", 120, 1200, "px"],
  width: ["width", "--xs-own-width", 480, 2400, "px"],
  paddingTop: ["padtop", "--xs-own-pad-top", 0, 400, "px"],
  paddingBottom: ["padbottom", "--xs-own-pad-bottom", 0, 400, "px"],
  gap: ["gap", "--xs-own-gap", 0, 160, "px"],
  headingSize: ["hsize", "--xs-own-hsize", 12, 160, "px"],
  titleSize: ["tsize", "--xs-own-tsize", 10, 80, "px"],
  textSize: ["psize", "--xs-own-psize", 10, 40, "px"],
  buttonSize: ["bsize", "--xs-own-bsize", 10, 32, "px"],
  buttonRadius: ["btnradius", "--xs-own-btn-radius", 0, 100, "px"],
  imageHeight: ["imgh", "--xs-own-img-h", 40, 1400, "px"],
  imageWidth: ["imgw", "--xs-own-img-w", 60, 1800, "px"],
  imageRadius: ["imgradius", "--xs-own-img-radius", 0, 400, "px"],
};

/** prop → [marker, custom property, what each choice is in CSS] */
const CHOICES: Record<string, [string, string, Record<string, string>]> = {
  align: ["align", "--xs-own-align", { start: "start", center: "center", end: "end" }],
  headingWeight: ["hweight", "--xs-own-hweight", { light: "300", regular: "400", medium: "500", semibold: "600", bold: "700", black: "900" }],
  imageRatio: [
    "imgratio",
    "--xs-own-img-ratio",
    { "1:1": "1 / 1", "4:3": "4 / 3", "3:2": "3 / 2", "16:9": "16 / 9", "21:9": "21 / 9", "3:4": "3 / 4", "4:5": "4 / 5", "2:3": "2 / 3" },
  ],
  imageFit: ["imgfit", "--xs-own-img-fit", { cover: "cover", contain: "contain" }],
};

const isHex = (value: unknown): value is string => typeof value === "string" && HEX.test(value);
const isWhole = (least: number, most: number) => (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= least && value <= most;
const isChoice = (choices: Record<string, string>) => (value: unknown): value is string => typeof value === "string" && Object.hasOwn(choices, value);
const isBool = (value: unknown): value is boolean => typeof value === "boolean";

// --- a tablet's and a phone's own values -----------------------------------------
// The same parts the rules at the end of app/xs-shell.css reach, with the value set as it is.

const GRIDS = `.xs-banners__grid,.xs-products__grid:not([data-layout="slider"]),.xs-features__list,.xs-team__grid,.xs-gallery__row,.xs-minis__inner,.xs-posts__grid`;
const GAPS = ".xs-banners__grid,.xs-products__grid,.xs-features__list,.xs-team__grid,.xs-gallery__row,.xs-minis__inner,.xs-posts__grid,.xs-hero__inner,.xs-split__inner,.xs-features__inner";
const PICS = ".xs-banners__img,.xs-products__media,.xs-showcase__img,.xs-features__art img,.xs-split__pic img,.xs-minis__thumb img,.xs-gallery__item img,.xs-posts__pic img,.xs-story__zoom img,.xs-team__person img";
const BUTTONS = '.xs-btn,.xs-slider__button,.xs-contact__submit,.xs-products__more-btn,.xs-banners__link,.xs-posts__more,.xs-posts__all,.xs-products__all,.xs-minis__more,button[type="submit"]';
const CORNERED = '.xs-btn,.xs-slider__button,.xs-contact__submit,.xs-products__more-btn,button[type="submit"],input:not([type="checkbox"]):not([type="radio"])';
const FLEX: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end" };

/** prop → the rules one value makes, given the band's wrapper (`o`) and the band itself (`b`). */
const SCREEN_RULES: Record<string, (o: string, b: string, value: string) => string> = {
  headingColor: (_o, b, c) => `${b}{--xs-ink:${c}}${b} :is(h1,h2,h3,h4,h5){color:${c}}`,
  textColor: (_o, b, c) => `${b}{--xs-ink-soft:${c};--xs-muted:${c};color:${c}}${b} :is(p,li,blockquote,figcaption span){color:${c}}`,
  accentColor: (_o, b, c) => `${b}{--xs-accent:${c};--xs-brand:${c};--xs-button:${c};--xs-highlight:${c};--xs-badge:${c};--xs-grad:${c}}`,
  backgroundColor: (_o, b, c) => `${b}{--xs-ground:${c};background:${c}}`,
  columns: (_o, b, n) => `${b} :is(${GRIDS}){grid-template-columns:repeat(${n},minmax(0,1fr))!important}`,
  height: (o, _b, h) =>
    `${o}>.xs-slider{height:${h}!important;min-height:0;max-height:none}` +
    `${o}>:is(.xs-title,.xs-newsletter){box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:${h};padding-block:16px}` +
    `${o}>.xs-hero{box-sizing:border-box;display:flex;align-items:center;min-height:${h}}${o}>.xs-hero>.xs-hero__inner{width:100%}`,
  width: (_o, b, w) => `${b}{--xs-container:${w}}`,
  paddingTop: (_o, b, p) => `${b}{padding-top:${p}!important}`,
  paddingBottom: (_o, b, p) => `${b}{padding-bottom:${p}!important}`,
  gap: (_o, b, g) => `${b} :is(${GAPS}){gap:${g}!important}`,
  align: (_o, b, a) =>
    `${b},${b} :is(h1,h2,h3,h4,p,[class*="__intro"],[class*="__head"],[class*="__body"],[class*="__copy"],[class*="__text"]){text-align:${a}!important}` +
    `${b} :is(.xs-slider__inner,.xs-banners__text,.xs-banners__top){align-items:${FLEX[a]}!important}` +
    (a === "center" ? `${b} :is(.xs-posts__head,.xs-products__head,.xs-hero__buttons){justify-content:center!important}` : ""),
  headingSize: (_o, b, s) => `${b} :is(h1,h2){font-size:${s}!important;line-height:1.2!important}`,
  headingWeight: (_o, b, w) => `${b} :is(h1,h2){font-weight:${w}!important}`,
  titleSize: (_o, b, s) => `${b} :is(h3,h4,h5,.xs-banners__title,.xs-products__name){font-size:${s}!important;line-height:1.35!important}`,
  textSize: (_o, b, s) => `${b} :is(p,li,blockquote,dd,.xs-banners__info,.xs-slider__eyebrow,.xs-posts__meta,.xs-products__price){font-size:${s}!important;line-height:1.7!important}`,
  buttonSize: (_o, b, s) => `${b} :is(${BUTTONS}){font-size:${s}!important}`,
  buttonRadius: (_o, b, r) => `${b}{--xs-btn-radius:${r}}${b} :is(${CORNERED}){border-radius:${r}!important}`,
  imageRatio: (_o, b, r) => `${b} :is(${PICS}){height:auto!important;aspect-ratio:${r}!important;object-fit:var(--xs-own-img-fit,cover)!important}`,
  imageHeight: (_o, b, h) => `${b} :is(${PICS}){height:${h}!important;aspect-ratio:auto!important;object-fit:var(--xs-own-img-fit,cover)!important}`,
  imageWidth: (_o, b, w) =>
    `${b} :is(.xs-split__pic img,.xs-features__art img,.xs-story__frame){width:${w}!important;max-width:100%!important}${b} .xs-hero__art img{width:min(${w},92vw)!important;max-width:none!important}`,
  imageFit: (_o, b, f) => `${b} :is(${PICS},.xs-products__img){object-fit:${f}!important}`,
  imageRadius: (_o, b, r) => `${b} :is(${PICS},.xs-banners__item,.xs-posts__pic,.xs-story__zoom,.xs-gallery__item){overflow:hidden;border-radius:${r}!important}`,
  flip: (_o, b, on) => `${b} :is(.xs-hero__inner,.xs-split__inner)>:first-child{order:${on === "true" ? 2 : 0}}`,
};

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

export function XsOwn({ props, children, id }: { props: Props; children: ReactNode; id?: string }) {
  const vars: Record<string, string | number> = {};
  const markers: Record<string, string> = {};
  // Every prop's value on each screen, ready for CSS: "#1a2b3c", "48px", "3", "center", "700", "true".
  const screens: Record<string, PerDevice<string>> = {};
  const keep = (key: string, values: PerDevice<string> | null) => {
    if (values) screens[key] = values;
  };

  for (const [key, [marker, property]] of Object.entries(COLOURS)) {
    const values = perDevice(props[key], isHex);
    keep(key, values && mapValues(values, (value) => value.toLowerCase()));
    if (values?.base === undefined) continue;
    vars[property] = values.base.toLowerCase();
    markers[`data-own-${marker}`] = "";
  }
  for (const [key, [marker, property, least, most, unit]] of Object.entries(NUMBERS)) {
    const values = perDevice(props[key], isWhole(least, most));
    keep(key, values && mapValues(values, (value) => `${value}${unit}`));
    if (values?.base === undefined) continue;
    vars[property] = unit ? `${values.base}${unit}` : values.base;
    markers[`data-own-${marker}`] = "";
  }
  for (const [key, [marker, property, choices]] of Object.entries(CHOICES)) {
    const values = perDevice(props[key], isChoice(choices));
    keep(key, values && (key === "align" ? values : mapValues(values, (value) => choices[value])));
    if (values?.base === undefined) continue;
    vars[property] = choices[values.base];
    // The choice itself, for the rules a custom property cannot carry (which way a flex box lines up).
    markers[`data-own-${marker}`] = values.base;
  }
  const flip = perDevice(props.flip, isBool);
  keep("flip", flip && mapValues(flip, String));
  if (flip?.base === true) markers["data-own-flip"] = "";

  // A tablet's and a phone's own values: rules of their own, scoped to this band.
  let css = "";
  if (id && SAFE_ID.test(id)) {
    const o = `.xs-own[data-xs-own="${id}"]`;
    const b = `${o}>[data-xs-look]`;
    for (const device of ["tablet", "mobile"] as const) {
      let rules = "";
      for (const [key, values] of Object.entries(screens)) {
        const value = values[device];
        if (value !== undefined && Object.hasOwn(SCREEN_RULES, key)) rules += SCREEN_RULES[key](o, b, value);
      }
      if (rules) css += `@media ${DEVICE_MEDIA[device]}{${rules}}`;
    }
  }

  if (Object.keys(markers).length === 0 && !css) return <>{children}</>;
  return (
    <div className="xs-own" style={vars as CSSProperties} {...markers} data-xs-own={css ? id : undefined}>
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {children}
    </div>
  );
}

/** The props a band's own look is made of (the editor sends these in a patch, components/preview/canvasPatch.ts). */
export const OWN_KEYS: readonly string[] = [...Object.keys(COLOURS), ...Object.keys(NUMBERS), ...Object.keys(CHOICES), "flip"];

/** Every own value on each screen, ready for CSS — as XsOwn reads them. */
function screensOf(props: Props): Record<string, PerDevice<string>> {
  const screens: Record<string, PerDevice<string>> = {};
  for (const key of Object.keys(COLOURS)) {
    const values = perDevice(props[key], isHex);
    if (values) screens[key] = mapValues(values, (value) => value.toLowerCase());
  }
  for (const [key, [, , least, most, unit]] of Object.entries(NUMBERS)) {
    const values = perDevice(props[key], isWhole(least, most));
    if (values) screens[key] = mapValues(values, (value) => `${value}${unit}`);
  }
  for (const [key, [, , choices]] of Object.entries(CHOICES)) {
    const values = perDevice(props[key], isChoice(choices));
    if (values) screens[key] = key === "align" ? values : mapValues(values, (value) => choices[value]);
  }
  const flip = perDevice(props.flip, isBool);
  if (flip) screens.flip = mapValues(flip, String);
  return screens;
}

/**
 * A band's own look on every screen as one stylesheet scoped to its box in
 * the editor's preview (`data-zimos-el`): what the frame lays over the page
 * the moment a size or colour changes, until the page renders again. The
 * rules are XsOwn's, every screen's value set as it is, and outrank what
 * the page was drawn with (an id-level :not), so a value changed again wins.
 */
export function ownPatchCss(id: string, props: Props): string {
  if (!SAFE_ID.test(id)) return "";
  const screens = screensOf(props);
  let css = "";
  for (const box of [`[data-zimos-el="${id}"]:not(#\\#)`, `[data-zimos-el="${id}"]:not(#\\#)>.xs-own`]) {
    const b = `${box}>[data-xs-look]`;
    for (const device of ["base", "tablet", "mobile"] as const) {
      let rules = "";
      for (const [key, values] of Object.entries(screens)) {
        const value = values[device];
        if (value !== undefined && Object.hasOwn(SCREEN_RULES, key)) rules += SCREEN_RULES[key](box, b, value);
      }
      if (rules) css += device === "base" ? rules : `@media ${DEVICE_MEDIA[device]}{${rules}}`;
    }
  }
  return css;
}

function mapValues<T, U>(values: PerDevice<T>, map: (value: T) => U): PerDevice<U> {
  const out: PerDevice<U> = {};
  for (const [device, value] of Object.entries(values) as Array<[keyof PerDevice<T>, T]>) out[device] = map(value);
  return out;
}
