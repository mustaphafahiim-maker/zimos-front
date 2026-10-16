import type { ComponentType, SVGProps } from "react";
import type { SocialPlatform } from "./links";

/**
 * Outline marks for each platform, drawn here (no icon package): 2px stroke
 * on a 24px grid with round caps and joins, like the marketing site's icons.
 * They inherit `currentColor`, so they follow the theme. Never mirrored in
 * RTL — they're logos, not arrows.
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

function InstagramIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

function FacebookIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14 21v-8h3l.5-3.5H14V7.5c0-1 .5-1.5 1.5-1.5h2V3H15c-3 0-4.5 1.8-4.5 4.5v2H8V13h2.5v8Z" />
    </svg>
  );
}

function TikTokIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14 3v12a4 4 0 1 1-4-4" />
      <path d="M14 3a5 5 0 0 0 5 5" />
    </svg>
  );
}

function XIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4h4.5L20 20h-4.5Z" />
      <path d="M20 4l-4.7 4.7M8.7 15.3 4 20" />
    </svg>
  );
}

function WhatsAppIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 20.5l1.4-4.1A8.5 8.5 0 1 1 7.6 19.1Z" />
      <path
        strokeWidth={1.5}
        d="M9.5 9a5.5 5.5 0 0 0 5.5 5.5l.8-1.3-1.8-.9-.8.6a3.5 3.5 0 0 1-1.6-1.6l.6-.8-.9-1.8Z"
      />
    </svg>
  );
}

function EmailIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export const SOCIAL_ICONS: Record<SocialPlatform, ComponentType<IconProps>> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
  x: XIcon,
  whatsapp: WhatsAppIcon,
  email: EmailIcon,
};
