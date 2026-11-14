import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToPipeableStream } from "react-dom/server.node";
import type { PageTree, StorefrontProduct } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { PageRenderer } from "../PageRenderer";
import { ProductTabs } from "./ProductTabs";

/**
 * A product grid (`product_cards`) can name tabs: a label and a collection
 * each. The band then draws one grid per tab and lets the shopper switch,
 * with every grid already in the page. A grid that names no tab is the single
 * grid it always was.
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

const product = (id: string, name: string): StorefrontProduct => ({
  id,
  name,
  slug: id,
  description: null,
  productType: "physical",
  media: [{ url: `https://cdn.zimos.test/${id}.jpg`, mimeType: "image/jpeg" }],
  tags: [],
  seo: null,
  variants: [{ id: `v-${id}`, sku: id, optionValues: {}, priceAmount: "25000", compareAtAmount: null, currency: "EGP", inStock: true } as unknown as StorefrontProduct["variants"][number]],
  offers: [],
  customFields: [],
  hasOptionGroups: false,
});

/** The store's catalogue by collection; "" is the whole catalogue, newest first. A collection not listed is unknown to the API. */
const shelves = vi.hoisted(() => ({ byCollection: {} as Record<string, unknown[]>, asked: [] as Array<{ collection: string; limit: number }> }));
vi.mock("@/lib/serverApiClient", () => ({
  createServerStorefrontApiClient: async () => ({
    searchStorefrontProducts: async (_ws: string, query: { collection?: string; limit: number }) => {
      const collection = query.collection ?? "";
      shelves.asked.push({ collection, limit: query.limit });
      if (!Object.hasOwn(shelves.byCollection, collection)) throw new Error("Collection not found");
      return { products: shelves.byCollection[collection].slice(0, query.limit), nextCursor: null };
    },
  }),
}));

const ALL = [product("p1", "Blue shirt"), product("p2", "Red dress"), product("p3", "Leather bag")];
const stock = (byCollection: Record<string, StorefrontProduct[]>) => {
  shelves.byCollection = byCollection;
  shelves.asked = [];
};

const STORE: StoreInfo = { workspaceId: "w1", id: "w1", slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: { email: "optional", postal_code: "hidden", notes: "optional" }, orderBump: null };

type Node = Record<string, unknown>;
const page = (props: Node) =>
  ({ sections: [{ id: "s1", type: "section", settings: { width: "full", padding: "tight" }, rows: [{ id: "r1", type: "row", columns: [{ id: "c1", type: "column", span: 12, elements: [{ id: "e1", type: "product_cards", props }] }] }] }] }) as unknown as PageTree;

/** The band as the server sends it, its products fetched. */
async function draw(props: Node, { locale = "en", editable = false }: { locale?: "ar" | "en"; editable?: boolean } = {}): Promise<HTMLElement> {
  const rendered = await PageRenderer({ tree: page(props), workspaceId: "w1", currency: "EGP", locale, editable });
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
      <StoreContextProvider locale={locale} store={STORE}>
        {rendered as React.ReactElement}
      </StoreContextProvider>,
      { onAllReady: () => stream.pipe(sink), onError: fail }
    );
  });
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

const names = (scope: Element) => Array.from(scope.querySelectorAll(".zs-pgrid__body h3")).map((h) => h.textContent);

afterEach(cleanup);

describe("a product grid without tabs", () => {
  it("is the single grid it always was", async () => {
    stock({ "": ALL });
    const root = await draw({ heading: "New in", limit: 8, columns: 4 });
    const shell = root.querySelector(".zs-pgrid__shell")!;
    expect(Array.from(shell.children).map((el) => `${el.tagName.toLowerCase()}.${el.className}`)).toEqual(["header.zs-pgrid__head", "div.zs-pgrid__grid"]);
    expect(root.querySelector("[role=tablist], [role=tabpanel]")).toBeNull();
    expect(names(root)).toEqual(["Blue shirt", "Red dress", "Leather bag"]);
    expect(shelves.asked).toEqual([{ collection: "", limit: 8 }]);
  });

  it("stays one for tabs that name nothing a shopper could read", async () => {
    stock({ best: [ALL[0]] });
    for (const tabs of [[], [{ label: "  ", collection: "x" }], "women", [null, 7]]) {
      const root = await draw({ collection: "best", tabs });
      expect(root.querySelector("[role=tablist]"), JSON.stringify(tabs)).toBeNull();
      expect(names(root)).toEqual(["Blue shirt"]);
    }
  });
});

describe("a product grid with tabs", () => {
  const tabs = [
    { label: "الكل", labelEn: "All", collection: "" },
    { label: "حريمي", labelEn: "Women", collection: "women" },
    { label: "شنط", labelEn: "Bags", collection: "bags" },
  ];

  it("draws a tab per collection and that collection's products under it, the first one open", async () => {
    stock({ "": ALL, women: [ALL[1]], bags: [ALL[2]] });
    const root = await draw({ heading: "Shop", limit: 6, tabs, collection: "ignored-while-there-are-tabs" });

    const list = root.querySelector("[role=tablist]")!;
    expect(list.getAttribute("aria-label")).toBe("Shop");
    const buttons = Array.from(list.querySelectorAll("[role=tab]"));
    expect(buttons.map((b) => b.textContent)).toEqual(["All", "Women", "Bags"]);
    expect(buttons.map((b) => b.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);

    const panels = Array.from(root.querySelectorAll("[role=tabpanel]"));
    expect(panels.map((p) => p.hasAttribute("hidden"))).toEqual([false, true, true]);
    expect(panels.map(names)).toEqual([["Blue shirt", "Red dress", "Leather bag"], ["Red dress"], ["Leather bag"]]);
    // Each tab names its panel and each panel its tab.
    buttons.forEach((button, i) => {
      expect(button.getAttribute("aria-controls")).toBe(panels[i].id);
      expect(panels[i].getAttribute("aria-labelledby")).toBe(button.id);
    });
    // One request per tab, each for the band's own number of products; the band's own collection is not asked for.
    expect(shelves.asked).toEqual([
      { collection: "", limit: 6 },
      { collection: "women", limit: 6 },
      { collection: "bags", limit: 6 },
    ]);
  });

  it("names the tabs in the store's language", async () => {
    stock({ "": ALL, women: [ALL[1]], bags: [ALL[2]] });
    const root = await draw({ tabs }, { locale: "ar" });
    expect(Array.from(root.querySelectorAll("[role=tab]")).map((b) => b.textContent)).toEqual(["الكل", "حريمي", "شنط"]);
  });

  it("never shows a shopper a tab with nothing in it, and no tab strip for a single tab", async () => {
    // "bags" has no products yet and "women" is not a collection of this store.
    stock({ "": ALL, bags: [] });
    const root = await draw({ heading: "Shop", tabs });
    expect(root.querySelector("[role=tablist]")).toBeNull();
    expect(root.querySelector(".border-dashed")).toBeNull();
    expect(Array.from(root.querySelector(".zs-pgrid__shell")!.children).map((el) => el.className)).toEqual(["zs-pgrid__head", "zs-pgrid__grid"]);
    expect(names(root)).toEqual(["Blue shirt", "Red dress", "Leather bag"]);
  });

  it("draws nothing at all when no tab has a product", async () => {
    stock({ "": [], bags: [] });
    expect((await draw({ heading: "Shop", tabs })).querySelector(".zs-pgrid")).toBeNull();
  });

  it("shows every tab in the editor, with a note in the ones that have no products yet", async () => {
    stock({ "": ALL, bags: [] });
    const root = await draw({ heading: "Shop", tabs }, { editable: true });
    expect(Array.from(root.querySelectorAll("[role=tab]")).map((b) => b.textContent)).toEqual(["All", "Women", "Bags"]);
    const panels = Array.from(root.querySelectorAll("[role=tabpanel]"));
    expect(panels.map((p) => p.querySelector(".border-dashed") !== null)).toEqual([false, true, true]);
  });

  it("keeps a product's picture in the same square box in every tab", async () => {
    stock({ "": ALL, women: [ALL[1]] });
    const root = await draw({ tabs: tabs.slice(0, 2) });
    const pictures = Array.from(root.querySelectorAll("img"));
    expect(pictures).toHaveLength(4);
    for (const img of pictures) expect(img.closest(".zs-pgrid__box"), img.getAttribute("src") ?? "").not.toBeNull();
  });
});

describe("switching tabs", () => {
  const show = (rtl = false) =>
    render(<ProductTabs tabs={[{ key: "0", label: "All" }, { key: "1", label: "Women" }, { key: "2", label: "Bags" }]} panels={[<p key="a">all</p>, <p key="b">women</p>, <p key="c">bags</p>]} label="Shop" rtl={rtl} />);
  const open = () => screen.getAllByRole("tabpanel", { hidden: true }).map((panel) => !panel.hasAttribute("hidden"));
  const chosen = () => screen.getAllByRole("tab").map((tab) => tab.getAttribute("aria-selected") === "true");

  it("opens the pressed tab's grid and closes the others", () => {
    show();
    expect(open()).toEqual([true, false, false]);
    fireEvent.click(screen.getByRole("tab", { name: "Bags" }));
    expect(open()).toEqual([false, false, true]);
    expect(chosen()).toEqual([false, false, true]);
    // Only the chosen tab is in the tab order; the arrows reach the rest.
    expect(screen.getAllByRole("tab").map((tab) => tab.tabIndex)).toEqual([-1, -1, 0]);
  });

  it("moves with the arrow keys, round the ends, and with Home and End", () => {
    show();
    const list = screen.getByRole("tablist");
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(chosen()).toEqual([false, true, false]);
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Women" }));
    fireEvent.keyDown(list, { key: "End" });
    expect(chosen()).toEqual([false, false, true]);
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(chosen()).toEqual([true, false, false]);
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    expect(chosen()).toEqual([false, false, true]);
    fireEvent.keyDown(list, { key: "Home" });
    expect(chosen()).toEqual([true, false, false]);
  });

  it("goes the other way with the arrows on an Arabic page", () => {
    show(true);
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });
    expect(chosen()).toEqual([false, true, false]);
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(chosen()).toEqual([true, false, false]);
  });
});

describe("the tab strip's rules", () => {
  // Read from disk: this runner hands back an empty string for an imported stylesheet.
  const css = readFileSync(resolve(__dirname, "../../../app/store-sections.css"), "utf8").replace(/\r\n/g, "\n");
  const rule = (selector: string) => {
    const at = css.indexOf(`\n${selector} {`);
    expect(at, selector).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("}", at));
  };

  it("scroll the strip itself when the tabs do not fit, and hide a closed grid", () => {
    expect(rule(".zs-pgrid__tabs")).toContain("overflow-x: auto;");
    expect(rule(".zs-pgrid__tab")).toMatch(/min-height: 44px;[\s\S]*flex: 0 0 auto;[\s\S]*white-space: nowrap;/);
    expect(rule(".zs-pgrid__panel[hidden]")).toContain("display: none;");
  });
});
