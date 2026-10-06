/**
 * Product links from AliExpress, Etsy, CJ Dropshipping and YouCan beside
 * Shopify (frontend-handoff 180; backend
 * src/modules/catalog/importExport/importers/).
 *
 * No new endpoint: the link still goes to `catalogImportFromLink`
 * (POST /workspaces/:ws/catalog/products/import { url }, products.manage) and
 * the import is followed with `catalogGetImport`. What changes is the import's
 * `kind` and what it creates:
 *
 * - the product is a **draft with stock 0**, tagged `import:<source>`; the
 *   page's price is kept as a number in the page's own currency and the
 *   description ends with "(Imported price: 24.5 USD)";
 * - the reviews the page publishes (up to 50) are saved with
 *   `source: "import"`, `status: "pending"` — shown only after approval.
 *
 * 422 IMPORT_SOURCE_UNREACHABLE when the page refuses, times out or publishes
 * no product data; 422 VALIDATION_ERROR (field `url`) for a link that is not
 * https or not a product link.
 */
import type { CatalogImport } from "./catalog";

export type ProductImportSource = "shopify" | "aliexpress" | "etsy" | "cj" | "youcan";

/** Every source the link import reads, in the order the dashboard lists them. */
export const PRODUCT_IMPORT_SOURCES: ProductImportSource[] = ["shopify", "aliexpress", "etsy", "cj", "youcan"];

export type ProductLinkImportKind = `${ProductImportSource}_link`;

/** An import row whose `kind` may be one of the link kinds the backend added. */
export type ProductLinkImport = Omit<CatalogImport, "kind"> & { kind: CatalogImport["kind"] | ProductLinkImportKind };

// The backend's host rules (importers/index.js SOURCES). Anything else with a
// /products/<handle> path is read as a Shopify store (custom domains included).
const HOSTS: ReadonlyArray<[ProductImportSource, RegExp]> = [
  ["aliexpress", /(^|\.)aliexpress\.[a-z]{2,3}$/i],
  ["etsy", /(^|\.)etsy\.com$/i],
  ["cj", /(^|\.)cjdropshipping\.com$/i],
  ["youcan", /(^|\.)youcan\.(shop|store)$/i],
];

/** The source a pasted link belongs to, or null when it is not a link the import can read. */
export function detectProductImportSource(link: string): ProductImportSource | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const match = HOSTS.find(([, hosts]) => hosts.test(url.hostname));
  if (match) return match[0];
  if (/(^|\.)myshopify\.com$/i.test(url.hostname) || /\/products\/[^/?#]+/.test(url.pathname)) return "shopify";
  return null;
}

/** The source of a finished import's `kind`, or null for a file import. */
export function productImportSourceOf(kind: string): ProductImportSource | null {
  const source = kind.endsWith("_link") ? kind.slice(0, -"_link".length) : "";
  return (PRODUCT_IMPORT_SOURCES as string[]).includes(source) ? (source as ProductImportSource) : null;
}

/**
 * The page's own price, read back from the line the import appends to the
 * description: "(Imported price: 24.5 USD)". Null when the page had none.
 */
export function importedPagePrice(description: string | null | undefined): { amount: string; currency: string } | null {
  const match = /\(Imported price: ([\d.,]+) ([A-Z]{3})\)\s*$/.exec(description ?? "");
  return match ? { amount: match[1], currency: match[2] } : null;
}
