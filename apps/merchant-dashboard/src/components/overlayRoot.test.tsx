import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "./Modal";
import { OverlayRoot } from "./overlayRoot";
import { Popover } from "./Popover";
import css from "../index.css?raw";
import dashboardLayout from "./DashboardLayout.tsx?raw";
import editorLayout from "./EditorLayout.tsx?raw";

/**
 * Dialogs and menus are drawn in the layout's overlay root, outside the bars
 * and panels that use backdrop-filter (the funnel editor's top bar, the glass
 * sidebar and header, a dialog box itself) or a transform (the funnel map's
 * zoom). Any of those makes `position: fixed` follow that box instead of the
 * window: the funnel's "Tests, redirects and settings" dialog was cut off at
 * the bar's height. jsdom does not lay out, so the stylesheet half reads CSS.
 */

/** Every declaration block whose selector list ends on exactly `selector`. */
function rulesFor(selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`(?:^|[\\n,}])\\s*${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, "g"))].map((m) => m[1]);
}

const CONTAINING_BLOCK = /\b(transform|translate|scale|rotate|perspective|filter|backdrop-filter|will-change|contain|container-type)\s*:/;

function Glass({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="glass" style={{ backdropFilter: "blur(20px)", transform: "translateY(0)" }}>
      {children}
    </div>
  );
}

describe("overlay root", () => {
  it("draws a Modal opened inside a glass bar in the overlay root, not inside the bar", () => {
    const page = (open: boolean) => (
      <>
        <Glass>
          <Modal open={open} onClose={() => undefined} title="Tests, redirects and settings">
            body
          </Modal>
        </Glass>
        <OverlayRoot />
      </>
    );
    // Opened after the layout is up, as a merchant opens it.
    const { rerender } = render(page(false));
    rerender(page(true));
    const dialog = screen.getByRole("dialog", { name: "Tests, redirects and settings" });
    expect(screen.getByTestId("glass")).not.toContainElement(dialog);
    expect(document.querySelector("[data-overlay-root]")).toContainElement(dialog);
  });

  it("falls back to <body> where no layout put a root", () => {
    render(
      <Glass>
        <Modal open onClose={() => undefined} title="Confirm">
          body
        </Modal>
      </Glass>
    );
    const dialog = screen.getByRole("dialog", { name: "Confirm" });
    expect(screen.getByTestId("glass")).not.toContainElement(dialog);
    expect(document.body).toContainElement(dialog);
  });

  it("draws a Popover outside its bar, closes on Escape and on a click outside", () => {
    const onClose = vi.fn();
    function Harness() {
      const anchor = useRef<HTMLDivElement>(null);
      return (
        <Glass>
          <div ref={anchor}>History</div>
          <Popover open onClose={onClose} anchorRef={anchor} closeLabel="Close">
            Published revisions
          </Popover>
        </Glass>
      );
    }
    render(<Harness />);
    const panel = screen.getByText("Published revisions");
    expect(screen.getByTestId("glass")).not.toContainElement(panel);
    expect(panel).toHaveClass("fixed", "overflow-y-auto");
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("what the overlay root sits in", () => {
  it("is placed by both layouts outside every bar, sidebar and page wrapper", () => {
    // Last child of <main> (after .page-in), and of the editor frame.
    expect(dashboardLayout).toMatch(/<\/RouteErrorBoundary>\s*<OverlayRoot \/>\s*<\/main>/);
    expect(editorLayout).toMatch(/<\/div>\s*<OverlayRoot \/>\s*<\/div>\s*\);/);
  });

  it("has no ancestor rule that would hold fixed overlays to its own box", () => {
    for (const selector of [".glass-app", ".glass-app main", ".glass-editor"]) {
      for (const body of rulesFor(selector)) expect(body, selector).not.toMatch(CONTAINING_BLOCK);
    }
  });
});
