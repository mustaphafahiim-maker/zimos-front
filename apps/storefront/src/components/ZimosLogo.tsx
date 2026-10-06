import * as React from "react";
import { ZAppIcon, ZLogo } from "./brand/ZimosBrand";

/**
 * The ZIMOS logo: the three-module Z and the drawn wordmark, in the brand's
 * own colours whatever this app's palette is. Same component API as the PNG
 * logo it replaces (the old exports are still in `public/brand/`).
 */

const cn = (...classes: Array<string | undefined | false>) => classes.filter(Boolean).join(" ");

export type ZimosLogoSurface = "auto" | "light" | "dark";

interface ZimosLogoProps {
  /** Rendered height in px. The width follows the lockup's proportions. */
  height?: number;
  /** `auto` follows the theme; `light` and `dark` are for a surface that does not. */
  surface?: ZimosLogoSurface;
  basePath?: string;
  className?: string;
  alt?: string;
}

export function ZimosLogo({ height = 32, surface = "auto", className }: ZimosLogoProps) {
  return (
    <span className={cn("inline-flex shrink-0 items-center", className)} dir="ltr">
      <ZLogo height={height} tone={surface === "dark" ? "dark" : surface === "light" ? "fixed" : "brand"} />
    </span>
  );
}

interface ZimosMarkProps {
  size?: number;
  basePath?: string;
  className?: string;
  alt?: string;
}

/** Icon-only mark on its app-icon tile. */
export function ZimosMark({ size = 32, className }: ZimosMarkProps) {
  return <ZAppIcon size={Math.max(16, size)} markRatio={size < 40 ? 0.6 : 0.5} className={className} />;
}

export type ZimosLogoComponentProps = React.ComponentProps<typeof ZimosLogo>;
