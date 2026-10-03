import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { isOptimizableImage, parseImageOrigins } from "@/lib/imageOrigins";
import { StoreImage } from "./StoreImage";

afterEach(cleanup);

describe("image origins", () => {
  it("reads a comma-separated list of origins and drops anything else", () => {
    const origins = parseImageOrigins(" https://media.example.com/path , http://localhost:4302,ftp://x.com, not a url,,");
    expect(origins.map((u) => u.origin)).toEqual(["https://media.example.com", "http://localhost:4302"]);
    expect(parseImageOrigins(undefined)).toEqual([]);
    expect(parseImageOrigins("")).toEqual([]);
  });

  it("optimizes only images on a listed origin", () => {
    const listed = ["https://media.example.com"];
    expect(isOptimizableImage("https://media.example.com/a/b.jpg", listed)).toBe(true);
    expect(isOptimizableImage("https://media.example.com.evil.com/b.jpg", listed)).toBe(false);
    expect(isOptimizableImage("http://media.example.com/b.jpg", listed)).toBe(false);
    expect(isOptimizableImage("https://other.example.com/b.jpg", listed)).toBe(false);
    expect(isOptimizableImage("/relative.jpg", listed)).toBe(false);
    expect(isOptimizableImage("https://media.example.com/b.jpg", [])).toBe(false);
  });
});

describe("StoreImage with no origins configured", () => {
  it("is the same plain <img> as before, with its size and loading hints", () => {
    const { container } = render(
      <StoreImage
        src="https://media.example.com/p.jpg"
        alt=""
        width={600}
        height={600}
        sizes="50vw"
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    );
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://media.example.com/p.jpg");
    expect(img.getAttribute("width")).toBe("600");
    expect(img.getAttribute("height")).toBe("600");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.hasAttribute("srcset")).toBe(false);
    expect(img.hasAttribute("sizes")).toBe(false);
  });
});
