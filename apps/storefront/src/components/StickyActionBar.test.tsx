import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { StickyActionBar } from "./StickyActionBar";

/** A stand-in for the visual viewport: the keyboard opening shrinks its height. */
function fakeViewport(height: number) {
  const target = new EventTarget() as EventTarget & { height: number; offsetTop: number; scale: number };
  target.height = height;
  target.offsetTop = 0;
  target.scale = 1;
  Object.defineProperty(window, "visualViewport", { configurable: true, value: target });
  return target;
}

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
});

describe("StickyActionBar", () => {
  it("clears the home indicator and stays a phone-only bar", () => {
    render(
      <StickyActionBar hidden={false}>
        <button type="button">Order</button>
      </StickyActionBar>
    );
    const bar = screen.getByRole("button", { name: "Order" }).parentElement!;
    expect(bar.className).toContain("pb-[calc(0.75rem+env(safe-area-inset-bottom))]");
    expect(bar.className).toContain("md:hidden");
    expect(bar.className).toContain("motion-reduce:transition-none");
    expect(bar.getAttribute("aria-hidden")).toBe("false");
  });

  it("leaves the tab order and the accessibility tree while hidden", () => {
    render(
      <StickyActionBar hidden until="lg">
        <button type="button">Confirm</button>
      </StickyActionBar>
    );
    const bar = screen.getByRole("button", { name: "Confirm", hidden: true }).parentElement!;
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    expect(bar.hasAttribute("inert")).toBe(true);
    expect(bar.className).toContain("translate-y-full");
    expect(bar.className).toContain("lg:hidden");
  });

  it("rides above the on-screen keyboard, and comes back down when it closes", () => {
    window.innerHeight = 800;
    const viewport = fakeViewport(800);
    render(
      <StickyActionBar hidden={false}>
        <button type="button">Order</button>
      </StickyActionBar>
    );
    const bar = screen.getByRole("button", { name: "Order" }).parentElement!;
    expect(bar.style.transform).toBe("");

    act(() => {
      viewport.height = 460;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(bar.style.transform).toBe("translateY(-340px)");

    act(() => {
      viewport.height = 800;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(bar.style.transform).toBe("");
  });

  it("ignores pinch-zoom and a toolbar sliding away", () => {
    window.innerHeight = 800;
    const viewport = fakeViewport(800);
    render(
      <StickyActionBar hidden={false}>
        <button type="button">Order</button>
      </StickyActionBar>
    );
    const bar = screen.getByRole("button", { name: "Order" }).parentElement!;
    act(() => {
      viewport.height = 744;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(bar.style.transform).toBe("");
    act(() => {
      viewport.scale = 2;
      viewport.height = 400;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(bar.style.transform).toBe("");
  });
});
