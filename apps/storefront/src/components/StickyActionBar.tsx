"use client";

import type { ReactNode } from "react";
import { useKeyboardInset } from "@/lib/useKeyboardInset";

/**
 * The bar pinned to the bottom of a phone screen with the page's main action
 * (the product page's "order now", the checkout's confirm button).
 *
 *  - It clears the home indicator: the bottom padding adds
 *    `env(safe-area-inset-bottom)`, which is 0 where there is none.
 *  - It rides above the on-screen keyboard instead of hiding under it
 *    (lib/useKeyboardInset).
 *  - `hidden` slides it away — when the action it repeats is already on
 *    screen — and takes it out of the tab order and the accessibility tree.
 *  - Wide screens never see it (`until`), and reduced motion makes the slide a cut.
 *
 * The page decides when it shows: the product page keeps room for it at the
 * end of <main>; the checkout hides it once its own button is reached.
 */
export function StickyActionBar({
  hidden,
  until = "md",
  children,
}: {
  hidden: boolean;
  until?: "md" | "lg";
  children: ReactNode;
}) {
  const keyboard = useKeyboardInset(!hidden);
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-raised/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur transition-transform duration-200 motion-reduce:transition-none ${
        until === "lg" ? "lg:hidden" : "md:hidden"
      } ${hidden ? "translate-y-full" : "translate-y-0"}`}
      style={!hidden && keyboard > 0 ? { transform: `translateY(-${keyboard}px)` } : undefined}
      aria-hidden={hidden}
      inert={hidden}
    >
      {children}
    </div>
  );
}
