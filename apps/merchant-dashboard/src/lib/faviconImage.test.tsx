// A .tsx file only to run under jsdom (the "screens" project): it needs DOM canvas and File.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubCanvas } from "@/test/canvasStub";
import { FAVICON_SIZE, FaviconError, makeSquareIcon } from "./faviconImage";

let canvas: ReturnType<typeof stubCanvas>;
beforeEach(() => {
  canvas = stubCanvas();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const file = (name: string, type: string) => new File([new Uint8Array(100)], name, { type });

const problemOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return null;
  } catch (err) {
    return err instanceof FaviconError ? err.problem : "other";
  }
};

describe("makeSquareIcon", () => {
  it("crops the centre square of a wide picture and brings it down to 512px, as a PNG", async () => {
    canvas.bitmap = { width: 1000, height: 600, close: vi.fn() };
    const icon = await makeSquareIcon(file("logo.jpg", "image/jpeg"));
    expect(canvas.drawImage).toHaveBeenCalledWith(canvas.bitmap, 200, 0, 600, 600, 0, 0, FAVICON_SIZE, FAVICON_SIZE);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png");
    expect(icon.type).toBe("image/png");
    expect(icon.name).toBe("favicon.png");
    expect(canvas.bitmap.close).toHaveBeenCalled();
  });

  it("crops a tall picture from its middle and never scales a small one up", async () => {
    canvas.bitmap = { width: 64, height: 100, close: vi.fn() };
    await makeSquareIcon(file("i.png", "image/png"));
    expect(canvas.drawImage).toHaveBeenCalledWith(canvas.bitmap, 0, 18, 64, 64, 0, 0, 64, 64);
  });

  it("takes an ICO", async () => {
    canvas.bitmap = { width: 48, height: 48, close: vi.fn() };
    await expect(makeSquareIcon(file("favicon.ico", "image/x-icon"))).resolves.toBeInstanceOf(File);
  });

  it("refuses a picture under 32×32", async () => {
    canvas.bitmap = { width: 31, height: 400, close: vi.fn() };
    expect(await problemOf(makeSquareIcon(file("i.png", "image/png")))).toBe("small");
  });

  it("refuses another type before decoding it", async () => {
    expect(await problemOf(makeSquareIcon(file("i.svg", "image/svg+xml")))).toBe("type");
    expect(await problemOf(makeSquareIcon(file("doc.pdf", "application/pdf")))).toBe("type");
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("says when the browser cannot read the file", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => Promise.reject(new Error("bad"))));
    expect(await problemOf(makeSquareIcon(file("i.png", "image/png")))).toBe("unreadable");
  });
});
