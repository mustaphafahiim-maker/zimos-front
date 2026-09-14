import Link from "next/link";
import type { PageTree } from "@store-builder/api-client";
import { PageRenderer, type RenderContext, type Tree } from "@store-builder/store-renderer";
import { formatPrice, getDictionary, type Locale } from "@/lib/i18n";
import { CartSummary } from "./CartSummary";
import {
  AddToCartBlock,
  CollectionListBlock,
  FeaturedProductBlock,
  ProductCardBlock,
  ProductGridBlock,
} from "./store-blocks/commerceBlocks";

/**
 * Merchant-authored links are written as if the store sat at the site root
 * ("/about", "/?search=1#products"), but this app serves each store under
 * `/store/:workspaceId`. Absolute URLs, anchors, mailto: and tel: pass through.
 */
export function storeHref(href: string, workspaceId: string): string {
  const base = `/store/${workspaceId}`;
  if (/^(https?:|mailto:|tel:|#)/i.test(href)) return href;
  if (href === base || href.startsWith(`${base}/`) || href.startsWith(`${base}?`) || href.startsWith(`${base}#`)) return href;
  if (href === "/") return base;
  if (href.startsWith("/?") || href.startsWith("/#")) return `${base}${href.slice(1)}`;
  if (href.startsWith("/")) return `${base}${href}`;
  return `${base}/${href}`;
}

/**
 * The storefront's host for the shared renderer: injects next/link, money
 * formatting, and real catalogue data into the commerce slots. Everything
 * visual comes from @store-builder/store-renderer, so the dashboard builder
 * renders the exact same markup.
 */
export function StorePage({
  tree,
  workspaceId,
  currency,
  locale,
  className,
}: {
  tree: PageTree | Tree | null;
  workspaceId: string;
  currency: string;
  locale: Locale;
  className?: string;
}) {
  const t = getDictionary(locale);
  const ctx: RenderContext = {
    locale,
    t: { openInMaps: t.renderer.openInMaps, formPreview: t.renderer.formPreview },
    resolveHref: (href) => storeHref(href, workspaceId),
    renderLink: (href, children, cls) => (
      <Link href={href} className={cls}>
        {children}
      </Link>
    ),
    formatMoney: (minor, cur) => formatPrice(minor, cur, locale),
    renderProductGrid: (query) => <ProductGridBlock query={query} workspaceId={workspaceId} currency={currency} locale={locale} />,
    renderProductCard: (ref) => <ProductCardBlock productRef={ref} workspaceId={workspaceId} currency={currency} locale={locale} />,
    renderOrderForm: (ref) => <FeaturedProductBlock productRef={ref} workspaceId={workspaceId} locale={locale} />,
    renderAddToCart: (ref) => <AddToCartBlock productRef={ref} workspaceId={workspaceId} />,
    renderCollectionList: (query) => <CollectionListBlock query={query} workspaceId={workspaceId} locale={locale} />,
    renderCart: ({ title }) => <CartSummary title={title} workspaceId={workspaceId} />,
  };

  return <PageRenderer tree={tree as Tree | null} ctx={ctx} className={className} />;
}
