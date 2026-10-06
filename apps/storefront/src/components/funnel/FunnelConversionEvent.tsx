"use client";

import { setFunnelConversionEvent, type ConversionEvent } from "@/lib/adPixels";

/**
 * Hands the funnel's own "Report orders as" (funnel settings → Tracking; the
 * public payload's settings.conversionEvent) to the ad pixels: an order placed
 * while this funnel's steps are on screen goes out as a Lead or a Purchase
 * accordingly, and null leaves it to the store (lib/adPixels).
 */
export function FunnelConversionEvent({ funnelId, conversionEvent }: { funnelId: string; conversionEvent: ConversionEvent | null }) {
  // During render, so a purchase sent from the step's first effects already uses it (idempotent).
  setFunnelConversionEvent(funnelId, conversionEvent);
  return null;
}
