import type { SVGProps } from "react";

/** Minimal inline icon set — no icon library in the storefront bundle. */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CashIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 9.5v5M18 9.5v5" />
  </Base>
);

export const TruckIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 6.5h11v9H3zM14 9.5h4l3 3v3h-7z" />
    <circle cx="7" cy="17.5" r="1.7" />
    <circle cx="17.5" cy="17.5" r="1.7" />
  </Base>
);

export const ReturnIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Base>
);

export const PhoneIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 3.5h3.2l1.6 4-2 1.3a11 11 0 0 0 5.4 5.4l1.3-2 4 1.6V17a2 2 0 0 1-2 2A15.5 15.5 0 0 1 3 5.5a2 2 0 0 1 2-2z" />
  </Base>
);

export const CheckIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Base>
);

/** The "no" half of a check/cross pair, and the close control of the lightbox. */
export const CrossIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Base>
);

export const ChevronIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);

/** Points toward the inline-end; flip with `rtl:rotate-180`. */
export const ArrowIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

/** Always points up — never flipped, in either direction. */
export const ArrowUpIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Base>
);

/** Shown over the gallery's main image: the photo opens larger. */
export const ZoomIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2M8.5 11h5M11 8.5v5" />
  </Base>
);

export const CartGlyph = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.1a2 2 0 0 0 2-1.5L21 8H6.2" />
    <circle cx="10" cy="20" r="1.2" />
    <circle cx="17" cy="20" r="1.2" />
  </Base>
);

export const BoxIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
    <path d="M3 8l9 5 9-5M12 13v8" />
  </Base>
);

export const ShareIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
  </Base>
);

export const CopyIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Base>
);

export const GiftIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 9h17v3.5h-17zM5 12.5h14V20H5zM12 9v11" />
    <path d="M12 9c-2.5 0-4-1-4-2.4S9.5 4 12 9zM12 9c2.5 0 4-1 4-2.4S14.5 4 12 9z" />
  </Base>
);

export const SearchIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Base>
);

/** The mobile header's menu control; the sheet it opens closes with CrossIcon. */
export const MenuIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

/** Online payment by card — shown only when the store has Paymob connected. */
export const CardIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
    <path d="M2.5 10h19M6.5 14.5h4" />
  </Base>
);

/** Online payment from a mobile wallet — same condition as CardIcon. */
export const WalletIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5H18v3" />
    <path d="M3.5 7.5v9a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-13a2 2 0 0 1-2-1z" />
    <circle cx="16.5" cy="13.5" r="1.2" />
  </Base>
);

/** The gallery slideshow's autoplay toggle, showing when it is running. */
export const PauseIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 5v14M16 5v14" />
  </Base>
);

/** The gallery slideshow's autoplay toggle, showing when it is stopped. */
export const PlayIcon = (p: IconProps) => (
  <Base {...p} fill="currentColor">
    <path d="M7 4.5v15l13-7.5z" />
  </Base>
);

export const WhatsAppIcon = ({ size = 20, ...rest }: IconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" />
  </svg>
);
