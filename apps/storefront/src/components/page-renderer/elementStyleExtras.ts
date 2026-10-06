/**
 * CSS for the rest of the Style tab (backend modules/pages/styleExtras.js):
 * gradient and image backgrounds, sizes, a custom shadow, overflow, cursor,
 * and hiding on a phone held upright or sideways.
 *
 * Like elementStyle.ts, nothing is copied as text: numbers are clamped,
 * keywords looked up, colours matched against a hex pattern, and the image
 * address must match a pattern with no character that can leave url("…").
 */

import { fontFamilyName, parseFontRef } from "@store-builder/api-client";

type Style = Record<string, unknown>;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const IMAGE_URL = /^(?:https?:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?)?\/[A-Za-z0-9/._~%+=&?-]*$/;

const SIZE: Record<string, string> = { cover: "cover", contain: "contain", auto: "auto" };
const POSITION: Record<string, string> = { center: "center", top: "top", bottom: "bottom", start: "left", end: "right" };
const OVERFLOW = new Set(["visible", "hidden", "auto"]);
const CURSOR = new Set(["auto", "default", "pointer", "text", "not-allowed"]);

const intIn = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
const colour = (v: unknown): string | null => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : null);

/** The extra declarations of one device's style; appended after the base ones, so they win. */
export function extraDeclarations(style: Style | undefined): string[] {
  if (!style || typeof style !== "object") return [];
  const out: string[] = [];

  // Background: the gradient lies over the image, so text stays readable on a photo.
  const layers: string[] = [];
  const from = colour(style.gradientFrom);
  const to = colour(style.gradientTo);
  if (from && to) layers.push(`linear-gradient(${intIn(style.gradientAngle, 0, 360) ?? 180}deg,${from},${to})`);
  const image = typeof style.backgroundImage === "string" && style.backgroundImage.length <= 500 && IMAGE_URL.test(style.backgroundImage) ? style.backgroundImage : null;
  if (image) layers.push(`url("${image}")`);
  if (layers.length > 0) {
    out.push(`background-image:${layers.join(",")}`);
    if (image) {
      out.push(`background-size:${SIZE[String(style.backgroundSize)] ?? "cover"}`);
      out.push(`background-position:${POSITION[String(style.backgroundPosition)] ?? "center"}`);
      out.push("background-repeat:no-repeat");
    }
  }

  const px = (key: string, prop: string, min: number, max: number) => {
    const n = intIn(style[key], min, max);
    if (n !== null) out.push(`${prop}:${n}px`);
  };
  px("height", "height", 0, 2000);
  px("minHeight", "min-height", 0, 2000);
  px("maxHeight", "max-height", 0, 4000);
  px("minWidth", "min-width", 0, 2000);

  // A custom shadow needs its colour; it replaces the sm/md/lg preset.
  const shadowColor = colour(style.shadowColor);
  if (shadowColor) {
    const x = intIn(style.shadowX, -100, 100) ?? 0;
    const y = intIn(style.shadowY, -100, 100) ?? 4;
    const blur = intIn(style.shadowBlur, 0, 200) ?? 12;
    const spread = intIn(style.shadowSpread, -100, 100) ?? 0;
    out.push(`box-shadow:${style.shadowInset === true ? "inset " : ""}${x}px ${y}px ${blur}px ${spread}px ${shadowColor}`);
  }

  if (typeof style.overflow === "string" && OVERFLOW.has(style.overflow)) out.push(`overflow:${style.overflow}`);
  if (typeof style.cursor === "string" && CURSOR.has(style.cursor)) out.push(`cursor:${style.cursor}`);
  // A Google or uploaded font (lib/storeFonts.tsx loads it); the name comes from parseFontRef's patterns.
  const font = parseFontRef(style.fontFamily);
  if (font) out.push(`font-family:"${fontFamilyName(font)}","Tajawal",ui-sans-serif,system-ui,sans-serif`);
  return out;
}

/**
 * Hiding on a phone by how it is held: upright is a narrow portrait screen,
 * sideways a short landscape one (a tablet is neither).
 */
export function orientationRules(selector: string, styles: Array<Style | undefined>): string {
  let css = "";
  if (styles.some((s) => s?.hiddenPortrait === true)) css += `@media (max-width:639px) and (orientation:portrait){${selector}{display:none}}`;
  if (styles.some((s) => s?.hiddenLandscape === true)) css += `@media (max-height:500px) and (orientation:landscape){${selector}{display:none}}`;
  return css;
}
