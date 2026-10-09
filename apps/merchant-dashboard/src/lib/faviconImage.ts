/**
 * Turns a picked file into a store favicon: the centre square of the picture,
 * at most FAVICON_SIZE pixels a side (never scaled up), as a PNG. The output
 * is always PNG because the media library takes PNG, JPEG, GIF and WebP only;
 * an ICO is accepted here as long as the browser can decode it. It does not
 * go through the general upload resize (lib/imageResize), which has its own
 * rules and would leave a non-square picture as it is.
 */

export const FAVICON_SIZE = 512;
export const FAVICON_MIN = 32;
export const FAVICON_ACCEPT = "image/png,image/x-icon,image/vnd.microsoft.icon,image/jpeg,image/webp,.ico";

const FAVICON_MIMES = ["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/jpeg", "image/webp"];

export type FaviconProblem = "type" | "small" | "unreadable";

export class FaviconError extends Error {
  readonly problem: FaviconProblem;

  constructor(problem: FaviconProblem) {
    super(`favicon: ${problem}`);
    this.problem = problem;
  }
}

export function isFaviconFile(file: File): boolean {
  if (file.type && FAVICON_MIMES.includes(file.type)) return true;
  return /\.(png|ico|jpe?g|webp)$/i.test(file.name);
}

export async function makeSquareIcon(file: File): Promise<File> {
  if (!isFaviconFile(file)) throw new FaviconError("type");
  if (typeof createImageBitmap !== "function") throw new FaviconError("unreadable");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new FaviconError("unreadable");
  }
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    if (side < FAVICON_MIN) throw new FaviconError("small");
    const size = Math.min(side, FAVICON_SIZE);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new FaviconError("unreadable");
    ctx.imageSmoothingQuality = "high";
    // The centre square of a wide or tall picture.
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new FaviconError("unreadable");
    return new File([blob], "favicon.png", { type: "image/png" });
  } finally {
    bitmap.close();
  }
}
