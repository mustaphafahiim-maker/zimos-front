/// <reference types="node" />
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { PageElement, PageTree } from "@store-builder/api-client";
import { singleProductArt, singleProductSections, type SingleProductLang } from "./singleProduct";
import { artUrl } from "./templateArt";
import { buildPage } from "./templateTree";

/**
 * The one-product page is written once: the store template's home page and
 * the funnel starter's sales page are the same sections, and differ only
 * where a store and a funnel differ. Its stand-in pictures are the only
 * drawings in the storefront's public/template-art/, checked in exactly as
 * they are drawn (`npm run templates:build` writes them).
 */

const ART = fileURLToPath(new URL("../../../../../storefront/public/template-art/", import.meta.url));
/** `npm run templates:build` sets it: the drawings are written instead of compared. */
const WRITE = process.env.UPDATE_STORE_TEMPLATES === "1";
/** A checkout on Windows may hand the file back with CRLF line ends. */
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

const page = (use: "store" | "funnel", lang: SingleProductLang = "ar"): PageTree => buildPage("p", singleProductSections(use, lang));
const elementsOf = (tree: PageTree): PageElement[] => tree.sections.flatMap((s) => s.rows.flatMap((r) => r.columns.flatMap((c) => c.elements)));
/** A section's name: its id without the page and its place in it. */
const names = (tree: PageTree) => tree.sections.map((s) => s.id.replace(/^p-[0-9]+-/, ""));
/** A section as it is laid out and worded, whatever its place in the page. */
const body = (tree: PageTree, name: string) => {
  const section = tree.sections.find((s) => s.id.replace(/^p-[0-9]+-/, "") === name)!;
  return JSON.parse(JSON.stringify(section).replaceAll(section.id, "section")) as { rows: Array<{ columns: Array<{ elements: PageElement[] }> }> };
};

describe("the one-product page", () => {
  it("names only its own drawings, each checked in exactly as it is drawn, and nothing else is in their folder", () => {
    const art = singleProductArt();
    if (WRITE) {
      mkdirSync(ART, { recursive: true });
      for (const stale of readdirSync(ART).filter((name) => name.endsWith(".svg") && !art.some((a) => a.file === name))) rmSync(join(ART, stale));
      for (const { file, svg } of art) writeFileSync(join(ART, file), svg, "utf8");
    }
    expect(existsSync(ART) ? readdirSync(ART).filter((name) => name.endsWith(".svg")).sort() : []).toEqual(art.map((a) => a.file).sort());
    for (const { file, svg } of art) expect(read(join(ART, file)), file).toBe(svg);
    const named = new Set(
      (["ar", "en"] as const).flatMap((lang) =>
        (["store", "funnel"] as const).flatMap((use) =>
          elementsOf(page(use, lang))
            .map((e) => e.props?.src)
            .filter((src): src is string => typeof src === "string" && src !== "")
        )
      )
    );
    expect([...named].sort()).toEqual(art.map((a) => artUrl(a.file.replace(/\.svg$/, ""))).sort());
  });

  it("keeps the same sections for a store and for a funnel, but for two", () => {
    expect(names(page("store"))).toEqual(["hero-split", "text-image", "highlights", "image-text", "reasons", "product-cards", "testimonial-wall", "faq-split", "newsletter"]);
    expect(names(page("funnel"))).toEqual(["hero-split", "text-image", "highlights", "image-text", "reasons", "order", "testimonial-wall", "faq-split", "cta-band"]);
  });

  it("words and lays out the shared sections the same, apart from where a button leads", () => {
    const store = page("store");
    const funnel = page("funnel");
    // No button in these: the same to the letter.
    for (const name of ["highlights", "reasons", "testimonial-wall", "faq-split"]) expect(body(funnel, name), name).toEqual(body(store, name));
    // A button in these: everything but the button is the same.
    for (const name of ["hero-split", "text-image", "image-text"]) {
      const strip = (section: ReturnType<typeof body>) =>
        section.rows.map((r) => r.columns.map((c) => c.elements.map((e) => (e.type === "button" ? { ...e, props: {} } : e))));
      expect(strip(body(funnel, name)), name).toEqual(strip(body(store, name)));
    }
  });

  it("sends a store's buttons to the catalogue and gives a funnel's no link at all", () => {
    const hrefs = (tree: PageTree) => elementsOf(tree).filter((e) => e.type === "button").map((e) => e.props?.href);
    expect(new Set(hrefs(page("store")))).toEqual(new Set(["/products"]));
    expect(new Set(hrefs(page("funnel")))).toEqual(new Set([""]));
    // A funnel's buttons all say the one thing a press does.
    const labels = elementsOf(page("funnel")).filter((e) => e.type === "button").map((e) => e.props?.label);
    expect(new Set(labels).size).toBe(1);
  });

  it("takes the order on the funnel's page", () => {
    const funnel = elementsOf(page("funnel"));
    expect(funnel.find((e) => e.type === "cod_form")?.props).toEqual({ title: "", productId: "" });
    expect(elementsOf(page("store")).map((e) => e.type)).not.toContain("cod_form");
  });

  it("puts no countdown on either page: no timer hurries a shopper for an offer the merchant never made", () => {
    for (const lang of ["ar", "en"] as const) {
      for (const use of ["store", "funnel"] as const) expect(elementsOf(page(use, lang)).map((e) => e.type), `${use} ${lang}`).not.toContain("countdown");
    }
  });

  it("is written in both languages a funnel can be made in, element for element", () => {
    for (const use of ["store", "funnel"] as const) {
      const ar = elementsOf(page(use, "ar"));
      const en = elementsOf(page(use, "en"));
      expect(en.map((e) => e.type)).toEqual(ar.map((e) => e.type));
      const words = (elements: PageElement[]) => elements.flatMap((e) => [e.props?.text, e.props?.label, e.props?.quote].filter((v): v is string => typeof v === "string" && v !== ""));
      for (const line of words(ar)) expect(line).toMatch(/\p{Script=Arabic}/u);
      for (const line of words(en)) expect(line).not.toMatch(/\p{Script=Arabic}/u);
    }
  });

  it("makes up no review in either language: a prompt, no name, no stars", () => {
    for (const lang of ["ar", "en"] as const) {
      for (const use of ["store", "funnel"] as const) {
        const reviews = elementsOf(page(use, lang)).filter((e) => e.type === "testimonial");
        expect(reviews).toHaveLength(3);
        for (const review of reviews) {
          expect(review.props).toMatchObject({ author: "", rating: 0 });
          expect(review.props?.quote).toMatch(lang === "ar" ? /^اكتب هنا/ : /^Write here/);
        }
      }
    }
  });
});
