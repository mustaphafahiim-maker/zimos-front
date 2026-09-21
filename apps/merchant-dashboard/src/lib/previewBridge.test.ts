import { describe, expect, it } from "vitest";
import { originOf, readFrameMessage } from "./previewBridge";

/**
 * The editor's window accepts messages from anything that can reach it, so the
 * bridge must drop everything that isn't one of its own preview frames, at the
 * storefront's exact origin, saying one of three known things.
 */

const STOREFRONT = "http://localhost:3000";
const frameA = { name: "frame-a" };
const frameB = { name: "frame-b" };
const frames = [frameA, frameB];

const select = { type: "zimos:select-section", sectionId: "hero-1a2b" };

describe("originOf", () => {
  it("reduces a URL to its origin", () => {
    expect(originOf("http://localhost:3000")).toBe("http://localhost:3000");
    expect(originOf("https://store.zimos.co/some/path?x=1")).toBe("https://store.zimos.co");
  });

  it("returns null for anything that isn't a URL with an origin", () => {
    expect(originOf("not a url")).toBeNull();
    expect(originOf("")).toBeNull();
    expect(originOf("data:text/html,hi")).toBeNull();
  });
});

describe("readFrameMessage — origin check", () => {
  it("accepts a message from the storefront origin and one of our frames", () => {
    expect(readFrameMessage({ origin: STOREFRONT, data: select, source: frameB }, STOREFRONT, frames)).toEqual(
      select
    );
  });

  it("rejects any other origin, however close", () => {
    for (const origin of [
      "http://localhost:3001",
      "https://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3000.evil.test",
      "null",
      "",
    ]) {
      expect(readFrameMessage({ origin, data: select, source: frameA }, STOREFRONT, frames)).toBeNull();
    }
  });

  it("rejects everything when the storefront origin is unknown", () => {
    expect(readFrameMessage({ origin: STOREFRONT, data: select, source: frameA }, null, frames)).toBeNull();
  });

  it("rejects the right origin from a window that isn't one of our frames", () => {
    const stranger = { name: "another-tab" };
    expect(readFrameMessage({ origin: STOREFRONT, data: select, source: stranger }, STOREFRONT, frames)).toBeNull();
    expect(readFrameMessage({ origin: STOREFRONT, data: select, source: null }, STOREFRONT, frames)).toBeNull();
  });

  it("does not treat a missing frame (null contentWindow) as a match for a null source", () => {
    expect(readFrameMessage({ origin: STOREFRONT, data: select, source: null }, STOREFRONT, [null, null])).toBeNull();
  });
});

describe("readFrameMessage — payloads", () => {
  const read = (data: unknown) => readFrameMessage({ origin: STOREFRONT, data, source: frameA }, STOREFRONT, frames);

  it("reads the three frame messages", () => {
    expect(read({ type: "zimos:insert-section", index: 2 })).toEqual({ type: "zimos:insert-section", index: 2 });
    expect(read({ type: "zimos:preview-ready", sectionIds: ["a", "b"] })).toEqual({
      type: "zimos:preview-ready",
      sectionIds: ["a", "b"],
    });
  });

  it("drops junk ids from a ready message rather than the whole message", () => {
    expect(read({ type: "zimos:preview-ready", sectionIds: ["a", 7, "", null, "b"] })).toEqual({
      type: "zimos:preview-ready",
      sectionIds: ["a", "b"],
    });
    expect(read({ type: "zimos:preview-ready" })).toEqual({ type: "zimos:preview-ready", sectionIds: [] });
  });

  it("rejects malformed or unknown messages", () => {
    expect(read(null)).toBeNull();
    expect(read("zimos:select-section")).toBeNull();
    expect(read({ type: "zimos:select-section" })).toBeNull();
    expect(read({ type: "zimos:select-section", sectionId: 42 })).toBeNull();
    expect(read({ type: "zimos:select-section", sectionId: "" })).toBeNull();
    expect(read({ type: "zimos:insert-section", index: -1 })).toBeNull();
    expect(read({ type: "zimos:insert-section", index: 1.5 })).toBeNull();
    expect(read({ type: "zimos:insert-section", index: "1" })).toBeNull();
    // The editor's own outgoing message is not something a frame may send.
    expect(read({ type: "zimos:editor-state", selectedId: "a" })).toBeNull();
    expect(read({ type: "something-else" })).toBeNull();
  });
});
