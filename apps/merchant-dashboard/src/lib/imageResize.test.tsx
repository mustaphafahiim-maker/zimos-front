// A .tsx file only to run under jsdom (the "screens" project): it needs DOM canvas and File.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubCanvas } from "@/test/canvasStub";
import { SMALL_IMAGE_EDGE, shrinkForUpload } from "./imageResize";

let canvas: ReturnType<typeof stubCanvas>;
beforeEach(() => {
  canvas = stubCanvas();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const file = (name: string, type: string, bytes = 5000) => new File([new Uint8Array(bytes)], name, { type });

describe("shrinkForUpload", () => {
  it("scales a big JPEG to 2000px on its long side at quality 0.85, upright", async () => {
    const result = await shrinkForUpload(file("p.jpg", "image/jpeg"));
    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), { imageOrientation: "from-image" });
    expect(canvas.drawImage).toHaveBeenCalledWith(canvas.bitmap, 0, 0, 2000, 1500);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.85);
    expect(result.file.type).toBe("image/jpeg");
    expect(result.file.name).toBe("p.jpg");
    expect(result.savedBytes).toBe(4000);
    expect(canvas.bitmap.close).toHaveBeenCalled();
  });

  it("keeps a PNG a PNG (transparency) and only scales it", async () => {
    canvas.bitmap = { width: 1000, height: 3000, close: vi.fn() };
    const result = await shrinkForUpload(file("logo.png", "image/png"));
    expect(canvas.drawImage).toHaveBeenCalledWith(canvas.bitmap, 0, 0, 667, 2000);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png", undefined);
    expect(result.file.type).toBe("image/png");
  });

  it("never upscales, and leaves a PNG already within the limit alone", async () => {
    canvas.bitmap = { width: 800, height: 600, close: vi.fn() };
    const jpeg = await shrinkForUpload(file("small.jpg", "image/jpeg"));
    expect(canvas.drawImage).toHaveBeenCalledWith(canvas.bitmap, 0, 0, 800, 600);
    expect(jpeg.savedBytes).toBe(4000);

    const png = file("small.png", "image/png");
    expect((await shrinkForUpload(png)).file).toBe(png);
  });

  it("does not touch favicon-sized pictures", async () => {
    canvas.bitmap = { width: SMALL_IMAGE_EDGE, height: SMALL_IMAGE_EDGE, close: vi.fn() };
    const icon = file("icon.png", "image/png");
    expect(await shrinkForUpload(icon)).toEqual({ file: icon, savedBytes: 0 });
    expect(canvas.toBlob).not.toHaveBeenCalled();
  });

  it("skips SVG and GIF without decoding them", async () => {
    const svg = file("a.svg", "image/svg+xml");
    const gif = file("a.gif", "image/gif");
    expect((await shrinkForUpload(svg)).file).toBe(svg);
    expect((await shrinkForUpload(gif)).file).toBe(gif);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("sends the original when the result is not smaller or not the type asked for", async () => {
    canvas.encodedSize = 9000;
    const big = file("p.jpg", "image/jpeg");
    expect((await shrinkForUpload(big)).file).toBe(big);

    canvas.encodedSize = 100;
    canvas.encodedType = "image/png"; // an encoder without WebP
    const webp = file("p.webp", "image/webp");
    expect((await shrinkForUpload(webp)).file).toBe(webp);
  });

  it("sends the original when the picture cannot be decoded", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => Promise.reject(new Error("bad"))));
    const broken = file("p.jpg", "image/jpeg");
    expect(await shrinkForUpload(broken)).toEqual({ file: broken, savedBytes: 0 });
  });
});
