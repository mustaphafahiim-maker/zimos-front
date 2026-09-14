import type { ReactNode } from "react";
import type { RendererLocale, RendererStrings } from "./strings";
import type { NodePath } from "./tree";

/** A single product referenced from a `product_card` element. */
export interface ProductRef {
  /** Product id or slug; empty = host decides (e.g. newest product). */
  productId: string;
  title: string;
  showPrice: boolean;
  showBuyButton: boolean;
  /** "card" = compact spotlight; "landing" = big COD block with the order form. */
  variant: "card" | "landing";
}

/** A `product_list` element's query. */
export interface ProductGridQuery {
  title: string;
  /** Stored by the editor; hosts that can't sort should ignore it rather than mislabel. */
  source: string;
  collectionId: string;
  limit: number;
  columns: number;
}

export interface CollectionListQuery {
  title: string;
  limit: number;
  columns: number;
}

export interface EditorBridge {
  /** Turns on selection outlines, data attributes and inline editing. */
  enabled: boolean;
  selectedPath?: NodePath | null;
  onSelect?: (path: NodePath) => void;
  /** Fired on blur of an inline-editable text field, with the new plain text. */
  onInlineEdit?: (path: NodePath, field: string, value: string) => void;
}

/**
 * Everything app-specific the renderer needs, injected by the host app
 * (Next.js storefront, Vite dashboard builder). The renderer never fetches
 * and never imports a router.
 */
export interface RenderContext {
  locale: RendererLocale;
  /** Overrides for the renderer's built-in UI strings. */
  t?: Partial<RendererStrings>;

  /** Map a merchant href ("/about", "https://…") to an app URL. Return null to render plain text. */
  resolveHref?: (href: string) => string | null;
  /** Render a link. Default: plain <a>. `href` is already resolved. */
  renderLink?: (href: string, children: ReactNode, className?: string) => ReactNode;
  /** Render an image. Default: <img loading="lazy">. */
  renderImage?: (src: string, alt: string, sizes?: string, className?: string) => ReactNode;
  /** Format a minor-unit amount. */
  formatMoney?: (minor: number, currency: string) => string;

  // Commerce slots — when a slot is missing, the block renders a neutral placeholder in editor mode and nothing live.
  renderProductCard?: (ref: ProductRef) => ReactNode;
  renderProductGrid?: (query: ProductGridQuery) => ReactNode;
  renderCollectionList?: (query: CollectionListQuery) => ReactNode;
  renderOrderForm?: (ref: ProductRef) => ReactNode;
  renderAddToCart?: (ref: ProductRef) => ReactNode;
  renderCart?: (props: { title: string }) => ReactNode;

  editor?: EditorBridge;
}
