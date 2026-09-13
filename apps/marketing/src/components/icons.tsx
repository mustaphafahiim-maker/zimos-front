import type { ComponentType, SVGProps } from "react";

/**
 * Minimal outline icons — 2px stroke on a 24px grid, rounded caps and joins.
 * Sized by the parent's `font-size` (1em) unless width/height are passed.
 * Direction-neutral unless noted (ArrowIcon flips in RTL via its class).
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

export type IconComponent = ComponentType<IconProps>;

export function SunIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

export function MenuIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ChatIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
      <path d="M8 9h8M8 12.5h5" />
    </svg>
  );
}

export function PhoneIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M15.5 3a5.5 5.5 0 0 1 5.5 5.5M15 6.5a2.5 2.5 0 0 1 2.5 2.5" />
      <path d="M6.6 4h2.5l1.3 4-2 1.2a11 11 0 0 0 4.7 4.7l1.2-2 4 1.3v2.5A2 2 0 0 1 20 20 16 16 0 0 1 4 6.6 2 2 0 0 1 6.6 4Z" />
    </svg>
  );
}

export function BarcodeIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M4 6v12M8 6v12M11 6v12M14.5 6v12M18 6v12M21 6v12" />
    </svg>
  );
}

export function PackageCheckIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5M21 8v4" />
      <path d="M15.5 18.5 18 21l4-4.5" />
    </svg>
  );
}

export function StorefrontIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M3.5 8.5 5 4.5h14l1.5 4Z" />
      <path d="M5 8.5V20h14V8.5" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  );
}

export function FunnelIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M3.5 4.5h17l-6.5 8v5.5l-4 2v-7.5Z" />
    </svg>
  );
}

export function TruckIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M3 6h11v10H3Z" />
      <path d="M14 9.5h4l3 3.5v3h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17.5" cy="18" r="2" />
    </svg>
  );
}

export function ChartIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M4 4v16h16" />
      <path d="M8.5 16v-4M13 16V8M17.5 16v-6" />
    </svg>
  );
}

export function ShieldIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M12 3 5 6v5c0 4.5 3 8.4 7 10 4-1.6 7-5.5 7-10V6Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function WorkflowIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
      <path d="M6.5 10v4a3.5 3.5 0 0 0 3.5 3.5h4" />
    </svg>
  );
}

export function UsersIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
    </svg>
  );
}

export function LayersIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="m12 3 9 5-9 5-9-5Z" />
      <path d="m3 12.5 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  );
}

export function CheckIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ChevronDownIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Points toward the inline end: right in LTR, mirrored to left in RTL. */
export function ArrowIcon({
  width = "1em",
  height = "1em",
  className = "",
  ...props
}: IconProps) {
  return (
    <svg
      {...base}
      width={width}
      height={height}
      className={`rtl:-scale-x-100 ${className}`}
      {...props}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
