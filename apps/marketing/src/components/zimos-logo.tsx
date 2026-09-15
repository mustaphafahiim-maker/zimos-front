/* eslint-disable @next/next/no-img-element -- the official raster exports are
   rendered as-is under the `.zimos-logo` rules in app/globals.css; next/image
   would add wrappers that break those rules. */
import * as React from "react";

/**
 * The official ZIMOS logo, rendered from the approved exports only.
 * The marketing app does not depend on @store-builder/ui, so this is a local
 * copy — keep the markup and class names in sync with the shared one.
 *
 * Never redraw, retype or recolour the logo. The exports carry real alpha, so
 * they need no blend modes; the rules that pick the right lockup for a surface
 * (`.zimos-logo`, `.zimos-mark`) live in `app/globals.css`.
 *
 * Assets are served from `public/brand/`:
 *   zimos-logo-light.png  full logo, for light surfaces
 *   zimos-logo-dark.png   full logo (white wordmark), for dark surfaces
 *   zimos-mark-tile.png   icon-only mark on its app-icon tile
 */

const cn = (...classes: Array<string | undefined | false>) =>
  classes.filter(Boolean).join(" ");

export type ZimosLogoSurface = "auto" | "light" | "dark";

interface ZimosLogoProps {
  /** Rendered height in px. The width follows the export's aspect ratio. */
  height?: number;
  /** `auto` follows the `.dark` class on <html>. */
  surface?: ZimosLogoSurface;
  /** Where the app serves the brand folder. Defaults to `/brand`. */
  basePath?: string;
  className?: string;
  alt?: string;
}

export function ZimosLogo({
  height = 32,
  surface = "auto",
  basePath = "/brand",
  className,
  alt = "ZIMOS",
}: ZimosLogoProps) {
  // Both exports are cropped to the identical ink bounding box, so one height
  // gives both the same optical size — no per-variant nudging.
  return (
    <span
      className={cn("zimos-logo", className)}
      data-surface={surface}
      style={{ height }}
      role="img"
      aria-label={alt}
    >
      <img
        className="zimos-logo-on-light"
        src={`${basePath}/zimos-logo-light.png`}
        alt=""
        draggable={false}
        style={{ height }}
      />
      <img
        className="zimos-logo-on-dark"
        src={`${basePath}/zimos-logo-dark.png`}
        alt=""
        draggable={false}
        style={{ height }}
      />
    </span>
  );
}

interface ZimosMarkProps {
  /** Square size in px. Keep at 24 px or larger (brand minimum). */
  size?: number;
  basePath?: string;
  className?: string;
  alt?: string;
}

/** Icon-only mark on its app-icon tile — compact nav, favicons, avatars. */
export function ZimosMark({
  size = 32,
  basePath = "/brand",
  className,
  alt = "ZIMOS",
}: ZimosMarkProps) {
  const s = Math.max(24, size);
  return (
    <span className={cn("zimos-mark", className)} style={{ width: s, height: s }}>
      <img src={`${basePath}/zimos-mark-tile.png`} alt={alt} draggable={false} />
    </span>
  );
}

/** Approved brand phrases. Use only where contextually appropriate. */
export const ZIMOS_PHRASES = {
  limits: "Commerce Without Limits",
  loop: "Build. Sell. Grow.",
  tomorrow: "Commerce for a brighter tomorrow.",
} as const;

export type ZimosLogoComponentProps = React.ComponentProps<typeof ZimosLogo>;
