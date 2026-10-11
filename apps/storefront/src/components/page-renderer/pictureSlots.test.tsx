import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PageTree } from "@store-builder/api-client";
import { PageRenderer } from "./PageRenderer";

/**
 * A place for a picture has to hold whatever picture a merchant puts in it: a
 * panorama, a tall phone shot, a tiny icon, a transparent PNG, an SVG. That
 * takes a box whose size never comes from the file — a shape or a height of
 * its own — with the file filling it (`object-fit: cover`) around a part the
 * merchant can choose.
 *
 * This runner has no layout engine, so no box is measured here. What is pinned
 * is what the box follows from: the shape and the focus the renderer writes
 * on the real page tree, and the rules of the stylesheet for the bands. The
 * boxes themselves were measured in a browser (the report of this work).
 */

vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/storeMeta", () => ({ getStoreMeta: async () => null }));

// Read from disk: this runner hands back an empty string for an imported stylesheet.
const css = readFileSync(resolve(__dirname, "../../app/store-sections.css"), "utf8").replace(/\r\n/g, "\n");

const PHOTO = "https://cdn.zimos.test/photo-4000x900.jpg";

type Node = Record<string, unknown>;
const page = (element: Node) =>
  ({ sections: [{ id: "s1", type: "section", rows: [{ id: "r1", type: "row", columns: [{ id: "c1", type: "column", span: 12, elements: [{ id: "e1", ...element }] }] }] }] }) as unknown as PageTree;

async function draw(element: Node, locale: "ar" | "en" = "en"): Promise<HTMLElement> {
  const rendered = await PageRenderer({ tree: page(element), workspaceId: "w1", currency: "EGP", locale, editable: false });
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(rendered as React.ReactElement);
  return root;
}

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
}

describe("a picture on its own (the image element)", () => {
  const image = (props: Node): Node => ({ type: "image", props: { src: PHOTO, alt: "A sofa", ...props } });

  it("is drawn exactly as it always was while it names no shape", async () => {
    const img = (await draw(image({}))).querySelector("img")!;
    expect(img.outerHTML).toBe(
      `<img src="${PHOTO}" alt="A sofa" width="1200" height="800" loading="eager" fetchpriority="high" decoding="async" class="zt-img h-auto w-full rounded-2xl object-cover">`
    );
  });

  it("takes the shape it names: as wide as its column, as tall as the shape says, the file filling it", async () => {
    const img = (await draw(image({ ratio: "4:3" }))).querySelector("img")!;
    expect(img.style.aspectRatio).toBe("4 / 3");
    // The width comes from the column and the height from the shape; neither from the file.
    for (const name of ["w-full", "h-auto", "object-cover"]) expect(img.classList.contains(name), name).toBe(true);
    expect(img.style.objectPosition).toBe("");
  });

  it.each(["1:1", "3:2", "16:9", "21:9", "3:4", "4:5", "2:3"])("knows the shape %s", async (ratio) => {
    const [w, h] = ratio.split(":");
    expect((await draw(image({ ratio }))).querySelector("img")!.style.aspectRatio).toBe(`${w} / ${h}`);
  });

  it("keeps the chosen part of the picture in view, start and end following the page", async () => {
    const top = (await draw(image({ ratio: "4:3", focusY: "top" }))).querySelector("img")!;
    expect(top.style.objectPosition).toBe("50% 0%");
    const startEn = (await draw(image({ ratio: "4:3", focusX: "start" }), "en")).querySelector("img")!;
    expect(startEn.style.objectPosition).toBe("0% 50%");
    const startAr = (await draw(image({ ratio: "4:3", focusX: "start", focusY: "bottom" }), "ar")).querySelector("img")!;
    expect(startAr.style.objectPosition).toBe("100% 100%");
  });

  it("ignores a shape it does not know, and a focus without a shape", async () => {
    for (const props of [{ ratio: "5:7" }, { ratio: "" }, { ratio: 1.5 }, { focusX: "start", focusY: "top" }]) {
      expect((await draw(image(props))).querySelector("img")!.hasAttribute("style"), JSON.stringify(props)).toBe(false);
    }
  });

  it("keeps its shape inside a width cap and inside a link", async () => {
    const root = await draw(image({ ratio: "1:1", size: "small", href: "/products" }));
    const img = root.querySelector("img")!;
    expect(img.style.aspectRatio).toBe("1 / 1");
    expect(img.closest("a")!.getAttribute("href")).toBe("/products");
    expect((img.closest("a")!.parentElement as HTMLElement).style.maxWidth).toBe("15rem");
  });
});

describe("a category tile's picture", () => {
  const tiles = (items: Node[]): Node => ({ type: "category_tiles", props: { items } });

  it("is drawn as before while it names no part to keep", async () => {
    const img = (await draw(tiles([{ image: PHOTO, title: "Coffee", href: "/products" }]))).querySelector("img")!;
    expect(img.hasAttribute("style")).toBe(false);
    expect(img.className).toBe("zs-cats__img");
  });

  it("keeps the chosen part in view, tile by tile", async () => {
    const root = await draw(tiles([{ image: PHOTO, title: "Coffee", focusY: "top" }, { image: PHOTO, title: "Tea", focusX: "end" }, { image: PHOTO, title: "Juice" }]), "ar");
    const [first, second, third] = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
    expect(first.style.objectPosition).toBe("50% 0%");
    expect(second.style.objectPosition).toBe("0% 50%");
    expect(third.hasAttribute("style")).toBe(false);
  });

  it("sits in a square that crops it, whatever its size", () => {
    expect(rule(".zs-cats__box")).toMatch(/aspect-ratio: 1 \/ 1;[\s\S]*overflow: hidden;/);
    const img = rule(".zs-cats__img");
    for (const declaration of ["width: 100%;", "height: 100%;", "object-fit: cover;"]) expect(img).toContain(declaration);
  });
});

describe("the picture banner's picture", () => {
  const banner = (props: Node): Node => ({ type: "image_banner", props: { image: PHOTO, heading: "Sale", ...props } });

  it("is drawn as before while it names no part to keep", async () => {
    expect((await draw(banner({}))).querySelector("img")!.hasAttribute("style")).toBe(false);
  });

  it("keeps the chosen part in view", async () => {
    expect((await draw(banner({ focusX: "end", focusY: "bottom" }), "en")).querySelector("img")!.style.objectPosition).toBe("100% 100%");
    expect((await draw(banner({ focusX: "end" }), "ar")).querySelector("img")!.style.objectPosition).toBe("0% 50%");
  });

  it("fills a box as tall as the banner's own height", () => {
    expect(rule(".zs-banner__media,\n.zs-banner__media picture")).toMatch(/position: absolute;[\s\S]*inset: 0;/);
    const img = rule(".zs-banner__media img");
    for (const declaration of ["width: 100%;", "height: 100%;", "object-fit: cover;"]) expect(img).toContain(declaration);
  });
});

describe("the other boxes the templates put pictures in", () => {
  it("the slider's picture fills the slide around its chosen part", () => {
    const img = rule(".zs-hero__media img");
    for (const declaration of ["width: 100%;", "height: 100%;", "object-fit: cover;", "object-position: var(--zs-fx, 50%) var(--zs-fy, 50%);"]) expect(img).toContain(declaration);
  });

  it("a product's picture sits whole inside a square", () => {
    expect(rule(".zs-pgrid__box")).toMatch(/aspect-ratio: 1 \/ 1;[\s\S]*overflow: hidden;/);
    expect(rule(".zs-pgrid__img")).toContain("object-fit: contain;");
  });

  it("a maker's mark sits whole inside a square of the gallery", async () => {
    const root = await draw({ type: "gallery", props: { images: [PHOTO, PHOTO], columns: 6, fit: "whole" } });
    for (const img of Array.from(root.querySelectorAll("img"))) {
      for (const name of ["aspect-square", "w-full", "object-contain"]) expect(img.classList.contains(name), name).toBe(true);
    }
  });
});
