"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { track, type PixelIds } from "@/lib/track";

// IDs are validated by the backend (digits / uppercase alphanumerics / hex),
// and re-checked here before being placed in an inline script.
const SAFE = /^[A-Za-z0-9-]{4,40}$/;

/**
 * Loads the ad pixels the merchant configured (dashboard → Marketing) and sends
 * a PageView on every client-side navigation. Nothing loads when no ID is set.
 *
 * The IDs are the public `tracking` block of GET /store/:workspaceId (read by
 * pixelIdsOf in lib/track.ts). Mounted by the funnel layout (app/store/[workspaceId]/f).
 */
export function TrackingPixels({ ids }: { ids: PixelIds }) {
  const meta = ids.meta && SAFE.test(ids.meta) ? ids.meta : null;
  const tiktok = ids.tiktok && SAFE.test(ids.tiktok) ? ids.tiktok : null;
  const snapchat = ids.snapchat && SAFE.test(ids.snapchat) ? ids.snapchat : null;
  const googleTag = ids.googleTag && SAFE.test(ids.googleTag) ? ids.googleTag : null;

  const pathname = usePathname();
  const search = useSearchParams();
  const first = useRef(true);

  // The init snippets already send the first page view; later route changes are ours.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    track("PageView");
    const w = window as Window & { gtag?: (...a: unknown[]) => void };
    if (googleTag && w.gtag) w.gtag("event", "page_view", { page_path: pathname });
  }, [pathname, search, googleTag]);

  if (!meta && !tiktok && !snapchat && !googleTag) return null;

  return (
    <>
      {meta && (
        <Script id="zimos-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${meta}');fbq('track','PageView');`}
        </Script>
      )}
      {tiktok && (
        <Script id="zimos-tiktok-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tiktok}');ttq.page();}(window,document,'ttq');`}
        </Script>
      )}
      {snapchat && (
        <Script id="zimos-snap-pixel" strategy="afterInteractive">
          {`(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','${snapchat}',{});snaptr('track','PAGE_VIEW');`}
        </Script>
      )}
      {googleTag && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${googleTag}`} strategy="afterInteractive" />
          <Script id="zimos-google-tag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${googleTag}');`}
          </Script>
        </>
      )}
    </>
  );
}
