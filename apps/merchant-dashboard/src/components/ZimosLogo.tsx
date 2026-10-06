import { cn } from "@store-builder/ui";
import { ZAppIcon, ZLogo } from "@/brand/ZimosBrand";

/**
 * The ZIMOS logo in the dashboard: the three-module Z and the drawn wordmark
 * from `src/brand` (the owner changed the icon on 2026-10-04; the old PNG
 * exports are still in `public/brand/`). It is vector, so one component
 * serves every size and both themes.
 *
 * The marketing, storefront and platform-admin apps still carry their own
 * copies with the previous exports.
 */

export type ZimosLogoSurface = "auto" | "light" | "dark";

interface ZimosLogoProps {
  /** Rendered height in px. The width follows the lockup's proportions. */
  height?: number;
  /** `auto` follows the theme; `light` and `dark` are for a surface that does not. */
  surface?: ZimosLogoSurface;
  /** Kept for callers written for the PNG logo; the drawn logo has no files to locate. */
  basePath?: string;
  className?: string;
  alt?: string;
}

export function ZimosLogo({ height = 32, surface = "auto", className }: ZimosLogoProps) {
  // Never mirrored: the Z and the Latin wordmark read the same in Arabic.
  return (
    <span className={cn("inline-flex shrink-0 items-center", className)} dir="ltr">
      <ZLogo height={height} tone={surface === "dark" ? "dark" : surface === "light" ? "fixed" : "color"} />
    </span>
  );
}

interface ZimosMarkProps {
  /** Square size in px. */
  size?: number;
  basePath?: string;
  className?: string;
  alt?: string;
}

/** Icon-only mark on its app-icon tile — compact nav, avatars. */
export function ZimosMark({ size = 32, className }: ZimosMarkProps) {
  return <ZAppIcon size={Math.max(16, size)} markRatio={size < 40 ? 0.6 : 0.5} className={className} />;
}

export type ZimosLogoComponentProps = React.ComponentProps<typeof ZimosLogo>;
