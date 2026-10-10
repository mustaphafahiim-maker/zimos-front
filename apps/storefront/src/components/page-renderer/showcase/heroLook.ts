/**
 * Where a slide's text sits over its picture, and how strong the veil between
 * the two is — on a computer and on a phone.
 *
 * All of it is read from the slide's own props (never a style key), so the
 * server stores it without knowing about it:
 *
 *   side, vertical            the computer's place — what a slide always had
 *   sideMobile, verticalMobile  the phone's place; unset, the computer's
 *   overlay                   the veil in percent, 0 to 60; unset, the default
 *                             veil for a slide with text and none without
 *   overlayMobile             the phone's veil; unset, the computer's
 *   focusX, focusY            the part of the picture kept in view when its
 *                             box crops it; unset, the centre
 *
 * A slide saved before these existed sets none of them: with the switch off it
 * resolves to the centre and the bottom with no veil on both, which is exactly
 * what the store drew, and the markup helpers then add nothing to its markup.
 * With the switch on, the one thing that changes for such a slide is the
 * default veil, when it has text.
 *
 * No imports on purpose: the node test loads this file as it is.
 */

export type HeroSide = "start" | "center" | "end";
export type HeroVertical = "top" | "middle" | "bottom";
export type HeroFocusX = "start" | "center" | "end";
export type HeroFocusY = "top" | "center" | "bottom";

export interface HeroPlacement {
  side: HeroSide;
  vertical: HeroVertical;
  /** The veil over the picture in percent, 0 to 60. 0 draws none. */
  overlay: number;
}

export interface HeroLook {
  desktop: HeroPlacement;
  /** The hero's narrow layout (up to HERO_PHONE_MAX_PX wide). */
  phone: HeroPlacement;
}

/** The strongest veil a slide may ask for, in percent: past it the picture is hardly a picture. */
export const HERO_OVERLAY_MAX = 60;
/**
 * The veil a slide with text gets while it sets none, in percent: soft enough
 * to leave the picture a picture, and the lowest step of five at which the
 * heading, being large text, reaches 3 to 1 against any picture. The two worst
 * are dark text over a black picture (3.58) and light text over a white one
 * (3.35); at 40 both fall just under 3, and with no veil they are 1.2 and 1.0.
 * The small lines need 4.5 and do not get it over those two pictures: that
 * takes 55 (5.08 and 4.76). heroLook.test.mjs works them out.
 */
export const HERO_DEFAULT_OVERLAY = 45;
/** Up to this width the hero draws its phone layout (store-sections.css). */
export const HERO_PHONE_MAX_PX = 749;

const SIDES: readonly HeroSide[] = ["start", "center", "end"];
const VERTICALS: readonly HeroVertical[] = ["top", "middle", "bottom"];
const FOCUS_X: readonly HeroFocusX[] = ["start", "center", "end"];
const FOCUS_Y: readonly HeroFocusY[] = ["top", "center", "bottom"];

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Whether any of a slide's lines of text (the small line, the heading, the line under it) shows a shopper something. */
export function heroHasText(...lines: string[]): boolean {
  return lines.some((line) => line.trim() !== "");
}

/** A stored veil: a number (or a number typed as text), rounded and held inside 0–60. Null for anything else: not set. */
function overlayOf(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(HERO_OVERLAY_MAX, Math.max(0, Math.round(n)));
}

/**
 * A slide's look on both devices. `enabled` is the store's HERO_MEDIA switch:
 * off, the phone's own values and the veil are not read at all and the slide
 * resolves as it did before they existed.
 *
 * `hasText` says the slide shows a small line, a heading or a line under it.
 * Such a slide gets the default veil while it sets none of its own; a veil it
 * does set, 0 included, is the one drawn.
 */
export function resolveHeroLook(slide: Record<string, unknown>, enabled: boolean, hasText = false): HeroLook {
  const desktop: HeroPlacement = {
    side: oneOf(slide.side, SIDES) ?? "center",
    vertical: oneOf(slide.vertical, VERTICALS) ?? "bottom",
    overlay: enabled ? (overlayOf(slide.overlay) ?? (hasText ? HERO_DEFAULT_OVERLAY : 0)) : 0,
  };
  if (!enabled) return { desktop, phone: { ...desktop } };
  return {
    desktop,
    phone: {
      side: oneOf(slide.sideMobile, SIDES) ?? desktop.side,
      vertical: oneOf(slide.verticalMobile, VERTICALS) ?? desktop.vertical,
      // 0 on a phone is a choice (no veil there), not "unset".
      overlay: overlayOf(slide.overlayMobile) ?? desktop.overlay,
    },
  };
}

/** What a slide's markup carries beyond what it always did. */
export interface HeroLookMarkup {
  /** The phone's place, only where it differs from the computer's (`data-hm`, `data-vm`). */
  phoneSide?: HeroSide;
  phoneVertical?: HeroVertical;
  /** The veil's opacity (0 to 0.6) on each device; null when neither draws one, and then no veil element is drawn. */
  overlay: { desktop: number; phone: number } | null;
}

export function heroLookMarkup(look: HeroLook): HeroLookMarkup {
  const { desktop, phone } = look;
  const markup: HeroLookMarkup = {
    overlay: desktop.overlay > 0 || phone.overlay > 0 ? { desktop: desktop.overlay / 100, phone: phone.overlay / 100 } : null,
  };
  if (phone.side !== desktop.side) markup.phoneSide = phone.side;
  if (phone.vertical !== desktop.vertical) markup.phoneVertical = phone.vertical;
  return markup;
}

/**
 * The part of a slide's picture that stays in view when the slider's box is
 * another shape and crops it. Start and end follow the page's direction, like
 * the text's place. Anything else than a known edge is the centre, which is
 * how every picture was held before the setting existed.
 */
export interface HeroFocus {
  x: HeroFocusX;
  y: HeroFocusY;
}

export function resolveHeroFocus(slide: Record<string, unknown>): HeroFocus {
  return { x: oneOf(slide.focusX, FOCUS_X) ?? "center", y: oneOf(slide.focusY, FOCUS_Y) ?? "center" };
}

/** A phone's own height is held inside these, in px: the same range the picture banner's has. */
export const HERO_PHONE_HEIGHT_MIN = 200;
export const HERO_PHONE_HEIGHT_MAX = 900;

/**
 * The slider's own height on a phone, in px (its `heightMobile` prop), or null
 * while it names none. Null keeps the phone's box as it always was, 4 wide to
 * 5 tall; a height replaces that box (store-sections.css). Zero and below are
 * no height at all.
 */
export function heroPhoneHeight(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(HERO_PHONE_HEIGHT_MAX, Math.max(HERO_PHONE_HEIGHT_MIN, Math.round(n)));
}

/** The edges a slide's markup names (`data-fx`, `data-fy`): nothing for the centre. */
export interface HeroFocusMarkup {
  focusX?: "start" | "end";
  focusY?: "top" | "bottom";
}

export function heroFocusMarkup(focus: HeroFocus): HeroFocusMarkup {
  const markup: HeroFocusMarkup = {};
  if (focus.x !== "center") markup.focusX = focus.x;
  if (focus.y !== "center") markup.focusY = focus.y;
  return markup;
}
