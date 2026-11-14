import type { SVGProps } from "react";

/**
 * Minimal outline icons — 2px stroke on a 24px grid, rounded caps and joins.
 * Sized by the parent's `font-size` (1em) unless width/height are passed.
 * The landing's own icons are in duo-icons.tsx.
 */

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export function CheckIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
