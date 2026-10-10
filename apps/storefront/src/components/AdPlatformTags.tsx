"use client";

import { useEffect } from "react";
import { isAdTagPlatform, startAdPlatformTags, type AdTagPixel } from "@/lib/adPlatformTags";

/**
 * Starts the browser tags of X, Taboola, Outbrain, Kwai, Reddit and Microsoft
 * Ads for the store's pixels of those platforms. Mounted by
 * components/TrackingPixels beside every other pixel: until this mounts,
 * lib/adPlatformTags.ts creates no tag and sends nothing. Renders nothing.
 */
export function AdPlatformTags({ pixels }: { pixels: AdTagPixel[] }) {
  const key = pixels
    .filter((p) => isAdTagPlatform(p.platform))
    .map((p) => `${p.platform}:${p.pixelId}:${p.scope.type}`)
    .join("|");
  useEffect(() => {
    if (key) startAdPlatformTags(pixels);
    // The key says everything the start reads from `pixels`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
