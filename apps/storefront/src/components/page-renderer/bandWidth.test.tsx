import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PageTree } from "@store-builder/api-client";
import { pageStyleSheet } from "./elementStyle";
import { PageRenderer } from "./PageRenderer";

/**
 * A picture slider is a banner the width of its section and exactly as tall as
 * its setting, with its picture cropped to that box. On a live store it showed
 * as a box about 330px wide with a 50px heading spilling out of it: the slider
 * had been dropped into one column of a row of several, and a band takes the
 * width of whatever holds it while its parts are sized for the whole page.
 *
 * This runner has no layout engine, so the width itself is not measured here.
 * What is pinned is everything the width follows from: the marks the renderer
 * writes on the real page tree, and the rules of the stylesheet that read them.
 */

// A plain anchor: the slider's button needs no store around it here.
vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// No store behind the page: the renderer asks only for its money format.
vi.mock("@/lib/storeMeta", () => ({ getStoreMeta: async () => null }));

// Read from disk: this runner hands back an empty string for an imported stylesheet.
const css = readFileSync(resolve(__dirname, "../../app/store-sections.css"), "utf8").replace(/\r\n/g, "\n");

/** A square picture, as a shop's logo is. */
const SQUARE = "https://cdn.zimos.test/logo-1000x1000.png";

type Node = Record<string, unknown>;
const slider = (more: Node = {}): Node => ({
  id: "el-slider",
  type: "hero_slider",
  props: { slides: [{ image: SQUARE, heading: "Summer collection", buttonLabel: "Shop now", buttonHref: "/products" }], wave: true, height: 620, heightTablet: 520 },
  ...more,
});
const heading: Node = { id: "el-heading", type: "heading", props: { text: "Welcome", level: 2 } };
const text = (id: string, more: Node = {}): Node => ({ id, type: "text", props: { text: "A few words." }, ...more });
const button: Node = { id: "el-button", type: "button", props: { label: "Shop", href: "/products" } };
const column = (id: string, span: number, elements: Node[]): Node => ({ id, type: "column", span, elements });
const section = (id: string, settings: Node | null, columns: Node[]): Node => ({ id, type: "section", ...(settings ? { settings } : {}), rows: [{ id: `${id}-row`, type: "row", columns }] });
const page = (...sections: Node[]) => ({ sections }) as unknown as PageTree;

/** The page as the store sends it: the real renderer, its markup parsed back. */
async function draw(tree: PageTree, editable = false): Promise<HTMLElement> {
  const element = await PageRenderer({ tree, workspaceId: "w1", currency: "EGP", locale: "en", editable });
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(element as React.ReactElement);
  return root;
}

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string, from = 0): string {
  const at = css.indexOf(`${selector} {`, from);
  expect(at, `no rule for ${selector}`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
}

describe("a square picture in a wide container", () => {
  // What the editor's "Picture slider" block writes: a full-width section holding the one element.
  const tree = page(section("s1", { width: "full", padding: "tight" }, [column("c1", 12, [slider()])]));

  it("is drawn as a banner the width of its section: nothing between the section and the slider holds it narrower", async () => {
    const root = await draw(tree);
    const hero = root.querySelector<HTMLElement>(".zs-hero")!;
    expect(hero).not.toBeNull();

    // Straight inside its column: no box of its own in between.
    const col = hero.parentElement!;
    expect(col.hasAttribute("data-zt-col")).toBe(true);
    expect(col.className).toContain("md:col-span-12");
    expect(col.getAttribute("data-zt-band")).toBe("");

    // The section's own wrapper has no width limit, and the section is the full-width kind.
    const sectionEl = hero.closest("[data-zt-section]")!;
    expect(sectionEl.getAttribute("data-zt-width")).toBe("full");
    expect(sectionEl.firstElementChild!.className).toContain("max-w-none");
    expect(sectionEl.firstElementChild!.className).not.toMatch(/max-w-(6xl|7xl)/);

    // And the band itself is as wide as what holds it.
    expect(hero.className).toBe("zs zs-hero");
    expect(rule(".zs")).toMatch(/width: 100%;/);
  });

  it("is exactly as tall as its setting for each device, never the picture's own shape", async () => {
    const hero = (await draw(tree)).querySelector<HTMLElement>(".zs-hero")!;
    expect(hero.style.getPropertyValue("--zs-hero-h")).toBe("620px");
    expect(hero.style.getPropertyValue("--zs-hero-h-tablet")).toBe("520px");

    const box = rule(".zs-hero");
    expect(box).toMatch(/height: var\(--zs-hero-h, 620px\);/);
    expect(box).toMatch(/overflow: hidden;/);
    // No ratio and no height of the picture's on a computer or a tablet: the first ratio is the phone's.
    expect(box).not.toMatch(/aspect-ratio/);
    const tablet = css.slice(css.indexOf("@media (max-width: 1024px) {\n  .zs-hero {"));
    expect(tablet.slice(0, tablet.indexOf("\n}\n"))).toMatch(/height: var\(--zs-hero-h-tablet, 520px\);/);
  });

  it("crops the square picture to that box instead of shrinking the box to the picture", async () => {
    const hero = (await draw(tree)).querySelector<HTMLElement>(".zs-hero")!;
    const img = hero.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(SQUARE);
    // The picture is in the slide's own layer, which is laid over the whole box.
    expect(img.closest(".zs-hero__media")).not.toBeNull();
    const media = rule(".zs-hero__media");
    expect(media).toMatch(/position: absolute;/);
    expect(media).toMatch(/inset: 0;/);
    const picture = rule(".zs-hero__media img");
    expect(picture).toMatch(/width: 100%;/);
    expect(picture).toMatch(/height: 100%;/);
    expect(picture).toMatch(/object-fit: cover;/);
    // The text is a layer over the picture, not a block under it.
    expect(hero.querySelector(".zs-hero__shell .zs-hero__heading")!.textContent).toBe("Summer collection");
    expect(rule(".zs-hero__slide")).toMatch(/position: absolute;\s*inset: 0;/);
  });
});

describe("a slider dropped where it would be narrow", () => {
  it("takes the whole row when it is in one column of three, and leaves the other columns their span", async () => {
    const root = await draw(page(section("s1", null, [column("c1", 4, [slider()]), column("c2", 4, [text("t1")]), column("c3", 4, [text("t2")])])));
    const columns = Array.from(root.querySelectorAll<HTMLElement>("[data-zt-col]"));
    expect(columns).toHaveLength(3);
    expect(columns.map((col) => col.hasAttribute("data-zt-band"))).toEqual([true, false, false]);
    // The span it was given is still written; the mark is what the stylesheet reads.
    expect(columns[0].className).toContain("md:col-span-4");
    expect(columns[0].querySelector(".zs-hero")).not.toBeNull();

    const row = rule("[data-zt-col][data-zt-band]");
    expect(row).toMatch(/grid-column: 1 \/ -1;/);
    // Outside any layer, so it wins over the span's own class without !important.
    expect(css.slice(0, css.indexOf("[data-zt-col][data-zt-band] {"))).not.toMatch(/@layer/);
  });

  it("marks the column in the editor's preview too", async () => {
    const root = await draw(page(section("s1", null, [column("c1", 6, [slider()]), column("c2", 6, [text("t1")])])), true);
    const columns = Array.from(root.querySelectorAll<HTMLElement>("[data-zt-col]"));
    expect(columns.map((col) => col.hasAttribute("data-zt-band"))).toEqual([true, false]);
  });

  it("is not narrowed by a width from its own Style tab, which still narrows any other element", async () => {
    const narrow = { settings: { style: { base: { width: 30, maxWidth: 330 } } } };
    const tree = page(section("s1", { width: "full", padding: "tight" }, [column("c1", 12, [slider(narrow), text("el-text", narrow)])]));
    const root = await draw(tree);

    const box = root.querySelector<HTMLElement>('[data-zs="el-slider"]')!;
    expect(box.getAttribute("data-zs-band")).toBe("");
    expect(box.firstElementChild!.className).toBe("zs zs-hero");
    const other = root.querySelector<HTMLElement>('[data-zs="el-text"]')!;
    expect(other.hasAttribute("data-zs-band")).toBe(false);

    // The page's own rule names one attribute; the band's rule names two, so it is the one that holds.
    expect(pageStyleSheet(tree)).toContain('[data-zs="el-slider"]{width:30%;max-width:330px}');
    const own = rule("[data-zs][data-zs-band]");
    expect(own).toMatch(/width: auto;/);
    expect(own).toMatch(/max-width: none;/);
  });
});

describe("a slider in the section a store theme treats as the page's hero", () => {
  it("keeps the theme's hero treatment off its own heading: the section is not marked", async () => {
    // A heading and a button in one column are what a theme reads as the opening hero (layout.ts).
    const plain = await draw(page(section("s1", null, [column("c1", 12, [heading, button])])));
    expect(plain.querySelector("[data-zt-section]")!.hasAttribute("data-zimos-hero")).toBe(true);

    const withSlider = await draw(page(section("s1", null, [column("c1", 7, [heading, button]), column("c2", 5, [slider()])])));
    const first = withSlider.querySelector("[data-zt-section]")!;
    expect(first.querySelector(".zs-hero__heading")).not.toBeNull();
    expect(first.hasAttribute("data-zimos-hero")).toBe(false);
  });

  it("does not hand the treatment to the next section instead", async () => {
    const root = await draw(page(section("s1", null, [column("c1", 12, [heading, button, slider()])]), section("s2", null, [column("c2", 12, [heading, button])])));
    const sections = Array.from(root.querySelectorAll("[data-zt-section]"));
    expect(sections).toHaveLength(2);
    expect(sections.map((el) => el.hasAttribute("data-zimos-hero"))).toEqual([false, false]);
  });

  it("leaves a page whose slider has a section of its own as it was: the hero is the section after it", async () => {
    const root = await draw(page(section("s1", { width: "full", padding: "tight" }, [column("c1", 12, [slider()])]), section("s2", null, [column("c2", 12, [heading, button])])));
    const sections = Array.from(root.querySelectorAll("[data-zt-section]"));
    expect(sections.map((el) => el.hasAttribute("data-zimos-hero"))).toEqual([false, true]);
  });
});

describe("a page with no band on it", () => {
  it("gets none of the marks", async () => {
    const root = await draw(page(section("s1", null, [column("c1", 6, [heading, button]), column("c2", 6, [text("el-text", { settings: { style: { base: { width: 50 } } } })])])));
    expect(root.querySelector("[data-zt-band]")).toBeNull();
    expect(root.querySelector("[data-zs-band]")).toBeNull();
    expect(root.querySelector('[data-zs="el-text"]')).not.toBeNull();
    expect(root.querySelector("[data-zt-section]")!.hasAttribute("data-zimos-hero")).toBe(true);
  });
});
