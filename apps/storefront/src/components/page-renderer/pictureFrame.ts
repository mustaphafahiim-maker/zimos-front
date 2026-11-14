/**
 * A picture's own box, for the places a merchant drops a picture of any size
 * into: the `image` element, a category tile, the picture banner.
 *
 *   ratio             the box's shape by name ("4:3"); unset, the picture
 *                     keeps its own shape, as every picture did before
 *   focusX, focusY    the part of the picture kept in view when the box is
 *                     another shape and crops it; unset, the centre
 *
 * With a shape the box is as wide as its column and as tall as the shape
 * says, whatever file is put in it: a panorama, a tall phone shot, a tiny icon
 * or an SVG all fill the same box, cropped around the chosen part. Start and
 * end follow the page's direction, like the slider's focus (showcase/heroLook).
 *
 * Plain props of the element or the item, never a style key, so the server
 * stores them without knowing about them.
 *
 * No imports on purpose: the node test loads this file as it is.
 */

/** The shapes a picture's box can take, as width to height. */
export const PICTURE_RATIOS = {
  "1:1": [1, 1],
  "4:3": [4, 3],
  "3:2": [3, 2],
  "16:9": [16, 9],
  "21:9": [21, 9],
  "3:4": [3, 4],
  "4:5": [4, 5],
  "2:3": [2, 3],
} as const;

export type PictureRatio = keyof typeof PICTURE_RATIOS;

/** The `aspect-ratio` of a named shape; null for anything else, which leaves the picture its own shape. */
export function pictureRatio(value: unknown): string | null {
  if (typeof value !== "string" || !Object.hasOwn(PICTURE_RATIOS, value)) return null;
  const [w, h] = PICTURE_RATIOS[value as PictureRatio];
  return `${w} / ${h}`;
}

const FOCUS_X: Record<string, number> = { start: 0, center: 50, end: 100 };
const FOCUS_Y: Record<string, number> = { top: 0, center: 50, bottom: 100 };

function edge(value: unknown, table: Record<string, number>): number {
  return typeof value === "string" && Object.hasOwn(table, value) ? table[value] : 50;
}

/**
 * The `object-position` that keeps the chosen part of a picture in view, or
 * null for the centre: a picture that names no part gets no position at all,
 * so its markup is what it always was.
 */
export function pictureFocus(item: Record<string, unknown>, rtl: boolean): string | null {
  const across = edge(item.focusX, FOCUS_X);
  const down = edge(item.focusY, FOCUS_Y);
  if (across === 50 && down === 50) return null;
  // Start is the right edge of an Arabic page.
  return `${rtl ? 100 - across : across}% ${down}%`;
}
