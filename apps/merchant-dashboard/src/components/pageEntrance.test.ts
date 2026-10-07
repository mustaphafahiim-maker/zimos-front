/// <reference types="node" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every routed page sits in `.page-in` (DashboardLayout), and the dialogs a
 * page opens (Modal, ConfirmDialog) are `position: fixed` inside it. A
 * transform that stays on `.page-in` after its entrance makes it the box those
 * dialogs are placed against, so on a long page the dialog lands at the top of
 * the page, out of view, under a grey backdrop. jsdom does not lay out, so this
 * reads the stylesheet.
 */
const css = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf8");

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no ${selector} rule in index.css`);
  return match[1];
}

describe(".page-in entrance", () => {
  it("still animates the page in", () => {
    expect(ruleBody(".page-in")).toMatch(/animation:\s*page-in\b/);
  });

  it("leaves no transform behind once it has played", () => {
    const body = ruleBody(".page-in");
    expect(body).not.toMatch(/\b(both|forwards)\b/);
    expect(body).not.toMatch(/animation-fill-mode/);
    expect(body).not.toMatch(/\b(transform|translate|will-change|filter|contain)\s*:/);
  });
});

describe("phone navigation drawer entrance", () => {
  it("slides in and leaves no transform behind (the store switcher and dialogs sit in it)", () => {
    const body = ruleBody(".animate-slide-in-start");
    expect(body).toMatch(/animation:\s*slide-in-start\b/);
    expect(body).not.toMatch(/\b(both|forwards)\b/);
    expect(body).toMatch(/\bbackwards\b/);
  });
});
