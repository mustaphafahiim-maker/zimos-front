import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { renderToPipeableStream } from "react-dom/server.node";
import type { PageElement, PageTree, StorefrontProduct } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { PageRenderer } from "./PageRenderer";

/**
 * The store templates written in this repository (the merchant dashboard's
 * pages/website/templates, one generated JSON file each), drawn by the real
 * page renderer the way a shopper's page is: every section and every element
 * must draw something, every picture must sit in a box of its own, and nothing
 * may point outside the store.
 *
 * The catalogue is a stand-in (eight products, three collections): a template
 * brings no products, and its product sections draw the store's own.
 */

vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useStoreBasePath: () => "",
}));
vi.mock("@/lib/storeMeta", () => ({ getStoreMeta: async () => null }));
vi.mock("@/lib/CartProvider", () => ({ useCart: () => ({ addItem: async () => undefined, openDrawer: () => undefined, itemCount: 0 }) }));

const catalogue = vi.hoisted(() => ({ products: [] as unknown[] }));
vi.mock("@/lib/serverApiClient", () => ({
  createServerStorefrontApiClient: async () => ({
    listStorefrontProducts: async (_ws: string, query: { limit?: number } = {}) => ({ products: catalogue.products.slice(0, query.limit ?? 8), nextCursor: null }),
    searchStorefrontProducts: async (_ws: string, query: { limit?: number } = {}) => ({ products: catalogue.products.slice(0, query.limit ?? 8), nextCursor: null }),
    getStorefrontProduct: async () => catalogue.products[0],
    listStorefrontCollections: async () => [
      { id: "c1", name: "قسم ١", slug: "one", description: null, seo: null },
      { id: "c2", name: "قسم ٢", slug: "two", description: null, seo: null },
      { id: "c3", name: "قسم ٣", slug: "three", description: null, seo: null },
    ],
  }),
}));

const PRODUCTS: StorefrontProduct[] = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `منتج ${i + 1}`,
  slug: `product-${i + 1}`,
  description: null,
  productType: "physical",
  media: [{ url: `https://cdn.zimos.test/product-${i + 1}.jpg`, mimeType: "image/jpeg" }],
  tags: [],
  seo: null,
  variants: [{ id: `v${i + 1}`, sku: `S${i + 1}`, optionValues: {}, priceAmount: "25000", compareAtAmount: i === 0 ? "30000" : null, currency: "EGP", inStock: true } as unknown as StorefrontProduct["variants"][number]],
  offers: [],
  customFields: [],
  hasOptionGroups: false,
}));

const STORE: StoreInfo = {
  workspaceId: "w1",
  id: "w1",
  slug: "shop",
  name: "Shop",
  currency: "EGP",
  logoUrl: null,
  phone: null,
  checkout: { email: "optional", postal_code: "hidden", notes: "optional" },
  orderBump: null,
};

interface Template {
  key: string;
  name: string;
  rtl: boolean;
  version: { globalStyles: Record<string, unknown>; pages: Array<{ path: string; title: string; pageType: string; builderData: PageTree }> };
}

const GENERATED = resolve(__dirname, "../../../../merchant-dashboard/src/pages/website/templates/generated");
const ART = resolve(__dirname, "../../../public/template-art");
const templates: Template[] = readdirSync(GENERATED)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => JSON.parse(readFileSync(resolve(GENERATED, name), "utf8")) as Template);
const pages = templates.flatMap((template) => template.version.pages.map((page) => [`${template.key} ${page.path}`, template, page] as const));

/** The whole page as the server sends it: the catalogue sections wait for their products before the markup is taken. */
async function draw(tree: PageTree, editable = false): Promise<HTMLElement> {
  const rendered = await PageRenderer({ tree, workspaceId: "w1", currency: "EGP", locale: "ar", editable });
  const html = await new Promise<string>((done, fail) => {
    let out = "";
    const sink = new Writable({
      write(chunk, _encoding, next) {
        out += chunk.toString();
        next();
      },
      final(next) {
        done(out);
        next();
      },
    });
    const stream = renderToPipeableStream(
      <StoreContextProvider locale="ar" store={STORE}>
        {rendered as React.ReactElement}
      </StoreContextProvider>,
      { onAllReady: () => stream.pipe(sink), onError: fail }
    );
  });
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

const elementsOf = (tree: PageTree): PageElement[] => tree.sections.flatMap((s) => s.rows.flatMap((r) => r.columns.flatMap((c) => c.elements)));

/** What holds a picture in shape: a shape of its own, or the box of the band, the grid or the card it sits in. */
function boxOf(img: HTMLImageElement): string | null {
  if (img.style.aspectRatio) return `shape ${img.style.aspectRatio}`;
  if (img.closest(".zs-hero__media")) return "slider";
  if (img.closest(".zs-cats__box")) return "tile";
  if (img.closest(".zs-banner__media")) return "banner";
  if (img.closest(".zs-pgrid__box, .zs-pcard__box")) return "product band";
  if (img.classList.contains("aspect-square")) return "gallery square";
  if (img.closest(".aspect-square")) return "product card";
  return null;
}

describe("the store templates on the storefront", () => {
  it("are the generated files, each a template that reads right to left", () => {
    expect(templates.map((t) => t.key)).toEqual(["departments", "drinks", "fashion", "home-living", "season-offers", "single-product"]);
    for (const template of templates) expect(template.rtl, template.key).toBe(true);
  });

  it.each(pages)("%s: every section and every element draws something", async (_name, _template, page) => {
    catalogue.products = PRODUCTS;
    const tree = page.builderData;

    // As a shopper gets it: one drawn section per section of the tree.
    const shopper = await draw(tree);
    const sections = Array.from(shopper.querySelectorAll<HTMLElement>("[data-zt-section]"));
    expect(sections).toHaveLength(tree.sections.length);
    for (const section of sections) expect(section.textContent!.trim().length + section.querySelectorAll("img, svg").length).toBeGreaterThan(0);
    // No "nothing here yet" placeholder anywhere: the catalogue is there and every block is filled.
    expect(shopper.querySelector(".border-dashed")).toBeNull();

    // In the editor's preview each element carries its id: none of them is empty.
    const canvas = await draw(tree, true);
    for (const element of elementsOf(tree)) {
      const marker = canvas.querySelector<HTMLElement>(`[data-zimos-el="${element.id}"]`);
      expect(marker, element.id).not.toBeNull();
      expect(marker!.innerHTML.trim().length, `${element.id} (${element.type})`).toBeGreaterThan(0);
    }
    expect(canvas.querySelector(".border-dashed")).toBeNull();
  });

  it.each(pages)("%s: every picture sits in a box of its own and comes from the store itself", async (_name, _template, page) => {
    catalogue.products = PRODUCTS;
    const root = await draw(page.builderData);
    const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
    for (const img of images) {
      const src = img.getAttribute("src")!;
      expect(boxOf(img), src).not.toBeNull();
      // A template's own picture is one of our drawings; the only others are the store's products.
      if (!src.startsWith("https://cdn.zimos.test/product-")) {
        expect(src).toMatch(/^\/template-art\/[a-z0-9-]+\.svg$/);
        expect(readFileSync(resolve(ART, src.split("/").pop()!), "utf8")).toContain("<svg");
      }
    }
    for (const link of Array.from(root.querySelectorAll("a"))) expect(link.getAttribute("href"), link.textContent ?? "").toMatch(/^\//);
  });

  it.each(templates.map((t) => [t.key, t] as const))("%s: the home page shows every picture the template names", async (_key, template) => {
    catalogue.products = PRODUCTS;
    const home = template.version.pages[0].builderData;
    const root = await draw(home);
    // A slide's picture for a phone is a second source of the same picture.
    const drawn = new Set([
      ...Array.from(root.querySelectorAll("img")).map((img) => img.getAttribute("src")),
      ...Array.from(root.querySelectorAll("picture > source")).map((source) => source.getAttribute("srcset")),
    ]);
    const named = JSON.stringify(home).match(/\/template-art\/[a-z0-9-]+\.svg/g) ?? [];
    expect(named.length).toBeGreaterThan(0);
    for (const url of named) expect(drawn.has(url), url).toBe(true);
  });

  it.each(templates.map((t) => [t.key, t] as const))("%s: a store with no products yet reads as not ready, not as broken", async (_key, template) => {
    catalogue.products = [];
    const home = template.version.pages[0].builderData;
    const root = await draw(home);
    // Every section is still there; a product band draws nothing, and a product grid says its products are coming.
    expect(root.querySelectorAll("[data-zt-section]")).toHaveLength(home.sections.length);
    const grids = elementsOf(home).filter((e) => e.type === "product_list").length;
    expect(root.querySelectorAll(".border-dashed")).toHaveLength(grids);
    for (const product of PRODUCTS) expect(root.textContent).not.toContain(product.name);
  });

  it("words a shopper reads are Arabic on every page", async () => {
    catalogue.products = PRODUCTS;
    for (const [, , page] of pages) {
      const root = await draw(page.builderData);
      for (const heading of Array.from(root.querySelectorAll("h1, h2"))) expect(heading.textContent, heading.textContent ?? "").toMatch(/\p{Script=Arabic}/u);
    }
  });
});
