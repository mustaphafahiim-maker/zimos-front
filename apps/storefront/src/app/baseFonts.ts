import { Fraunces, Plus_Jakarta_Sans, Tajawal } from "next/font/google";

/**
 * The original look's typefaces — the families globals.css names in
 * `--font-display` and `--font-sans` — served from this app's own
 * `/_next/static/media` like the themes' (themeFonts.ts), where they used to
 * come from a Google Fonts stylesheet linked in the root layout. That link
 * held up every store's first paint while two more origins were connected
 * to; these faces arrive in the app's own stylesheet instead.
 *
 * next/font registers each face under its real family name, so the stacks in
 * globals.css pick them up unchanged. Same families, weights and `display:
 * swap` as the link asked for; Fraunces keeps its optical-size axis. Not
 * preloaded, for the same reason as the themes: a store with a theme never
 * draws these, and a browser fetches a face only once text uses it.
 */
export const fraunces = Fraunces({ display: "swap", preload: false, subsets: ["latin"], axes: ["opsz"] });
export const plusJakartaSans = Plus_Jakarta_Sans({ display: "swap", preload: false, subsets: ["latin"], weight: ["400", "500", "600", "700"] });
export const tajawal = Tajawal({ display: "swap", preload: false, subsets: ["arabic", "latin"], weight: ["400", "500", "700"] });
