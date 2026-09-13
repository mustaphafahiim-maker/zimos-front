import { Inter, Noto_Sans_Arabic } from "next/font/google";

/**
 * Self-hosted brand faces. Each exposes a CSS variable that globals.css maps
 * onto the ZIMOS --font-latin / --font-arabic slots; `[dir="rtl"]` in the
 * brand stylesheet then switches the whole subtree to the Arabic face.
 */
export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-noto-arabic",
});

export const fontVariables = `${inter.variable} ${notoSansArabic.variable}`;
