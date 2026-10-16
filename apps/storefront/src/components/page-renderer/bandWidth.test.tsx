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
 * It then showed 264px wide in a column of its own. Its section had been given
 * a minimum height, which makes the section a flex column that centres its
 * wrapper; a centred flex item is only as wide as its content, and a band has
 * no width of its own. 264px is the row's eleven gutters and nothing else.
 * A section that holds a band is no longer given its minimum height at all:
 * the band sets its own height for each screen.
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
const column = (id: string, span: number, elements: Node[], settings?: Node): Node => ({ id, type: "column", span, elements, ...(settings ? { settings } : {}) });
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
    expect(own).toMatch(/width: 100%;/);
    expect(own).toMatch(/max-width: none;/);
  });

  it("is not shrunk by a place of its own from the Style tab either", async () => {
    // Start, centre or end: each writes an automatic side margin on the element's box.
    const placed = { settings: { style: { base: { align: "center" } } } };
    const tree = page(section("s1", { width: "full", padding: "tight" }, [column("c1", 12, [slider(placed)])]));
    expect(pageStyleSheet(tree)).toContain('[data-zs="el-slider"]{text-align:center;margin-inline:auto}');
    expect((await draw(tree)).querySelector('[data-zs="el-slider"]')!.getAttribute("data-zs-band")).toBe("");

    // The column is a flex column, where a box with such a margin and no width of
    // its own is as wide as its content. So the band's box names its width.
    const own = rule("[data-zs][data-zs-band]");
    expect(own).toMatch(/width: 100%;/);
    expect(own).not.toMatch(/width: auto;/);
    expect(own).toMatch(/min-width: 0;/);
  });
});

describe("a slider in a section that was given a minimum height", () => {
  // Written by the handle under a section in the editor's preview, and by the section's "Minimum height" field.
  const tall = { width: "full", padding: "tight", minHeight: 620 };
  const boxed = { settings: { style: { base: {} } } };

  it("does not apply the minimum height: the section is as tall as its band on every screen, and is no flex column", async () => {
    for (const editable of [false, true]) {
      const root = await draw(page(section("s1", tall, [column("c1", 12, [slider(boxed)])])), editable);
      const sectionEl = root.querySelector<HTMLElement>("[data-zt-section]")!;
      // One number for every screen: 620 under a slider that is 520 on a tablet left 50px of nothing above and below it.
      expect(sectionEl.style.minHeight).toBe("");
      expect(sectionEl.hasAttribute("style")).toBe(false);
      // The classes of the same section without the setting, so nothing centres the wrapper as a flex item.
      expect(sectionEl.className).toBe("px-4 sm:px-6 py-3 sm:py-4");
      // The band's own heights are untouched.
      const hero = sectionEl.querySelector<HTMLElement>(".zs-hero")!;
      expect(hero.style.getPropertyValue("--zs-hero-h")).toBe("620px");
      expect(hero.style.getPropertyValue("--zs-hero-h-tablet")).toBe("520px");
    }
  });

  it("drops it for the whole section, whatever else the section holds and wherever the band is in it", async () => {
    const root = await draw(page(section("s1", { minHeight: 700, background: "ink" }, [column("c1", 4, [heading, button]), column("c2", 4, [text("t1")]), column("c3", 4, [slider()])])));
    const sectionEl = root.querySelector<HTMLElement>("[data-zt-section]")!;
    expect(sectionEl.hasAttribute("style")).toBe(false);
    expect(sectionEl.className.split(" ")).not.toEqual(expect.arrayContaining(["flex"]));
    // The rest of the section's look is still its own.
    expect(sectionEl.className).toContain("bg-ink");
    expect(sectionEl.getAttribute("data-zt-bg")).toBe("ink");
  });

  it("still marks the section's wrapper, which the stylesheet holds at the section's width when something does centre it", async () => {
    // The editor's preview lays the section out as a flex column while its height is dragged (useCanvasDrag).
    const root = await draw(page(section("s1", tall, [column("c1", 12, [slider(boxed)])])));
    const sectionEl = root.querySelector<HTMLElement>("[data-zt-section]")!;
    const wrapper = sectionEl.firstElementChild as HTMLElement;
    // Centred by automatic margins: as a flex item that alone would make it as wide as its content.
    expect(wrapper.className.split(" ")).toContain("mx-auto");

    expect(wrapper.getAttribute("data-zt-band")).toBe("");
    const held = rule("[data-zt-section] > [data-zt-band]");
    expect(held).toMatch(/width: 100%;/);
    expect(held).toMatch(/min-width: 0;/);
    // Outside any layer, like the other two marks' rules.
    expect(css.slice(0, css.indexOf("[data-zt-section] > [data-zt-band] {"))).not.toMatch(/@layer/);
  });

  it("keeps the section's own width limit: only the shrinking is undone", async () => {
    const root = await draw(page(section("s1", { minHeight: 700 }, [column("c1", 12, [slider()])])));
    const sectionEl = root.querySelector<HTMLElement>("[data-zt-section]")!;
    expect(sectionEl.getAttribute("data-zt-width")).toBe("normal");
    const wrapper = sectionEl.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute("data-zt-band")).toBe("");
    // The limit and the centring are still the wrapper's own classes, and the rule names no limit of its own.
    expect(wrapper.className.split(" ")).toEqual(expect.arrayContaining(["mx-auto", "max-w-6xl"]));
    expect(rule("[data-zt-section] > [data-zt-band]")).not.toMatch(/max-width/);
  });

  it("marks the wrapper of any section that holds a band, with a minimum height or without", async () => {
    const root = await draw(page(section("s1", { width: "full", padding: "tight" }, [column("c1", 12, [slider()])]), section("s2", null, [column("c2", 12, [heading, button])])));
    const wrappers = Array.from(root.querySelectorAll("[data-zt-section]")).map((el) => el.firstElementChild!);
    expect(wrappers.map((el) => el.hasAttribute("data-zt-band"))).toEqual([true, false]);
  });

  it("leaves a section with a minimum height and no band exactly as it was", async () => {
    const root = await draw(page(section("s1", { minHeight: 500 }, [column("c1", 12, [heading, button])])));
    expect(root.querySelector("[data-zt-band]")).toBeNull();
    const sectionEl = root.querySelector<HTMLElement>("[data-zt-section]")!;
    // Its minimum height is applied, with the centring that comes with it.
    expect(sectionEl.style.minHeight).toBe("500px");
    expect(sectionEl.className).toBe("px-4 sm:px-6 py-10 sm:py-14 flex flex-col justify-center");
    expect(sectionEl.firstElementChild!.className).toBe("mx-auto flex flex-col gap-6 max-w-6xl");
  });
});

describe("every box between a slider and its section", () => {
  /** Nearest first. The preview's element marker draws no box of its own (`contents`). */
  function boxesAbove(band: Element): Element[] {
    const out: Element[] = [];
    for (let el = band.parentElement; el && !el.hasAttribute("data-zt-section"); el = el.parentElement) {
      if (!el.classList.contains("contents")) out.push(el);
    }
    return out;
  }

  it("is one the stylesheet holds at full width, whatever the section, the column and the element are set to", async () => {
    const sections: (Node | null)[] = [
      null,
      { minHeight: 700 },
      { width: "wide", minHeight: 700 },
      { width: "full", padding: "tight", minHeight: 620 },
      { width: "full", background: "ink", minHeight: 620 },
    ];
    const columns: (Node | undefined)[] = [undefined, { layout: "inline", justify: "center" }, { verticalAlign: "center", align: "center" }, { sticky: "top", surface: "card" }];
    const sliders = [slider(), slider({ settings: { style: { base: {} } } }), slider({ settings: { style: { base: { width: 30, maxWidth: 330, align: "end" } } } })];

    for (const [s, settings] of sections.entries()) {
      for (const [c, columnSettings] of columns.entries()) {
        for (const [e, element] of sliders.entries()) {
          for (const editable of [false, true]) {
            const root = await draw(page(section("s1", settings, [column("c1", 12, [element], columnSettings)])), editable);
            const boxes = boxesAbove(root.querySelector(".zs-hero")!);
            const where = `section ${s}, column ${c}, slider ${e}${editable ? ", preview" : ""}`;
            // The element's own box when it has one, then its column, its row and the section's wrapper.
            expect(boxes, where).toHaveLength(e === 0 ? 3 : 4);
            for (const box of boxes) {
              // A row is the one box with no mark: it carries nothing but its grid, so it follows the wrapper.
              if (box.classList.contains("grid")) expect(box.className, where).toMatch(/^grid gap-\d+ md:grid-cols-12$/);
              else expect(box.hasAttribute("data-zt-band") || box.hasAttribute("data-zs-band"), `${where}: <${box.tagName.toLowerCase()} class="${box.className}">`).toBe(true);
            }
          }
        }
      }
    }
    // And each mark has its rule.
    expect(rule("[data-zt-section] > [data-zt-band]")).toMatch(/width: 100%;/);
    expect(rule("[data-zt-col][data-zt-band]")).toMatch(/grid-column: 1 \/ -1;/);
    expect(rule("[data-zs][data-zs-band]")).toMatch(/width: 100%;/);
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
