"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { track } from "@/lib/track";
import { registerPixels, type ConversionEvent, type PurchaseTiming, type StorePixel } from "@/lib/adPixels";
import { AdPlatformTags } from "./AdPlatformTags";

/**
 * Loads the tracking pixels the merchant configured (dashboard → Marketing →
 * Tracking tools) and sends a PageView on every client-side navigation.
 * Nothing loads when the store has none.
 *
 * The pixels are the public `trackingPixels` block of GET /store/:workspaceId
 * (read and re-validated by storePixelsOf in lib/adPixels.ts, so every ID
 * placed in an inline script below is plain [A-Za-z0-9_-]). Mounted by the
 * store layout, so funnel pages (nested inside it) load them too.
 *
 * Every pixel is initialised; only the store-wide ones get the first page
 * view here. A funnel's or product's pixels get theirs when the shopper
 * reaches that funnel or product (lib/adPixels.ts decides per event).
 */
export function TrackingPixels({
  pixels,
  purchaseTiming,
  conversionEvent,
}: {
  pixels: StorePixel[];
  purchaseTiming?: PurchaseTiming;
  /** Whether an order is reported as a Purchase or a Lead (GET /store/:ws `conversionEvent`). */
  conversionEvent?: ConversionEvent;
}) {
  // Before any effect below (or in a child page) sends an event.
  registerPixels(pixels, purchaseTiming, conversionEvent);

  const of = (platform: StorePixel["platform"]) => pixels.filter((p) => p.platform === platform);
  const storeWide = (list: StorePixel[]) => list.filter((p) => p.scope.type === "all");
  const meta = of("meta");
  const tiktok = of("tiktok");
  const snapchat = of("snapchat");
  const google = of("google");
  const gtm = of("gtm");
  const clarity = of("clarity");
  const pinterest = of("pinterest");

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
  }, [pathname, search]);

  if (pixels.length === 0) return null;

  return (
    <>
      {/* X, Taboola, Outbrain, Kwai, Reddit and Microsoft Ads (handoff 251): loaded from lib/adPlatformTags.ts. */}
      <AdPlatformTags pixels={pixels} />
      {meta.length > 0 && (
        <Script id="zimos-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');${meta
            .map((p) => `fbq('init','${p.pixelId}');`)
            .join("")}${storeWide(meta)
            .map((p) => `fbq('trackSingle','${p.pixelId}','PageView');`)
            .join("")}`}
        </Script>
      )}
      {tiktok.length > 0 && (
        <Script id="zimos-tiktok-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};${tiktok
            .map((p) => `ttq.load('${p.pixelId}');`)
            .join("")}${storeWide(tiktok)
            .map((p) => `ttq.instance('${p.pixelId}').page();`)
            .join("")}}(window,document,'ttq');`}
        </Script>
      )}
      {snapchat.length > 0 && (
        // Snap sends an event to every initialised pixel, so only the
        // store-wide ones are initialised here; scoped ones join on first match.
        <Script id="zimos-snap-pixel" strategy="afterInteractive">
          {`(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');${storeWide(snapchat)
            .map((p) => `snaptr('init','${p.pixelId}',{});`)
            .join("")}${storeWide(snapchat).length ? "snaptr('track','PAGE_VIEW');" : ""}`}
        </Script>
      )}
      {pinterest.length > 0 && (
        // Like Snap, a Pinterest event goes to every loaded tag: the store-wide
        // ones load here, scoped ones on first match (lib/adPixels.ts).
        <Script id="zimos-pinterest-tag" strategy="afterInteractive">
          {`!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");${storeWide(pinterest)
            .map((p) => `pintrk('load','${p.pixelId}');`)
            .join("")}${storeWide(pinterest).length ? "pintrk('page');" : ""}`}
        </Script>
      )}
      {google.length > 0 && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${google[0].pixelId}`} strategy="afterInteractive" />
          <Script id="zimos-google-tag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());${google
              .map((p) => `gtag('config','${p.pixelId}'${p.scope.type === "all" ? "" : ",{send_page_view:false}"});`)
              .join("")}`}
          </Script>
        </>
      )}
      {storeWide(gtm).map((p) => (
        <Script key={p.pixelId} id={`zimos-gtm-${p.pixelId}`} strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${p.pixelId}');`}
        </Script>
      ))}
      {storeWide(clarity)
        .slice(0, 1)
        .map((p) => (
          <Script key={p.pixelId} id="zimos-clarity" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${p.pixelId}");`}
          </Script>
        ))}
    </>
  );
}
