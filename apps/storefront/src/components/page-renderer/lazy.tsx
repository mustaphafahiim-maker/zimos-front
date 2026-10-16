"use client";

import dynamic from "next/dynamic";

/**
 * The page renderer's interactive parts that only some pages have — a
 * checkout or order summary, a funnel's buttons and order form, tabs, the
 * picture slideshows, a bundle or variant picker, a popup, a shoppable
 * picture, a whole product landing (with its order form) and the reviews,
 * the cart summary, the contact form, the showcase bands' sliders,
 * tabs and rails, and the imported templates' (xs) sliders, product grid,
 * quotes, countdown and forms — each split into its own
 * chunk, the way the immersive ones are (components/immersive/lazy.tsx).
 *
 * Imported directly, every one of them was in the JavaScript of every store
 * page, whichever elements the page had: a home page of product bands paid
 * for the checkout's code. Through these, a page downloads only the parts it
 * draws. They still render on the server (next/dynamic's default), so
 * nothing pops in after load.
 */
export const TabsBlock = dynamic(() => import("./builderClient").then((m) => m.TabsBlock));
export const CheckoutSummaryBlock = dynamic(() => import("./builderClient").then((m) => m.CheckoutSummaryBlock));
export const OrderSummaryBlock = dynamic(() => import("./builderClient").then((m) => m.OrderSummaryBlock));
export const FunnelActionButton = dynamic(() => import("./builderClient").then((m) => m.FunnelActionButton));
export const GallerySlideshow = dynamic(() => import("./GallerySlideshow").then((m) => m.GallerySlideshow));
export const FunnelCodForm = dynamic(() => import("../funnel/FunnelCodForm").then((m) => m.FunnelCodForm));
export const GalleryWithThumbs = dynamic(() => import("./builderExtrasClient").then((m) => m.GalleryWithThumbs));
export const VariantChips = dynamic(() => import("./builderExtrasClient").then((m) => m.VariantChips));
export const BundleChoice = dynamic(() => import("./builderExtrasClient").then((m) => m.BundleChoice));
export const PopupBlock = dynamic(() => import("./builderExtrasClient").then((m) => m.PopupBlock));
export const ShoppableImageView = dynamic(() => import("../ShoppableImageView").then((m) => m.ShoppableImageView));
export const CartSummary = dynamic(() => import("./CartSummary").then((m) => m.CartSummary));
export const ProductLanding = dynamic(() => import("../product/ProductLanding").then((m) => m.ProductLanding));
export const ProductReviews = dynamic(() => import("../product/ProductReviews").then((m) => m.ProductReviews));
export const PageForm = dynamic(() => import("./PageForm").then((m) => m.PageForm));
export const HeroSlider = dynamic(() => import("./showcase/HeroSlider").then((m) => m.HeroSlider));
export const NeedTabs = dynamic(() => import("./showcase/NeedTabs").then((m) => m.NeedTabs));
export const ProductTabs = dynamic(() => import("./showcase/ProductTabs").then((m) => m.ProductTabs));
export const RailTrack = dynamic(() => import("./showcase/RailTrack").then((m) => m.RailTrack));
export const ReelsTrack = dynamic(() => import("./showcase/ReelsTrack").then((m) => m.ReelsTrack));
export const ShelfRail = dynamic(() => import("./showcase/ShelfRail").then((m) => m.ShelfRail));
export const CartButton = dynamic(() => import("./showcase/CartButton").then((m) => m.CartButton));
export const XsSlider = dynamic(() => import("./xs/XsSlider").then((m) => m.XsSlider));
export const XsProductGrid = dynamic(() => import("./xs/XsProductGrid").then((m) => m.XsProductGrid));
export const XsQuotes = dynamic(() => import("./xs/XsQuotes").then((m) => m.XsQuotes));
export const XsCountdown = dynamic(() => import("./xs/XsCountdown").then((m) => m.XsCountdown));
export const XsNewsletterForm = dynamic(() => import("./xs/XsNewsletterForm").then((m) => m.XsNewsletterForm));
export const XsContactForm = dynamic(() => import("./xs/XsContactForm").then((m) => m.XsContactForm));
