import { vi } from "vitest";

/**
 * The page renderer's interactive parts are split into chunks with
 * next/dynamic (components/page-renderer/lazy.tsx). Next's own server render
 * draws them in full; react-dom/server's renderToStaticMarkup, which these
 * tests render with, cannot wait for a chunk and draws nothing in their place.
 * So the tests get the parts themselves — the markup a shopper's page has.
 */
vi.mock("@/components/page-renderer/lazy", async () => {
  const [builderClient, gallery, funnel, extras, shoppable, cart, form, landing, reviews, hero, need, tabs, rail, reels, shelf, cartButton, slider, grid, quotes, countdown, newsletter, contact] =
    await Promise.all([
      import("@/components/page-renderer/builderClient"),
      import("@/components/page-renderer/GallerySlideshow"),
      import("@/components/funnel/FunnelCodForm"),
      import("@/components/page-renderer/builderExtrasClient"),
      import("@/components/ShoppableImageView"),
      import("@/components/page-renderer/CartSummary"),
      import("@/components/page-renderer/PageForm"),
      import("@/components/product/ProductLanding"),
      import("@/components/product/ProductReviews"),
      import("@/components/page-renderer/showcase/HeroSlider"),
      import("@/components/page-renderer/showcase/NeedTabs"),
      import("@/components/page-renderer/showcase/ProductTabs"),
      import("@/components/page-renderer/showcase/RailTrack"),
      import("@/components/page-renderer/showcase/ReelsTrack"),
      import("@/components/page-renderer/showcase/ShelfRail"),
      import("@/components/page-renderer/showcase/CartButton"),
      import("@/components/page-renderer/xs/XsSlider"),
      import("@/components/page-renderer/xs/XsProductGrid"),
      import("@/components/page-renderer/xs/XsQuotes"),
      import("@/components/page-renderer/xs/XsCountdown"),
      import("@/components/page-renderer/xs/XsNewsletterForm"),
      import("@/components/page-renderer/xs/XsContactForm"),
    ]);
  return {
    TabsBlock: builderClient.TabsBlock,
    CheckoutSummaryBlock: builderClient.CheckoutSummaryBlock,
    OrderSummaryBlock: builderClient.OrderSummaryBlock,
    FunnelActionButton: builderClient.FunnelActionButton,
    GallerySlideshow: gallery.GallerySlideshow,
    FunnelCodForm: funnel.FunnelCodForm,
    GalleryWithThumbs: extras.GalleryWithThumbs,
    VariantChips: extras.VariantChips,
    BundleChoice: extras.BundleChoice,
    PopupBlock: extras.PopupBlock,
    ShoppableImageView: shoppable.ShoppableImageView,
    CartSummary: cart.CartSummary,
    PageForm: form.PageForm,
    ProductLanding: landing.ProductLanding,
    ProductReviews: reviews.ProductReviews,
    HeroSlider: hero.HeroSlider,
    NeedTabs: need.NeedTabs,
    ProductTabs: tabs.ProductTabs,
    RailTrack: rail.RailTrack,
    ReelsTrack: reels.ReelsTrack,
    ShelfRail: shelf.ShelfRail,
    CartButton: cartButton.CartButton,
    XsSlider: slider.XsSlider,
    XsProductGrid: grid.XsProductGrid,
    XsQuotes: quotes.XsQuotes,
    XsCountdown: countdown.XsCountdown,
    XsNewsletterForm: newsletter.XsNewsletterForm,
    XsContactForm: contact.XsContactForm,
  };
});
