import { vi } from "vitest";

/**
 * jsdom has neither createImageBitmap nor a working canvas. This stands in for
 * both: createImageBitmap returns `bitmap` (set its size per test), drawImage
 * is recorded, and toBlob returns `encodedSize` bytes of the type asked for.
 * Call from beforeEach; vi.unstubAllGlobals / vi.restoreAllMocks undo it.
 */
export function stubCanvas() {
  const state = {
    bitmap: { width: 4000, height: 3000, close: vi.fn() },
    encodedSize: 1000,
    encodedType: null as string | null,
    drawImage: vi.fn(),
    toBlob: vi.fn(),
  };
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => state.bitmap)
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: state.drawImage,
    fillRect: vi.fn(),
    fillStyle: "",
    imageSmoothingQuality: "low",
  } as unknown as CanvasRenderingContext2D);
  state.toBlob.mockImplementation((cb: BlobCallback, type?: string) => {
    cb(new Blob([new Uint8Array(state.encodedSize)], { type: state.encodedType ?? type ?? "image/png" }));
  });
  HTMLCanvasElement.prototype.toBlob = state.toBlob as unknown as HTMLCanvasElement["toBlob"];
  return state;
}
