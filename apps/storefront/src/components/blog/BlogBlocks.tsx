import type { ReactNode } from "react";
import type { BlogBlock, BlogBlockProduct, StorefrontProduct } from "@store-builder/api-client";
import { ProductCard } from "@/components/ProductCard";
import { StoreLink } from "@/components/StoreRoute";
import { BoxIcon } from "@/components/Icons";
import { btnPrimary } from "@/components/ui";
import { formatPrice, type Locale } from "@/lib/i18n";
import { getStorefrontProduct } from "@/lib/storeMeta";

type ProductBlock = Extract<BlogBlock, { type: "product" }>;
type Group = { kind: "block"; block: BlogBlock } | { kind: "products"; blocks: ProductBlock[] };

/** Products next to each other in the post share one row of cards. */
function groupBlocks(blocks: BlogBlock[]): Group[] {
  const groups: Group[] = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    if (block.type === "product" && last?.kind === "products") last.blocks.push(block);
    else if (block.type === "product") groups.push({ kind: "products", blocks: [block] });
    else groups.push({ kind: "block", block });
  }
  return groups;
}

/**
 * A post's body: the merchant's blocks, drawn as text — the API
 * stores no HTML and React escapes every string. Product blocks arrive with
 * the product as it is now (a product no longer on sale is already left out);
 * each is shown as the store's own product card, with its add-to-cart.
 */
export async function BlogBlocks({
  blocks,
  workspaceId,
  currency,
  locale,
}: {
  blocks: BlogBlock[];
  workspaceId: string;
  currency: string;
  locale: Locale;
}) {
  // The full product (variants, offers) for the card's add-to-cart, fetched once each.
  const slugs = [...new Set(blocks.flatMap((b) => (b.type === "product" && b.product ? [b.product.slug] : [])))];
  const found = await Promise.all(slugs.map((slug) => getStorefrontProduct(workspaceId, slug).catch(() => null)));
  const products = new Map<string, StorefrontProduct>();
  slugs.forEach((slug, i) => {
    const product = found[i];
    if (product) products.set(slug, product);
  });

  return (
    <div className="space-y-5 text-base leading-relaxed text-ink sm:text-[17px]">
      {groupBlocks(blocks).map((group, i) =>
        group.kind === "products" ? (
          <div key={i} className="grid grid-cols-2 gap-3 py-2 sm:gap-4">
            {group.blocks.map((block, j) => {
              if (!block.product) return null;
              const product = products.get(block.product.slug);
              return product ? (
                <ProductCard key={`${block.productId}-${j}`} product={product} currency={currency} locale={locale} />
              ) : (
                <ProductLinkCard key={`${block.productId}-${j}`} product={block.product} locale={locale} />
              );
            })}
          </div>
        ) : (
          <Block key={i} block={group.block} locale={locale} />
        )
      )}
    </div>
  );
}

function Block({ block, locale }: { block: BlogBlock; locale: Locale }): ReactNode {
  switch (block.type) {
    case "heading":
      return block.level === 3 ? (
        <h3 dir="auto" className="pt-2 font-display text-lg font-bold text-ink sm:text-xl">
          {block.text}
        </h3>
      ) : (
        <h2 dir="auto" className="pt-3 font-display text-xl font-bold text-ink sm:text-2xl">
          {block.text}
        </h2>
      );
    case "paragraph":
      return (
        <p dir="auto" className="whitespace-pre-line">
          {block.text}
        </p>
      );
    case "image":
      return (
        <figure className="py-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.url}
            alt={block.alt ?? ""}
            loading="lazy"
            decoding="async"
            className="w-full rounded-2xl border border-line bg-paper object-cover"
          />
          {block.caption && (
            <figcaption dir="auto" className="mt-2 text-center text-sm text-ink-soft">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        // The whole list takes its words' direction, so the markers stay inside it (an Arabic post read in
        // English); numbers in the store's own digits (١، ٢، ٣ in Arabic), as prices and dates are.
        <List
          dir="auto"
          className={`space-y-1.5 ps-6 ${block.ordered ? "" : "list-disc"} marker:text-primary`}
          style={block.ordered ? { listStyleType: locale === "ar" ? "arabic-indic" : "decimal" } : undefined}
        >
          {block.items.map((item, i) => (
            <li key={i} className="ps-1">
              {item}
            </li>
          ))}
        </List>
      );
    }
    case "quote":
      return (
        <blockquote dir="auto" className="rounded-e-2xl border-s-4 border-primary bg-primary-soft px-5 py-4">
          <p className="whitespace-pre-line text-lg font-medium text-ink">
            {block.text}
          </p>
          {block.cite && (
            <footer dir="auto" className="mt-2 text-sm text-ink-soft">
              — <cite className="not-italic">{block.cite}</cite>
            </footer>
          )}
        </blockquote>
      );
    case "button":
      return (
        <p className="py-1">
          {block.url.startsWith("/") ? (
            <StoreLink href={block.url} className={btnPrimary}>
              {block.label}
            </StoreLink>
          ) : (
            <a href={block.url} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
              {block.label}
            </a>
          )}
        </p>
      );
    case "divider":
      return <hr className="border-line" />;
    default:
      return null;
  }
}

/** The product as the post names it, when its full page could not be read: a link to it. */
function ProductLinkCard({ product, locale }: { product: BlogBlockProduct; locale: Locale }) {
  return (
    <StoreLink
      href={`/products/${product.slug}`}
      className="zt-card flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper-raised transition-colors hover:border-primary"
    >
      <span className="block aspect-square overflow-hidden bg-paper">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-primary/40">
            <BoxIcon size={48} />
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col p-4">
        <span className="line-clamp-2 text-sm font-semibold text-ink sm:text-base">{product.name}</span>
        {product.price && (
          <span className="mt-2 text-base font-bold text-ink">{formatPrice(product.price.amount, product.price.currency, locale)}</span>
        )}
      </span>
    </StoreLink>
  );
}
