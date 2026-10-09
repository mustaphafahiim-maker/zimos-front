/**
 * Shrinks a big photo in the browser before it is uploaded, so a 12-megapixel
 * phone picture travels as a ~2000px one: less to send, less for the server to
 * re-encode. The server applies the same limit (MEDIA_MAX_DIMENSION), so this
 * only saves time; anything it cannot do sends the original unchanged.
 *
 *  - never upscales; pictures of SMALL_IMAGE_EDGE or less (icons, favicons)
 *    are sent exactly as they are;
 *  - JPEG and WebP are re-encoded at `quality`; PNG stays PNG (transparency
 *    kept) and is only scaled; SVG, GIF and anything else are skipped (a
 *    canvas would flatten an animation or rasterise a vector);
 *  - createImageBitmap with imageOrientation "from-image" draws a phone photo
 *    upright, so dropping its EXIF tag leaves nothing on its side;
 *  - a result that is not actually smaller, or in another type than asked
 *    (an encoder without WebP), is thrown away for the original.
 */

export const UPLOAD_MAX_EDGE = 2000;
export const UPLOAD_QUALITY = 0.85;
/** At or under this on the long side a picture is an icon: it is never touched. */
export const SMALL_IMAGE_EDGE = 512;

export interface ShrinkResult {
  file: File;
  /** Bytes the upload got lighter by; 0 when the original is sent. */
  savedBytes: number;
}

const BY_MIME: Record<string, string> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};

function resizableType(file: File): string | null {
  if (file.type) return BY_MIME[file.type] ?? null;
  if (/\.jpe?g$/i.test(file.name)) return "image/jpeg";
  if (/\.png$/i.test(file.name)) return "image/png";
  if (/\.webp$/i.test(file.name)) return "image/webp";
  return null;
}

export async function shrinkForUpload(
  file: File,
  { maxEdge = UPLOAD_MAX_EDGE, quality = UPLOAD_QUALITY }: { maxEdge?: number; quality?: number } = {}
): Promise<ShrinkResult> {
  const untouched: ShrinkResult = { file, savedBytes: 0 };
  const type = resizableType(file);
  if (!type || file.size === 0 || typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return untouched;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const longest = Math.max(bitmap.width, bitmap.height);
    if (!longest || longest <= SMALL_IMAGE_EDGE) return untouched;
    const scale = Math.min(1, maxEdge / longest);
    // A PNG at its own size can only come back bigger from a canvas.
    if (scale === 1 && type === "image/png") return untouched;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return untouched;
    if (type === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, type === "image/png" ? undefined : quality)
    );
    if (!blob || blob.type !== type || blob.size >= file.size) return untouched;
    const shrunk = new File([blob], file.name, { type, lastModified: file.lastModified });
    return { file: shrunk, savedBytes: file.size - shrunk.size };
  } catch {
    return untouched;
  } finally {
    bitmap?.close();
  }
}
