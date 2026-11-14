"use client";

import { useEffect } from "react";
import { enterProductScope } from "@/lib/adPixels";

/**
 * Tells the tracking pixels which product is on screen, so a pixel the
 * merchant scoped to that product starts receiving this visit's events
 * (lib/adPixels.ts). Renders nothing.
 */
export function PixelScope({ productIds }: { productIds: string[] }) {
  const key = productIds.join(",");
  useEffect(() => {
    enterProductScope(key ? key.split(",") : []);
  }, [key]);
  return null;
}
