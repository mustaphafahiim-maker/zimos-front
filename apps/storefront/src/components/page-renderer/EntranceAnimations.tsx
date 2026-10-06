"use client";

import { useEffect } from "react";

/**
 * Plays the page's entrance animations (elementAnimation.ts): an element
 * marked `data-za` starts hidden and is revealed — `za-in` — the first time
 * it scrolls into view. Elements that arrive later (the editor's live
 * preview re-rendering) are picked up too.
 *
 * Nothing is hidden for a shopper who asks the device for less motion, nor
 * without JavaScript (the noscript rule), so content is never lost to an
 * animation that cannot run.
 */

const CSS = `
@media (prefers-reduced-motion:no-preference){
[data-za]{opacity:0;transition-property:opacity,transform;transition-duration:var(--za-d,600ms);transition-delay:var(--za-w,0ms);transition-timing-function:cubic-bezier(.2,.7,.2,1)}
[data-za="slide-up"]{transform:translateY(32px)}
[data-za="slide-down"]{transform:translateY(-32px)}
[data-za="slide-start"]{transform:translateX(-32px)}
[data-za="slide-end"]{transform:translateX(32px)}
[dir="rtl"] [data-za="slide-start"]{transform:translateX(32px)}
[dir="rtl"] [data-za="slide-end"]{transform:translateX(-32px)}
[data-za="zoom-in"]{transform:scale(.85)}
[data-za="zoom-out"]{transform:scale(1.12)}
[data-za].za-in{opacity:1;transform:none}
}`;

export function EntranceAnimations() {
  useEffect(() => {
    const reveal = (el: Element) => el.classList.add("za-in");
    if (typeof IntersectionObserver === "undefined") {
      document.querySelectorAll("[data-za]").forEach(reveal);
      return;
    }
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal(entry.target);
          seen.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -5% 0px" }
    );
    const watch = () => document.querySelectorAll("[data-za]:not(.za-in)").forEach((el) => seen.observe(el));
    watch();
    const added = new MutationObserver(watch);
    added.observe(document.body, { childList: true, subtree: true });
    return () => {
      seen.disconnect();
      added.disconnect();
    };
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <noscript>
        <style>{"[data-za]{opacity:1!important;transform:none!important}"}</style>
      </noscript>
    </>
  );
}
