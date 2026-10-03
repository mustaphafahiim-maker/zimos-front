import type { Product, ProductMedia } from "@store-builder/api-client";
import { compressImageIfNeeded as compressImage, humanSize } from "@store-builder/image-tools";

/** Matches the backend's multer limit (5 MB) in modules/media/mediaService.js. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** The backend sniffs the real bytes, but we pre-filter on these to fail fast. */
export const ACCEPTED_IMAGE_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export const ACCEPTED_IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

/**
 * Client-side check before upload. Returns an error message, or null if the
 * file is acceptable. Type check tolerates a blank `file.type` (some browsers
 * leave it empty) and falls back to the extension.
 */
export function validateImageFile(file: File): string | null {
  const byExt = /\.(png|jpe?g|gif|webp)$/i.test(file.name);
  const byMime = file.type ? ACCEPTED_IMAGE_MIMES.includes(file.type) : false;
  if (!byMime && !byExt) {
    return `"${file.name}" isn't a PNG, JPEG, GIF or WEBP image.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    // Oversized files run through compressImageIfNeeded() first, so reaching
    // here means shrinking was either unsafe (animated GIF) or not enough.
    return `"${file.name}" is ${humanSize(file.size)} — the limit is 5 MB. Try a smaller or lower-resolution image.`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }
  return null;
}

// ---------------------------------------------------------------------
// Client-side compression
// ---------------------------------------------------------------------

/**
 * Shrinks an over-limit image in the browser so the merchant does not have to
 * resize it by hand (the shared @store-builder/image-tools, also used by the
 * storefront for shoppers' photos). Files already under the limit — the common
 * case — come back untouched, as do formats a canvas round-trip would damage.
 * If nothing gets under MAX_IMAGE_BYTES the original is returned, so
 * validateImageFile() rejects it exactly as it did before.
 */
export function compressImageIfNeeded(file: File): Promise<File> {
  return compressImage(file, { maxBytes: MAX_IMAGE_BYTES, debug: import.meta.env.DEV });
}

/**
 * Displayable src for a media entry. Prefer the host-relative `path` so the
 * image loads through the dev proxy (same-origin); fall back to stripping the
 * host off the absolute `url`.
 */
export function mediaSrc(media: ProductMedia): string {
  if (media.path) return media.path;
  return imageSrc(media.url) ?? media.url;
}

/**
 * Same host-stripping for a bare URL — a stored `logoUrl`, say, which the API
 * returns absolute against its own APP_URL. Rendering that directly breaks the
 * image whenever the dashboard is served from another origin (dev, or a
 * separate domain in production), so keep the path and let the proxy serve it.
 * Data and blob URLs are already displayable and pass through untouched.
 */
export function imageSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/")) return url;
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/** First media entry is the primary image. */
export function primaryImage(product: Pick<Product, "media">): ProductMedia | null {
  return product.media?.[0] ?? null;
}
