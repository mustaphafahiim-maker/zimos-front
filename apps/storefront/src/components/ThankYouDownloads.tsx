"use client";

import { useEffect, useState } from "react";
import { storefrontOrderDownloads, type TrackDownload, type TrackResult } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { getPaymentToken } from "@/lib/payments";
import { TrackOrderDownloads } from "./TrackOrderDownloads";

// The payment may be captured a moment after the shopper lands here (the
// gateway's webhook): ask a few times, then stop — the links also arrive by
// email and WhatsApp, and stay on the tracking page.
const DELAYS_MS = [0, 3000, 6000, 10000, 15000, 20000];

/**
 * The digital products of an online order on the thank-you page (SPEC
 * §18.2: "a download link on the thank-you page"). Nothing for a cash on
 * delivery order or one without digital products.
 */
export function ThankYouDownloads({ workspaceId, orderId }: { workspaceId: string; orderId: string }) {
  const [downloads, setDownloads] = useState<TrackDownload[]>([]);

  useEffect(() => {
    const token = getPaymentToken(workspaceId, orderId);
    if (!token) return;
    const api = createStorefrontApiClient();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = (attempt: number) => {
      timer = setTimeout(async () => {
        try {
          const found = await storefrontOrderDownloads(api, workspaceId, orderId, token);
          if (stopped) return;
          if (found.length > 0) return setDownloads(found);
        } catch {
          // Not this shopper's order, or the API is away: show nothing.
          return;
        }
        if (attempt + 1 < DELAYS_MS.length) ask(attempt + 1);
      }, DELAYS_MS[attempt]);
    };
    ask(0);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [workspaceId, orderId]);

  if (downloads.length === 0) return null;
  return <TrackOrderDownloads result={{ downloads } as unknown as TrackResult} />;
}
