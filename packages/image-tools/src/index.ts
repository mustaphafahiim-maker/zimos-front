/**
 * Browser-side image shrinking, shared by the merchant dashboard (media
 * library uploads) and the storefront (shoppers' photos for custom fields).
 *
 * It only saves bandwidth: the server re-encodes every upload anyway and is
 * the real guard (type by content, size caps, metadata stripped). A file this
 * cannot improve comes back untouched and the server decides.
 *
 * Framework-neutral on purpose — no `import.meta.env`, no `process` at module
 * scope — so Vite and Next.js can both bundle it. Pass `debug` to log what
 * was done; it defaults to "Node says development" where that can be read.
 */

export interface CompressOptions {
  /** Files at or under this size come back untouched. */
  maxBytes: number;
  /** Longest-edge caps, tried in order. */
  maxEdgeSteps?: readonly number[];
  /** Encoder quality, tried high to low within each size step. */
  qualitySteps?: readonly number[];
  /** Log the result to the console. */
  debug?: boolean;
}

const DEFAULT_EDGES = [2000, 1600, 1200, 900] as const;
const DEFAULT_QUALITIES = [0.9, 0.8, 0.7, 0.6] as const;

/**
 * GIF is deliberately absent: a canvas round-trip keeps only the first frame,
 * so an animated GIF would be silently flattened.
 */
const COMPRESSIBLE_MIMES = ["image/png", "image/jpeg", "image/webp"];

type Drawable = ImageBitmap | HTMLImageElement;

function developmentBuild(): boolean {
  try {
    // Next.js replaces this expression at build time; under Vite `process` is
    // not defined and the lookup throws, which reads as "not development".
    return process.env.NODE_ENV === "development";
  } catch {
    return false;
  }
}

export function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function isCompressible(file: File): boolean {
  const byMime = file.type ? COMPRESSIBLE_MIMES.includes(file.type) : false;
  const byExt = /\.(png|jpe?g|webp)$/i.test(file.name);
  return byMime || (!file.type && byExt);
}

function sourceSize(src: Drawable): { width: number; height: number } {
  return typeof HTMLImageElement !== "undefined" && src instanceof HTMLImageElement
    ? { width: src.naturalWidth, height: src.naturalHeight }
    : { width: src.width, height: src.height };
}

async function loadImage(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    try {
      // `from-image` applies EXIF orientation, which drawImage would otherwise drop.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to the <img> path below.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not decode "${file.name}".`));
      img.src = url;
    });
  } finally {
    // Safe once the image has decoded — the pixels are already in memory.
    URL.revokeObjectURL(url);
  }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

let webpSupport: Promise<boolean> | null = null;

/** Older Safari silently falls back to PNG here, which would not shrink at all. */
function supportsWebp(): Promise<boolean> {
  if (!webpSupport) {
    webpSupport = (async () => {
      const probe = document.createElement("canvas");
      probe.width = 1;
      probe.height = 1;
      const blob = await encode(probe, "image/webp", 0.8);
      return blob?.type === "image/webp";
    })().catch(() => false);
  }
  return webpSupport;
}

async function pickOutputType(file: File): Promise<string> {
  const isJpeg = file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name);
  if (isJpeg) return "image/jpeg";
  // WEBP keeps transparency and beats JPEG at equal quality; JPEG is the
  // fallback, at the cost of flattening any alpha onto white.
  return (await supportsWebp()) ? "image/webp" : "image/jpeg";
}

function extensionFor(mime: string): string {
  if (mime === "image/webp") return "webp";
  if (mime === "image/png") return "png";
  return "jpg";
}

function withExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "image";
  return `${base}.${ext}`;
}

function drawScaled(src: Drawable, maxEdge: number, opaque: boolean): HTMLCanvasElement | null {
  const { width, height } = sourceSize(src);
  if (!width || !height) return null;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (opaque) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Shrinks an image over `maxBytes` in the browser. Files already under it —
 * the common case — come back untouched, as do formats a canvas round-trip
 * would damage (GIF), and anything that cannot be decoded here.
 *
 * Walks down the edge caps, trying each quality, and stops at the first
 * encoding under `maxBytes`. If nothing gets there, the original comes back.
 */
export async function compressImageIfNeeded(file: File, options: CompressOptions): Promise<File> {
  const { maxBytes, maxEdgeSteps = DEFAULT_EDGES, qualitySteps = DEFAULT_QUALITIES } = options;
  const debug = options.debug ?? developmentBuild();
  if (file.size === 0 || file.size <= maxBytes) return file;
  if (!isCompressible(file)) return file;
  if (typeof document === "undefined") return file;

  let source: Drawable;
  try {
    source = await loadImage(file);
  } catch {
    return file; // Undecodable here; let the server have the final say.
  }

  try {
    const type = await pickOutputType(file);
    for (const maxEdge of maxEdgeSteps) {
      const canvas = drawScaled(source, maxEdge, type === "image/jpeg");
      if (!canvas) return file;
      for (const quality of qualitySteps) {
        const blob = await encode(canvas, type, quality);
        if (!blob) return file;
        if (blob.size <= maxBytes) {
          const compressed = new File([blob], withExtension(file.name, extensionFor(blob.type)), {
            type: blob.type,
            lastModified: Date.now(),
          });
          if (debug) {
            console.info(
              `[image-tools] compressed "${file.name}" ${humanSize(file.size)} → ${humanSize(compressed.size)} ` +
                `(${canvas.width}×${canvas.height}, ${blob.type}, q=${quality})`
            );
          }
          return compressed;
        }
      }
    }
    return file;
  } finally {
    if (typeof HTMLImageElement === "undefined" || !(source instanceof HTMLImageElement)) {
      (source as ImageBitmap).close();
    }
  }
}
