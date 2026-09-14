/**
 * Every page under `/[locale]`. The sitemap is generated from this list, so a
 * new page must be added here too. `""` is the home page.
 */
export const PAGE_PATHS = [
  "",
  "/features",
  "/pricing",
  "/about",
  "/contact",
  "/help",
  "/changelog",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/cookies",
] as const;

export type PagePath = (typeof PAGE_PATHS)[number];
