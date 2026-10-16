import { vi } from "vitest";

/**
 * The imported templates' interactive parts are split into chunks with
 * next/dynamic (components/page-renderer/lazy.tsx). Next's own server render
 * draws them in full; react-dom/server's renderToStaticMarkup, which these
 * tests render with, cannot wait for a chunk and draws nothing in their place.
 * So the tests get the parts themselves — the markup a shopper's page has.
 */
vi.mock("@/components/page-renderer/lazy", async () => {
  const [slider, grid, quotes, countdown, newsletter, contact] = await Promise.all([
    import("@/components/page-renderer/xs/XsSlider"),
    import("@/components/page-renderer/xs/XsProductGrid"),
    import("@/components/page-renderer/xs/XsQuotes"),
    import("@/components/page-renderer/xs/XsCountdown"),
    import("@/components/page-renderer/xs/XsNewsletterForm"),
    import("@/components/page-renderer/xs/XsContactForm"),
  ]);
  return {
    XsSlider: slider.XsSlider,
    XsProductGrid: grid.XsProductGrid,
    XsQuotes: quotes.XsQuotes,
    XsCountdown: countdown.XsCountdown,
    XsNewsletterForm: newsletter.XsNewsletterForm,
    XsContactForm: contact.XsContactForm,
  };
});
