import { Fraunces, Plus_Jakarta_Sans, Tajawal } from "next/font/google";

/**
 * All three families are loaded on every route (the locale is only known
 * per-request, below the root layout). Each exposes a CSS variable; the root
 * layout puts every `.variable` class on <html> plus a `lang-*` class, and
 * `globals.css` maps `--font-heading` / `--font-body` to the right pair for
 * the active locale.
 */

// English headings — display serif.
export const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
  variable: "--font-fraunces",
});

// English body.
export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta",
});

// Arabic headings and body (not a variable font — weights are explicit).
// Tajawal has no 600, so `font-semibold` renders at 700.
export const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-tajawal",
});

/** Space-separated `.variable` classes for every family. */
export const fontVariables = [
  fraunces.variable,
  plusJakarta.variable,
  tajawal.variable,
].join(" ");
