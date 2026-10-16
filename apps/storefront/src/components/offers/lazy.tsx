"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

/**
 * The store-wide extras that wait for the merchant's settings before they
 * show anything — the exit popup, the sales notifications and the newsletter
 * sign-up — loaded once the page itself has finished loading.
 *
 * Each draws nothing until its own request comes back, so mounting it a
 * moment later changes nothing a shopper sees; what it changes is that their
 * code (with the offer cards, timers and forms it brings) is no longer
 * fetched and run while the page's first picture is still on its way.
 */
export const ExitDownsell = dynamic(() => import("./StoreOffers").then((m) => m.ExitDownsell), { ssr: false });
export const SocialProofPopup = dynamic(() => import("./Engagement").then((m) => m.SocialProofPopup), { ssr: false });
export const NewsletterSignup = dynamic(() => import("./Engagement").then((m) => m.NewsletterSignup), { ssr: false });

/** Its children, once the page has loaded and the browser has a moment to spare. */
export function AfterLoad({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Safari has no requestIdleCallback: a short timer instead.
    const idleSupported = typeof window.requestIdleCallback === "function";
    let handle = 0;
    const later = () => {
      handle = idleSupported ? window.requestIdleCallback(() => setReady(true), { timeout: 2000 }) : window.setTimeout(() => setReady(true), 200);
    };
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });
    return () => {
      window.removeEventListener("load", later);
      if (idleSupported) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);
  return ready ? <>{children}</> : null;
}
