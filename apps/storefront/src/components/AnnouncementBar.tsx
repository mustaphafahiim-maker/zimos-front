"use client";

import { useEffect, useRef, useState } from "react";
import type { StoreAnnouncement } from "@/lib/storeAnnouncement";
import { StoreLink } from "@/components/StoreRoute";
import { ArrowIcon } from "./Icons";
import { PromoMarquee } from "./shell/PromoMarquee";
import { container } from "./ui";

/** How long each message sits before the next one fades in. */
const ROTATE_MS = 4500;

/** One message's type: two lines at most, centred. */
const MESSAGE = "line-clamp-2 text-center text-xs font-medium leading-snug sm:text-sm";

/**
 * One line above the masthead, in the merchant's words: a delivery note, a
 * promotion, a holiday closure. Drawn only when the public store payload
 * carries one (lib/storeAnnouncement) — there is no default text — so most
 * stores never see it and lose no height to it.
 *
 * `announcement.messages` — set only when the payload actually carries more
 * than one line — rotates the bar through them a few seconds apart, on a
 * cross-fade, pausing on hover or focus so a shopper reading one never has it
 * swapped out from under them. `prefers-reduced-motion` skips the timer
 * entirely and just shows the first message, the same as a plain one-line
 * bar. The common case — one message, which is all the website editor writes
 * today — never mounts the timer at all.
 *
 * A rotating bar is as tall as its tallest message, always. Every message is
 * laid out in the same grid cell and only the current one is visible, so a
 * two-line message following a one-line one changes nothing but the words:
 * the bar sits in the sticky header, and a bar that grew by a line would push
 * the whole page down every few seconds.
 *
 * The merchant's own bar colours apply when they set them; otherwise it is
 * the brand primary, which already carries a contrast-picked foreground.
 */
export function AnnouncementBar({ announcement, label }: { announcement: StoreAnnouncement; label: string }) {
  const messages = announcement.messages ?? [announcement.text];
  const rotating = messages.length > 1;
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!rotating) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      setIndex((i) => (i + 1) % messages.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [rotating, messages.length]);

  const style =
    announcement.background || announcement.color
      ? {
          ...(announcement.background ? { backgroundColor: announcement.background } : {}),
          ...(announcement.color ? { color: announcement.color } : {}),
        }
      : undefined;

  const current = messages[index] === undefined ? 0 : index;
  const text = rotating ? (
    // All of them, stacked in one cell: the cell is as tall as the tallest.
    <span className="grid min-w-0">
      {messages.map((message, i) => (
        <span
          key={i}
          aria-hidden={i === current ? undefined : true}
          // The class that fades a message in is given only to the current one, so it plays each time one comes up.
          className={`col-start-1 row-start-1 flex items-center justify-center ${i === current ? "zimos-announce-msg" : "invisible"}`}
        >
          <span className={MESSAGE}>{message}</span>
        </span>
      ))}
    </span>
  ) : (
    <span className={`zimos-announce-msg ${MESSAGE}`}>{messages[0]}</span>
  );

  if (announcement.marquee) return <PromoMarquee messages={messages} label={label} style={style} />;

  return (
    <div
      role="region"
      aria-label={label}
      // Names the bar for the editor preview's click-to-select; inert on a live page.
      data-zimos-shell="announcement"
      className="bg-primary text-on-primary"
      style={style}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      onFocus={() => (pausedRef.current = true)}
      onBlur={() => (pausedRef.current = false)}
    >
      <div className={`${container} flex min-h-9 items-center justify-center py-1.5`}>
        {announcement.href ? (
          <StoreLink
            href={announcement.href}
            // The ring takes the bar's own text colour: the brand outline would vanish on a brand background.
            // The link looks as slim as the bar; the layer behind it gives a thumb the full 44px.
            className="relative inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 underline-offset-4 before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            style={{ color: "inherit" }}
          >
            {text}
            <ArrowIcon size={14} className="shrink-0 rtl:rotate-180" />
          </StoreLink>
        ) : (
          text
        )}
      </div>
    </div>
  );
}
