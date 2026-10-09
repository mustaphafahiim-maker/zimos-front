import { Suspense } from "react";
import { PixelScope } from "@/components/PixelScope";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  resolveCheckoutForm,
  resolveCheckoutFormWithBilling,
  resolveCheckoutSettings,
  storefrontDesignMeta,
  storefrontProductPage,
} from "@store-builder/api-client";
import { StoreInfoCards } from "@/components/StoreInfoCards";
import { CodeSlot } from "@/components/CustomCode";
import { ProductJsonLd } from "@/components/product/ProductJsonLd";
import { canonicalOrigin } from "@/lib/domains";
import { ProductContent } from "@/components/product/ProductContent";
import { storefrontProductReviews } from "@store-builder/api-client";
import { ProductReviews } from "@/components/product/ProductReviews";
import { ArrowIcon } from "@/components/Icons";
import { Faq } from "@/components/product/Faq";
import { TestedProductGallery } from "@/components/product/TestedProductGallery";
import { ProductLanding } from "@/components/product/ProductLanding";
import { ProductVideos } from "@/components/product/ProductVideos";
import { ProductTabs, type ProductTab } from "@/components/product/ProductTabs";
import { StoreLink } from "@/components/StoreRoute";
import { faqFromCards, shippingRows, storeCards } from "@/lib/storePromises";
import { container } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { orderBumpOf } from "@/lib/commerce";
import { findVariant, firstImage, optionGroups } from "@/lib/product";
import { buyPromises } from "@/components/product/buyPromises";
import { QuestionsSkeleton, RelatedSkeleton } from "@/components/product/ProductSkeletons";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta, getStorefrontProduct } from "@/lib/storeMeta";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { PageRenderer } from "@/components/page-renderer";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { ProductQuestions } from "@/components/product/ProductQuestions";
import { ProductSpecs } from "@/components/specs/ProductSpecs";
import { BoughtTogetherStrip } from "@/components/offers/BoughtTogether";
import { richTextToPlain } from "@store-builder/api-client";
import { RichText } from "@/components/RichText";
import { decodeSegment, type RedirectQuery } from "@/lib/urlRedirects";
import { redirectIfMoved } from "@/lib/urlRedirectsServer";

export const revalidate = 60;

type Params = Promise<{ workspaceId: string; idOrSlug: string }>;

/** A variant's own picture, read as lib/variantImage reads it (that module is the browser's). */
function ownPicture(variant: unknown): string | null {
  const url = (variant as { imageUrl?: unknown } | null | undefined)?.imageUrl;
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
}

/** Whether an offer's deadline is still ahead as the page is rendered. */
function stillRunning(endsAt: string): boolean {
  const end = new Date(endsAt).getTime();
  return Number.isFinite(end) && end > Date.now();
}

function seoString(seo: Record<string, unknown> | null, key: string): string | null {
  const v = seo?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * The canonical URL is built from the product's slug, not from the `idOrSlug`
 * that was asked for: the API answers to either, and only one of them should
 * be the address search engines keep. It stays relative so the store layout's
 * `metadataBase` resolves it onto the store's own subdomain.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId, idOrSlug } = await params;
  const [store, product] = await Promise.all([
    getStoreMeta(workspaceId),
    getStorefrontProduct(workspaceId, idOrSlug),
  ]);
  if (!store || !product) return {};

  const locale = await getStoreLocale(store);
  const title = seoString(product.seo, "title") ?? product.name;
  const description =
    seoString(product.seo, "description") ??
    (product.description
      ? richTextToPlain(product.description).replace(/\s+/g, " ").slice(0, 160)
      : getDictionary(locale).meta.storeDescription(store.name));
  // The merchant's sharing image and "hide from search engines" (product form → Search engines and sharing).
  const image = seoString(product.seo, "imageUrl") ?? firstImage(product);
  const noindex = (product.seo as Record<string, unknown> | undefined)?.noindex === true;

  return {
    title,
    description,
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      siteName: store.name,
      title,
      description,
      url: `/products/${product.slug}`,
      ...(image ? { images: [{ url: image, alt: product.name }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function ProductPage({ params, searchParams }: { params: Params; searchParams?: Promise<RedirectQuery> }) {
  const { workspaceId, idOrSlug } = await params;

  // Both calls are React-cached, shared with the layout and generateMetadata.
  const [store, product] = await Promise.all([
    getStoreMeta(workspaceId),
    getStorefrontProduct(workspaceId, idOrSlug),
  ]);
  // A product whose address changed goes on to its new one (Store settings → URL redirects, handoff 232).
  if (store && !product) await redirectIfMoved(workspaceId, `/products/${decodeSegment(idOrSlug)}`, await searchParams);
  if (!store || !product) notFound();

  const locale = await getStoreLocale(store);

  // The product's own landing page (page settings → landing page), built in the
  // page builder with this product as the page's product; the standard page
  // shows when it is not in the published website.
  const landingPath = (product as { landingPagePath?: string | null }).landingPagePath;
  if (landingPath) {
    const client = await createServerStorefrontApiClient();
    const landing = await client.getStorefrontPage(workspaceId, landingPath).catch(() => null);
    if (landing && landing.kind === "page" && (landing.data.page.tree?.sections?.length ?? 0) > 0) {
      return (
        <main className="flex-1">
          <PixelScope productIds={[product.id]} />
          <PageRenderer
            tree={{ ...landing.data.page.tree, productId: product.id } as typeof landing.data.page.tree}
            workspaceId={workspaceId}
            currency={store.currency}
            locale={locale}
            siteStyles={landing.data.site?.globalStyles}
            pageId={(landing.data.page as { id?: string | null }).id}
          />
        </main>
      );
    }
  }

  const t = getDictionary(locale);
  // The merchant's bump — not on its own product's page.
  const bump = orderBumpOf(store.orderBump, [product.id]);
  // The product page's own settings and content (lane 3), defaults filled in.
  const page = storefrontProductPage(product);
  const ps = page.pageSettings;
  // With "form above the description" off, the buy box shows the description itself.
  const descriptionInBuyBox = ps.inline_checkout && !ps.checkout_before_description;
  const checkoutForm = resolveCheckoutFormWithBilling(store.checkout);
  // The photo the page opens on: the picture of the variant the buy box starts
  // with (ProductLanding picks the same one — the variant an ad or feed link
  // names, else the first in stock when variants are pre-selected), so the
  // first photo sent is the one that stays.
  const linkedId = (await searchParams)?.variant;
  const linkedVariant = typeof linkedId === "string" ? product.variants.find((v) => v.id === linkedId) : undefined;
  const firstVariant = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const hasOptions = optionGroups(product.variants).length > 0;
  const preselects = ps.auto_select_variant !== false && checkoutForm.auto_select_variant !== false;
  const openingVariant =
    linkedVariant ??
    (!hasOptions ? firstVariant : preselects && firstVariant ? findVariant(product.variants, { ...(firstVariant.optionValues ?? {}) }) : undefined);
  const leadImage = ownPicture(openingVariant);
  // The store's own shipping / returns / COD cards (lib/storePromises.ts): the
  // only promises this page makes about them.
  const cards = storeCards(store);
  const showTrust = resolveCheckoutForm(store.checkout).show_trust_badges;
  // The theme's phone toolbar (components/shell/ThemeChrome reads the same switch): the buy bar sits above it.
  const phoneToolbar = (store.themeSettings as { mobileToolbar?: unknown } | null | undefined)?.mobileToolbar === true;
  // The product's own questions; else the store-wide ones, answered from the cards.
  const [payQ, arriveQ, returnsQ] = t.product.faqItems.map((item) => item.q);
  const faqItems =
    page.cms.faqs.length > 0
      ? page.cms.faqs.map((item) => ({ q: item.question, a: item.answer }))
      : faqFromCards(cards, { pay: payQ, arrive: arriveQ, returns: returnsQ });

  // Details / shipping & returns / FAQ as tabs under the buy box, each only
  // when there is something true to put in it.
  const shippingItems = shippingRows(cards, locale);
  const tabs: ProductTab[] = [
    ...(product.description && !descriptionInBuyBox
      ? [
          {
            id: "details",
            label: t.shop.details,
            content: (
              <div className="rounded-2xl border border-line bg-paper-raised p-5 text-base leading-relaxed text-ink-soft sm:p-6">
                <RichText text={product.description} />
              </div>
            ),
          },
        ]
      : []),
    ...(shippingItems.length > 0
      ? [
          {
            id: "shipping",
            label: t.shop.shippingReturns,
            content: (
              <ul className="divide-y divide-line rounded-2xl border border-line bg-paper-raised">
                {shippingItems.map((item) => (
                  <li key={item.title} className="px-5 py-4">
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    {item.points.map((point, i) => (
                      <p key={i} className="mt-0.5 text-sm text-ink-soft">
                        {point}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            ),
          },
        ]
      : []),
    ...(faqItems.length > 0
      ? [
          {
            id: "faq",
            label: t.product.faq,
            content: <Faq title={t.product.faq} items={faqItems} titleHidden />,
          },
        ]
      : []),
  ];

  return (
    // Room under the last line for the phone's buy bar, when the product has it.
    <main className={ps.sticky_buy_button ? "flex-1 pb-24 md:pb-0" : "flex-1"}>
      {/* Lets a pixel scoped to this product receive this visit (Marketing → Tracking tools). */}
      <PixelScope productIds={[product.id]} />
      {/* schema.org Product for search engines and Google Merchant. */}
      <ProductJsonLd
        product={product}
        url={`${canonicalOrigin(store)}/products/${product.slug}`}
        currency={store.currency}
        storeName={store.name}
      />
      {/* A landing page without the store's menu: hidden only while this page is shown. */}
      {ps.hide_header && (
        <style
          dangerouslySetInnerHTML={{
            __html: '[data-zimos-shell="header"],[data-zimos-shell="header"]+nav{display:none!important}',
          }}
        />
      )}
      <div className={`${container} py-6 sm:py-8`}>
        <StoreLink
          href="/"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-ink-soft transition-colors hover:text-primary"
        >
          <ArrowIcon size={16} className="rotate-180 rtl:rotate-0" />
          {t.product.back}
        </StoreLink>

        <div className="zt-pdp mt-2 grid gap-8 md:grid-cols-2 lg:gap-12">
          <div className="md:sticky md:top-24 md:self-start">
            <CodeSlot name="above_gallery" />
            <TestedProductGallery workspaceId={workspaceId} product={product} leadImage={leadImage} />
            <ProductVideos product={product} label={product.name} />
            <CodeSlot name="below_gallery" />
          </div>
          <ProductLanding
            workspaceId={workspaceId}
            product={product}
            bump={bump}
            description={descriptionInBuyBox ? product.description : null}
            checkoutSettings={{ ...resolveCheckoutSettings(store.checkout), form: checkoutForm } as ReturnType<typeof resolveCheckoutSettings>}
            // The store's own cards as the short lines under the buy buttons; none when its trust badges are off.
            promises={showTrust ? buyPromises(cards, locale) : null}
            phoneToolbar={phoneToolbar}
            countdownRunning={ps.countdown ? stillRunning(ps.countdown.ends_at) : false}
          />
        </div>

        <ProductContent cms={page.cms} locale={locale} />

        {/* «المواصفات» and «قارن»: only for a product that has specifications (handoff 231). */}
        {/* Read on its own and streamed in: the photo and the buy box do not wait for it. Most products have
            no specifications, so nothing holds its place. */}
        <Suspense fallback={null}>
          <ProductSpecs workspaceId={workspaceId} product={product} locale={locale} />
        </Suspense>

        {ps.reviews_enabled && (
          <ProductReviews
            workspaceId={workspaceId}
            productId={product.id}
            {...storefrontProductReviews(product)}
            formOpen={(product as { reviewFormOpen?: boolean }).reviewFormOpen !== false}
          />
        )}

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_24rem]">
          <ProductTabs tabs={tabs} />
          <aside className="lg:pt-1">
            {/* The merchant's own shipping / returns / COD cards, when written; nothing invented otherwise. */}
            {showTrust && cards.length > 0 && (
              <StoreInfoCards info={storefrontDesignMeta(store).storeInfo!} />
            )}
          </aside>
        </div>

        {/* «بيتشروا مع بعض»: the merchant's pins, else what real orders show it is bought with (handoff 223). */}
        <BoughtTogetherStrip workspaceId={workspaceId} productId={product.id} />

        {/* «أسئلة وأجوبة»: the questions the store answered, and the form to ask one (handoff 212). */}
        <Suspense fallback={<QuestionsSkeleton />}>
          <ProductQuestions workspaceId={workspaceId} productId={product.id} />
        </Suspense>

        {/* Similar products, unless the page settings hide them. */}
        {!ps.hide_related_products && (
          <Suspense fallback={<RelatedSkeleton />}>
            <RelatedProducts workspaceId={workspaceId} product={product} currency={store.currency} locale={locale} />
          </Suspense>
        )}
      </div>
    </main>
  );
}
