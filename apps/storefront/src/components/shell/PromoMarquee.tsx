import type { CSSProperties } from "react";

/**
 * The announcement bar as a running line: every message, one after another,
 * sliding past without a seam (`themeSettings.header.announcement.marquee`).
 *
 * Pure CSS, like the `marquee` page section: the track holds the same group
 * of messages several times over and slides by exactly one group's width, so
 * the loop lands on an identical frame. It pauses under the pointer, and for
 * a shopper who asked for less motion it stands still and scrolls by hand.
 */
const COPIES = 8;

export function PromoMarquee({
  messages,
  label,
  style,
}: {
  messages: string[];
  label: string;
  style?: CSSProperties;
}) {
  const group = (hidden: boolean, key: number) => (
    <div key={key} className="zs-promo__group" aria-hidden={hidden || undefined}>
      {messages.map((message, i) => (
        <span key={i} className="zs-promo__item">
          {message}
        </span>
      ))}
    </div>
  );

  return (
    <div
      role="region"
      aria-label={label}
      data-zimos-shell="announcement"
      className="zs-promo"
      style={{ ...style, ["--zs-promo-copies" as string]: COPIES }}
    >
      <div className="zs-promo__track">{Array.from({ length: COPIES }, (_, i) => group(i > 0, i))}</div>
    </div>
  );
}
