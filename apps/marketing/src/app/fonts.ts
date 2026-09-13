import { Inter, Noto_Sans_Arabic } from "next/font/google";

/**
 * ZIMOS type: Inter for Latin, Noto Sans Arabic for Arabic. Both are variable
 * fonts, so every weight the brand uses (Light → Bold) comes from one file.
 *
 * Both load on every route (the locale is only known below the root layout).
 * Each exposes a CSS variable; `globals.css` feeds them into the shared
 * `--font-latin` / `--font-arabic` tokens from packages/ui/src/brand/zimos.css,
 * and the `lang-*` class on <html> picks the active pair.
 */

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-noto-sans-arabic",
});

/** Space-separated `.variable` classes for every family. */
export const fontVariables = [inter.variable, notoSansArabic.variable].join(" ");
