import type { ReactNode } from "react";

/**
 * A small built-in stroke icon set for the `icon` element and decorative
 * glyphs. `icon.name` is free text in the editor, so unknown names fall back
 * to a neutral dot instead of a broken image.
 */
export const ICON_PATHS: Record<string, string> = {
  star: "M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z",
  heart: "M12 20.5s-7.5-4.6-7.5-9.7A4.3 4.3 0 0 1 12 8.2a4.3 4.3 0 0 1 7.5 2.6c0 5.1-7.5 9.7-7.5 9.7z",
  check: "M4.5 12.5l5 5 10-11",
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 7 19zM18 19a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 18 19z",
  shield: "M12 3l7.5 3v5.5c0 4.5-3.2 8.3-7.5 9.5-4.3-1.2-7.5-5-7.5-9.5V6zM8.8 12l2.2 2.2 4.2-4.4",
  gift: "M3.5 9h17v3.5h-17zM5 12.5h14V20H5zM12 9v11M12 9c-2.5 0-4-1-4-2.4S9.5 4 12 9zM12 9c2.5 0 4-1 4-2.4S14.5 4 12 9z",
  cash: "M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6.5 10v4M17.5 10v4",
  return: "M9 14l-5-5 5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  phone: "M5 3.5h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 5.6 5.6l1.4-2.3 4.5 1.8V18a2.5 2.5 0 0 1-2.5 2.5A15.5 15.5 0 0 1 2.5 6 2.5 2.5 0 0 1 5 3.5z",
  whatsapp: "M4 20l1.2-3.8A8 8 0 1 1 8 19zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .9a4.5 4.5 0 0 1-2.3-2.3l.9-1-1-2z",
  chat: "M4 5h16v11H9l-5 4z",
  box: "M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5L12 12l8.5-4.5M12 12v9",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  leaf: "M5 19c0-8 6-14 15-14 0 9-6 15-14 15zM5 19l7-7",
  tag: "M3 12V3h9l9 9-9 9zM7.5 7.5h.01",
  location: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  mail: "M3 5.5h18v13H3zM3 6l9 7 9-7",
  image: "M3.5 5h17v14h-17zM3.5 16l5-5 4 4 3-3 5 5M15.5 9.5h.01",
  play: "M8 5v14l11-7z",
  ruler: "M3 16.5L16.5 3 21 7.5 7.5 21zM7 12.5l2 2M10 9.5l2 2M13 6.5l2 2",
  arrow: "M5 12h14M13 6l6 6-6 6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  cart: "M3 4h2.5l2.2 11h10.6L20.5 8H7M9.5 20h.01M17.5 20h.01",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  quote: "M9.5 7H5v6h4v4H5M19.5 7H15v6h4v4h-4",
};

export function Icon({
  name,
  size = 24,
  className,
  label,
  strokeWidth = 1.7,
}: {
  name: string;
  size?: number;
  className?: string;
  label?: string;
  strokeWidth?: number;
}): ReactNode {
  const path = ICON_PATHS[name.trim().toLowerCase()];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {path ? <path d={path} /> : <circle cx="12" cy="12" r="4" />}
    </svg>
  );
}
