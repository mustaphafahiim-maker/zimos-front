import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ViewLink } from "@/components/ViewLink";
import { registerPrefetch } from "@/lib/prefetch";
import { RouteCommitSignal, withViewTransition } from "./viewTransition";

// The part of the API the page uses, loosely typed so a test can put it on jsdom's document and take it off.
const doc = document as unknown as { startViewTransition?: (update: () => void | Promise<void>) => { finished: Promise<void> } };

function app() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <RouteCommitSignal />
      <Routes>
        <Route path="/" element={<ViewLink to="/orders">Orders</ViewLink>} />
        <Route path="/orders" element={<p>The orders page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  delete doc.startViewTransition;
  delete document.documentElement.dataset.vt;
  vi.restoreAllMocks();
});

describe("changing page", () => {
  it("is a plain navigation where the browser has no view transitions", async () => {
    app();
    await userEvent.click(screen.getByRole("link", { name: "Orders" }));
    expect(screen.getByText("The orders page")).toBeInTheDocument();
    expect(document.documentElement.dataset.vt).toBeUndefined();
  });

  it("runs inside a view transition where there is one, and clears its mark when it ends", async () => {
    let finish: () => void = () => undefined;
    const started = vi.fn((update: () => void | Promise<void>) => {
      void update();
      return { finished: new Promise<void>((resolve) => (finish = resolve)) };
    });
    doc.startViewTransition = started;
    app();

    await userEvent.click(screen.getByRole("link", { name: "Orders" }));
    expect(started).toHaveBeenCalledTimes(1);
    expect(screen.getByText("The orders page")).toBeInTheDocument();
    expect(document.documentElement.dataset.vt).toBe("");

    await act(async () => {
      finish();
      await Promise.resolve();
    });
    expect(document.documentElement.dataset.vt).toBeUndefined();
  });

  it("is a plain navigation for someone who asked for less motion", async () => {
    const started = vi.fn();
    doc.startViewTransition = started;
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }));
    app();
    await userEvent.click(screen.getByRole("link", { name: "Orders" }));
    expect(started).not.toHaveBeenCalled();
    expect(screen.getByText("The orders page")).toBeInTheDocument();
  });

  it("leaves a click meant for a new tab to the browser", async () => {
    const started = vi.fn();
    doc.startViewTransition = started;
    app();
    const user = userEvent.setup();
    await user.keyboard("{Control>}");
    await user.click(screen.getByRole("link", { name: "Orders" }));
    await user.keyboard("{/Control}");
    expect(started).not.toHaveBeenCalled();
  });

  it("fetches the page's code when the link is pointed at", async () => {
    const load = vi.fn(() => Promise.resolve());
    registerPrefetch("/orders", load);
    app();
    await userEvent.hover(screen.getByRole("link", { name: "Orders" }));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("runs a local change at once without the API", () => {
    const update = vi.fn();
    withViewTransition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
