import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { StorefrontProduct } from "@store-builder/api-client";
import { ArrowIcon } from "@/components/Icons";
import { Faq } from "@/components/product/Faq";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductLanding } from "@/components/product/ProductLanding";
import { ProductTabs, type ProductTab } from "@/components/product/ProductTabs";
import { StoreLink } from "@/components/StoreRoute";
import { TrustStrip } from "@/components/TrustStrip";
import { container } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { getOrderBump } from "@/lib/commerce";
import { firstImage, productImages } from "@/lib/product";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta, getStorefrontProduct } from "@/lib/storeMeta";

export const revalidate = 60;

type Params = Promise<{ workspaceId: string; idOrSlug: string }>;

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
      ? product.description.replace(/\s+/g, " ").slice(0, 160)
      : getDictionary(locale).meta.storeDescription(store.name));
  const image = firstImage(product);

  return {
    title,
    description,
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

function countdownHoursFrom(themeSettings: Record<string, unknown>): number | null {
  const raw = themeSettings?.productCountdownHours;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 720) : null;
}

export default async function ProductPage({ params }: { params: Params }) {
  const { workspaceId, idOrSlug } = await params;

  // Both calls are React-cached, shared with the layout and generateMetadata.
  const [store, product] = await Promise.all([
    getStoreMeta(workspaceId),
    getStorefrontProduct(workspaceId, idOrSlug),
  ]);
  if (!store || !product) notFound();

  const client = await createServerStorefrontApiClient();
  const catalogue = await client
    .listStorefrontProducts(workspaceId, { limit: 24 })
    .then((r) => r.products)
    .catch((): StorefrontProduct[] => []);

  const locale = await getStoreLocale(store);
  const t = getDictionary(locale);
  const bump = getOrderBump(catalogue, [product.id]);

  // Details / shipping & returns / FAQ as tabs under the buy box. The
  // shipping tab is the delivery and returns answers from the FAQ, read as
  // plain paragraphs (the trust strip beside the tabs already carries the
  // four one-line promises); the FAQ tab is the whole list, as before.
  const shippingItems = t.product.faqItems.filter((_, i) => i === 1 || i === 2).map((item) => ({ title: item.q, hint: item.a }));
  const tabs: ProductTab[] = [
    ...(product.description
      ? [
          {
            id: "details",
            label: t.shop.details,
            content: (
              <div className="whitespace-pre-line rounded-2xl border border-line bg-paper-raised p-5 text-base leading-relaxed text-ink-soft sm:p-6">
                {product.description}
              </div>
            ),
          },
        ]
      : []),
    {
      id: "shipping",
      label: t.shop.shippingReturns,
      content: (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-paper-raised">
          {shippingItems.map((item) => (
            <li key={item.title} className="px-5 py-4">
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-0.5 text-sm text-ink-soft">{item.hint}</p>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "faq",
      label: t.product.faq,
      content: <Faq title={t.product.faq} items={t.product.faqItems} titleHidden />,
    },
  ];

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className={`${container} py-6 sm:py-8`}>
        <StoreLink
          href="/"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-ink-soft transition-colors hover:text-primary"
        >
          <ArrowIcon size={16} className="rotate-180 rtl:rotate-0" />
          {t.product.back}
        </StoreLink>

        <div className="mt-2 grid gap-8 md:grid-cols-2 lg:gap-12">
          <div className="md:sticky md:top-24 md:self-start">
            <ProductGallery images={productImages(product)} name={product.name} />
          </div>
          <ProductLanding
            workspaceId={workspaceId}
            product={product}
            bump={bump}
            countdownHours={countdownHoursFrom(store.themeSettings)}
          />
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_24rem]">
          <ProductTabs tabs={tabs} />
          <aside className="lg:pt-1">
            <TrustStrip t={t} inAside />
          </aside>
        </div>
      </div>
    </main>
  );
}
