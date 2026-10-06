import {
  storefrontDesignMeta,
  storefrontPolicy,
  storefrontProductPage,
  type PageElement,
  type PageTree,
  type StorefrontProductDetail,
} from "@store-builder/api-client";
import { formatPrice, type Locale } from "@/lib/i18n";
import { compareAtOf, priceOf, productImages } from "@/lib/product";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreMeta } from "@/lib/storeMeta";
import { richTextToPlain } from "@store-builder/api-client";

/**
 * Data binding (SPEC §9.4). An element may carry
 *
 *   props.bindings = { <propKey>: "<source>" }
 *
 * and that prop is then filled from live data instead of the text typed in
 * the editor: `product.title`, `product.price`, `product.images[0]`,
 * `store.name`, `legal.refund_policy`, … (the closed list the backend checks —
 * BINDING_SOURCE in modules/pages/pageTree.js). With the bindings pointing at
 * "the page's product", one page works for any product: change the product,
 * not the page.
 *
 * The page's product is `tree.productId`; without one it is the product of the
 * first product element on the page that names one, and failing that the
 * store's newest product.
 *
 * A source with nothing to give leaves the typed value in place, so a page
 * never shows a hole where the data was missing.
 */

export interface BindingData {
  /** The page's product; null when the store has none or the call failed. */
  product: StorefrontProductDetail | null;
  /** Resolved source → text or URL. */
  values: Map<string, string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRODUCT_TYPES = new Set(["price", "reviews_list", "cod_form", "repeater", "product_card", "product_3d"]);

function elementsOf(tree: PageTree | null): PageElement[] {
  const out: PageElement[] = [];
  for (const section of tree?.sections ?? []) {
    for (const row of section?.rows ?? []) {
      for (const column of row?.columns ?? []) {
        for (const element of column?.elements ?? []) out.push(element);
      }
    }
  }
  return out;
}

function bindingsOf(element: PageElement): Record<string, string> {
  const raw = (element.props as Record<string, unknown> | undefined)?.bindings;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, source] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof source === "string" && source) out[key] = source;
  }
  return out;
}

/** The page's product id: the tree's own, else the first product element's; "" when none names one. */
export function pageProductId(tree: PageTree | null): string {
  const own = (tree as { productId?: unknown } | null)?.productId;
  if (typeof own === "string" && UUID.test(own)) return own;
  for (const element of elementsOf(tree)) {
    if (!PRODUCT_TYPES.has(element.type)) continue;
    const id = (element.props as Record<string, unknown> | undefined)?.productId;
    if (typeof id === "string" && UUID.test(id)) return id;
  }
  return "";
}

/** Whether anything on the page needs the page's product or bound data at all. */
function needsData(tree: PageTree | null): { any: boolean; sources: Set<string> } {
  const sources = new Set<string>();
  let any = false;
  for (const element of elementsOf(tree)) {
    if (element.type === "repeater") any = true;
    for (const source of Object.values(bindingsOf(element))) {
      sources.add(source);
      any = true;
    }
  }
  return { any, sources };
}

/**
 * Loads what the page's bindings and repeaters read. Returns null for a page
 * that uses neither — such a page makes no extra call and renders exactly as
 * it did before bindings existed.
 */
export async function loadBindingData(
  tree: PageTree | null,
  workspaceId: string,
  currency: string,
  locale: Locale
): Promise<BindingData | null> {
  const { any, sources } = needsData(tree);
  if (!any) return null;

  const values = new Map<string, string>();
  const set = (key: string, value: unknown) => {
    if (typeof value === "string" && value.trim()) values.set(key, value);
  };
  const wants = (prefix: string) => [...sources].some((s) => s.startsWith(prefix));
  const hasRepeater = elementsOf(tree).some((e) => e.type === "repeater");

  let product: StorefrontProductDetail | null = null;
  if (wants("product.") || hasRepeater) {
    try {
      const client = await createServerStorefrontApiClient();
      let ref = pageProductId(tree);
      if (!ref) ref = (await client.listStorefrontProducts(workspaceId, { limit: 1 })).products[0]?.id ?? "";
      product = ref ? await client.getStorefrontProduct(workspaceId, ref) : null;
    } catch {
      product = null;
    }
    if (product) {
      set("product.title", product.name);
      // A bound text shows the description without its formatting marks.
      set("product.description", product.description ? richTextToPlain(product.description) : product.description);
      const price = priceOf(product);
      if (price !== undefined) set("product.price", formatPrice(price, currency, locale));
      const compareAt = compareAtOf(product);
      if (compareAt !== null) set("product.compare_at", formatPrice(compareAt, currency, locale));
      set("product.special_offer_text", storefrontProductPage(product).specialOfferText);
      productImages(product)
        .slice(0, 10)
        .forEach((src, i) => set(`product.images[${i}]`, src));
    }
  }

  if (wants("store.")) {
    const store = await getStoreMeta(workspaceId).catch(() => null);
    if (store) {
      const info = storefrontDesignMeta(store).storeInfo;
      set("store.name", store.name);
      set("store.phone", info?.phone);
      set("store.email", info?.email);
      set("store.address", info?.address);
    }
  }

  const policies = [...sources].filter((s) => s.startsWith("legal."));
  if (policies.length > 0) {
    const client = await createServerStorefrontApiClient();
    await Promise.all(
      policies.map(async (source) => {
        try {
          set(source, (await storefrontPolicy(client, workspaceId, source.slice("legal.".length))).content);
        } catch {
          /* not written: the typed text stays */
        }
      })
    );
  }

  return { product, values };
}

/** The element's props with every bound prop replaced by its live value, when there is one. */
export function applyBindings(element: PageElement, data: BindingData | null): Record<string, unknown> {
  const props = (element.props ?? {}) as Record<string, unknown>;
  if (!data) return props;
  const bindings = bindingsOf(element);
  const keys = Object.keys(bindings);
  if (keys.length === 0) return props;
  const next = { ...props };
  for (const key of keys) {
    // `bindings` itself and anything that is not a plain value slot stay untouched.
    if (key === "bindings") continue;
    const value = data.values.get(bindings[key]);
    if (value !== undefined) next[key] = value;
  }
  return next;
}
