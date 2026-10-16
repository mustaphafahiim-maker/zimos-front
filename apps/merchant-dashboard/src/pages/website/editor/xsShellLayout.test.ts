import { describe, expect, it } from "vitest";
import { readCanvasDrag, readCanvasStep, resolveDrag, shellDropTarget, type ShellPartGeometry } from "@/lib/canvasDrag";
import { addPart, findPart, hasOwnZones, missingParts, movePart, movePartBeside, removePart, templateZones, withZonesOn, zonesOn, type HeaderZones } from "./xsShellLayout";

const ZONES: HeaderZones = {
  notice: [{ id: "notice", type: "notice" }],
  links: [
    { id: "l1", type: "link", label: "Track", href: "/track" },
    { id: "language", type: "language" },
  ],
  brand: [{ id: "logo", type: "logo" }],
  menu: [{ id: "menu", type: "menu" }],
  icons: [
    { id: "search", type: "search" },
    { id: "cart", type: "cart" },
    { id: "phone", type: "phone" },
  ],
};

const ids = (zones: HeaderZones) => Object.fromEntries(Object.entries(zones).map(([zone, parts]) => [zone, parts.map((p) => p.id)]));

describe("xsShellLayout", () => {
  it("moves a part within its zone, counting the zone as it was", () => {
    expect(ids(movePart(ZONES, "search", "icons", 2)).icons).toEqual(["cart", "search", "phone"]);
    expect(ids(movePart(ZONES, "phone", "icons", 0)).icons).toEqual(["phone", "search", "cart"]);
  });

  it("moves a part to another zone", () => {
    const next = ids(movePart(ZONES, "language", "icons", 1));
    expect(next.links).toEqual(["l1"]);
    expect(next.icons).toEqual(["search", "language", "cart", "phone"]);
    expect(findPart(movePart(ZONES, "language", "icons", 1), "language")).toEqual({ zone: "icons", index: 1 });
  });

  it("moves a part beside the ones it was seen next to, past parts the look hides", () => {
    // Account and wishlist are in the zone but hidden by the look: "after cart" still means after cart.
    const zones: HeaderZones = { ...ZONES, icons: [{ id: "search", type: "search" }, { id: "account", type: "account" }, { id: "wishlist", type: "wishlist" }, { id: "cart", type: "cart" }, { id: "phone", type: "phone" }] };
    expect(ids(movePartBeside(zones, "search", "icons", null, "cart")).icons).toEqual(["account", "wishlist", "cart", "search", "phone"]);
    expect(ids(movePartBeside(zones, "cart", "icons", "search", null)).icons).toEqual(["cart", "search", "account", "wishlist", "phone"]);
    expect(ids(movePartBeside(zones, "logo", "menu", null, null)).menu).toEqual(["menu", "logo"]);
    expect(ids(movePartBeside(zones, "logo", "menu", null, null)).brand).toEqual([]);
    // Nothing to stand beside: unchanged.
    expect(movePartBeside(zones, "search", "icons", "nope", null)).toBe(zones);
    expect(movePartBeside(zones, "search", "icons", "search", null)).toBe(zones);
  });

  it("never removes the phone menu's button, and adds single parts once", () => {
    expect(removePart(ZONES, "phone")).toBe(ZONES);
    expect(ids(removePart(ZONES, "search")).icons).toEqual(["cart", "phone"]);
    expect(addPart(ZONES, "icons", { id: "cart-2", type: "cart" })).toBe(ZONES);
    expect(ids(addPart(ZONES, "links", { id: "t1", type: "text", label: "Hi" })).links).toEqual(["l1", "language", "t1"]);
    expect(missingParts(ZONES)).toEqual(expect.arrayContaining(["account", "wishlist", "social", "track"]));
    expect(missingParts(ZONES)).not.toContain("cart");
  });

  it("keeps a screen's own arrangement beside the computer's", () => {
    const phone = movePart(ZONES, "search", "icons", 3);
    const saved = withZonesOn(ZONES, "mobile", phone, "05");
    expect(hasOwnZones(saved, "mobile")).toBe(true);
    expect(hasOwnZones(saved, "tablet")).toBe(false);
    expect(ids(zonesOn(saved, "base", "05")).icons).toEqual(["search", "cart", "phone"]);
    expect(ids(zonesOn(saved, "tablet", "05")).icons).toEqual(["search", "cart", "phone"]);
    expect(ids(zonesOn(saved, "mobile", "05")).icons).toEqual(["cart", "phone", "search"]);
    // Back to the larger screen's: saved plain again.
    expect(withZonesOn(saved, "mobile", null, "05")).toEqual(ZONES);
  });

  it("starts a smaller screen's own arrangement from the template's", () => {
    const template = templateZones("05");
    const saved = withZonesOn(undefined, "mobile", movePart(template, "logo", "icons", 0), "05") as Record<string, unknown>;
    expect(saved.base).toEqual(template);
    expect(findPart(zonesOn(saved, "mobile", "05"), "logo")?.zone).toBe("icons");
  });

  it("reads every template's own arrangement, with a logo and the phone menu's button", () => {
    for (let n = 1; n <= 22; n++) {
      const zones = templateZones(String(n).padStart(2, "0"));
      const types = Object.values(zones).flat().map((p) => p.type);
      expect(types).toContain("logo");
      expect(types).toContain("phone");
    }
  });
});

describe("dragging a header part on the canvas", () => {
  const box = (id: string, left: number) => ({ id, top: 100, left, width: 40, height: 30 });
  const drag: ShellPartGeometry = {
    kind: "shell-part",
    sectionId: "header",
    partId: "search",
    device: "base",
    rtl: false,
    zones: [
      // The bar holds the menu and the icons.
      { zone: "brand", top: 90, left: 0, width: 1400, height: 60, parts: [box("logo", 40)] },
      { zone: "menu", top: 95, left: 300, width: 600, height: 40, parts: [box("menu", 320)] },
      { zone: "icons", top: 95, left: 1000, width: 300, height: 40, parts: [box("search", 1000), box("cart", 1100), box("phone", 1200)] },
      { zone: "links", top: 0, left: 0, width: 1400, height: 40, parts: [box("l1", 20)] },
    ],
  };

  it("lands in the smallest zone under the pointer, by the parts' middles", () => {
    expect(shellDropTarget(drag, 1250, 110)).toEqual({ zone: "icons", index: 3 });
    expect(shellDropTarget(drag, 1130, 110)).toEqual({ zone: "icons", index: 2 });
    expect(shellDropTarget(drag, 330, 110)).toEqual({ zone: "menu", index: 0 });
    expect(shellDropTarget(drag, 600, 20)).toEqual({ zone: "links", index: 1 });
  });

  it("is nowhere where it already is, or far from every zone", () => {
    expect(shellDropTarget(drag, 1010, 110)).toBeNull();
    expect(shellDropTarget(drag, 1060, 110)).toBeNull();
    expect(shellDropTarget(drag, 600, 400)).toBeNull();
  });

  it("reads right to left in Arabic", () => {
    const rtl = { ...drag, rtl: true, zones: [{ zone: "icons", top: 95, left: 1000, width: 300, height: 40, parts: [box("search", 1200), box("cart", 1100), box("phone", 1000)] }] };
    // Search comes first, on the right; left of the phone is the end of the row.
    expect(shellDropTarget(rtl, 1005, 110)).toEqual({ zone: "icons", index: 3 });
    expect(shellDropTarget(rtl, 1050, 110)).toEqual({ zone: "icons", index: 2 });
    expect(shellDropTarget(rtl, 1130, 110)).toBeNull();
  });

  it("turns into one move on the screen it was dragged on", () => {
    const labels = { auto: "Auto" };
    const result = resolveDrag({ drag, start: { x: 1010, y: 110, shift: false } }, { x: 1250, y: 110, shift: false }, labels);
    expect(result.feedback).toEqual({ kind: "shell-part", zone: "icons", index: 3 });
    // Named by the part it lands after, as shown.
    expect(result.edit).toEqual({ kind: "shell-move", id: "search", zone: "icons", before: null, after: "phone", device: "base" });
    const between = resolveDrag({ drag, start: { x: 1010, y: 110, shift: false } }, { x: 1130, y: 110, shift: false }, labels);
    expect(between.edit).toEqual({ kind: "shell-move", id: "search", zone: "icons", before: "phone", after: null, device: "base" });
  });

  it("checks what the frame sends", () => {
    const start = (geometry: unknown) => readCanvasDrag({ phase: "start", x: 1010, y: 110, drag: geometry });
    expect(start(drag)).toEqual({ type: "zimos:canvas-drag", phase: "start", drag, pointer: { x: 1010, y: 110, shift: false } });
    expect(start({ ...drag, partId: "<script>" })).toBeNull();
    expect(start({ ...drag, zones: [{ zone: "icons", top: 0, left: 0, width: 10, height: 10, parts: [{ id: 3 }] }] })).toBeNull();
const step = { kind: "shell-part", sectionId: "header", partId: "cart", device: "mobile", zone: "menu", before: null, after: "menu" };
    expect(readCanvasStep(step)).toEqual(step);
    expect(readCanvasStep({ ...step, sectionId: "footer" })).toBeNull();
    expect(readCanvasStep({ ...step, zone: "Menu!" })).toBeNull();
    expect(readCanvasStep({ ...step, after: "<b>" })).toBeNull();
  });
});
