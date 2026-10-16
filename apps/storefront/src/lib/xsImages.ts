import sizes from "./xsImages.json";
import { xsPicturePath } from "./xsPicture";

/**
 * A template picture's own width and height (scripts/xs-images.mjs writes
 * them to xsImages.json); null for any other picture. Server-only in use: the
 * list is not something to ship to a browser.
 */
const SIZES = sizes as unknown as Record<string, [number, number]>;

export function xsBox(src: string): readonly [number, number] | null {
  const path = xsPicturePath(src);
  return path && Object.hasOwn(SIZES, path) ? SIZES[path] : null;
}
