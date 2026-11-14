import type { CSSProperties } from "react";

/**
 * The smaller, modern copies of the imported templates' pictures
 * (scripts/xs-images.mjs): beside every .jpg/.jpeg/.png under public/xs it
 * writes `<name>.<width>.avif` and `.webp` at each of these widths. Knowing
 * that, the address of a template picture is enough to name all its copies —
 * on the server and in a client component alike, with no list to ship.
 *
 * Anything else (a merchant's own upload) has no copies and is drawn as it is.
 */

export const XS_PICTURE_WIDTHS = [480, 768, 1200, 1600] as const;

const TEMPLATE_PICTURE = /^\/xs\/\d\d\/[\w./-]+\.(?:jpe?g|png)$/i;

/**
 * `/xs/NN/…` when `src` is a template picture: a path, or an address on any
 * host with that path (a template's demo products are saved with the store's
 * full address). Null for anything else.
 */
export function xsPicturePath(src: string): string | null {
  let path = src.trim();
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      return null;
    }
  }
  return TEMPLATE_PICTURE.test(path) && !path.includes("..") ? path : null;
}

/** The copy of a template picture at one width, in one format. */
export function xsCopy(path: string, width: (typeof XS_PICTURE_WIDTHS)[number], format: "avif" | "webp"): string {
  return `${path.replace(/\.(?:jpe?g|png)$/i, "")}.${width}.${format}`;
}

/** Every copy of a template picture in one format, as a `srcset` by width (for markup that sizes its pictures itself). */
export function xsSrcSet(path: string, format: "avif" | "webp"): string {
  return XS_PICTURE_WIDTHS.map((width) => `${xsCopy(path, width, format)} ${width}w`).join(", ");
}

/** Where a phone stops and the copy it takes. */
const PHONE = "(max-width: 767px)";
const PHONE_COPY = 1200;
const WIDE_COPY = 1600;

/**
 * The <source>s of a template picture drawn by the imported templates' own
 * rules: the 1600-wide copy, and on a phone the 1200-wide one, each in AVIF
 * then WebP. They are named by density against the picture's own width
 * (`natural`, when the server knows it), not by width: a look's rule that
 * leaves a picture at its own size (`width: auto`) then finds exactly the
 * size it always had, where a width-and-`sizes` list would have given it the
 * `sizes` instead.
 */
export function xsSources(path: string, natural?: number | null): { media?: string; type: string; srcSet: string }[] {
  const named = (width: number) => {
    // A copy is never wider than its original (scripts/xs-images.mjs).
    const density = natural ? Math.min(width, natural) / natural : 1;
    return density === 1 ? "" : ` ${Number(density.toFixed(4))}x`;
  };
  const sources: { media?: string; type: string; srcSet: string }[] = [];
  for (const [media, width] of [
    [PHONE, PHONE_COPY],
    [undefined, WIDE_COPY],
  ] as const) {
    for (const format of ["avif", "webp"] as const) {
      sources.push({ ...(media ? { media } : {}), type: `image/${format}`, srcSet: `${xsCopy(path, width, format)}${named(width)}` });
    }
  }
  return sources;
}

/** A picture as a CSS background, its smallest-format copy first, the original last for an older browser. */
function imageSet(path: string, original: string, width: (typeof XS_PICTURE_WIDTHS)[number]): string {
  const type = /\.png$/i.test(path) ? "image/png" : "image/jpeg";
  return `image-set(url("${xsCopy(path, width, "avif")}") type("image/avif"), url("${xsCopy(path, width, "webp")}") type("image/webp"), url("${original}") type("${type}"))`;
}

/**
 * The inline style of a box whose picture is its background (a slide, a
 * page-title banner): the 1600-wide copies, and the 1200-wide ones a phone
 * takes instead (`--xs-bg-phone`, applied by app/xs-sections.css) — a
 * cover-cropped slide is drawn far wider than the phone. Any other address is
 * the plain `url()` it always was.
 */
/** A picture's focal point as saved ("30% 60%", each 0–100), or null. */
export function xsFocal(value: unknown): string | null {
  return typeof value === "string" && /^(?:100|[1-9]?\d)% (?:100|[1-9]?\d)%$/.test(value) ? value : null;
}

export function xsBackground(src: string, focal?: string | null): CSSProperties {
  // The point the merchant set the picture on (the canvas's dot, components/preview/BackgroundHandles), else the look's own.
  const at: CSSProperties = focal ? { backgroundPosition: focal } : {};
  const path = xsPicturePath(src);
  if (!path) return { backgroundImage: `url("${src}")`, ...at };
  const wide = imageSet(path, src, WIDE_COPY);
  // `--xs-bg` too: a right-to-left store draws a template's own photograph mirrored (app/xs-sections.css).
  return { backgroundImage: wide, ["--xs-bg" as string]: wide, ["--xs-bg-phone" as string]: imageSet(path, src, PHONE_COPY), ...at };
}
