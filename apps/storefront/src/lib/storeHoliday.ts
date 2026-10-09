"use client";

import { useEffect, useMemo, useState } from "react";
import { holidayRefusalOf, storefrontHolidayOf, type ApiClient, type StorefrontHoliday } from "@store-builder/api-client";
import { fulfilmentCopy } from "@/lib/fulfilmentCopy";
import { holidaySentence, holidayView, type HolidayView } from "@/lib/holidayText";
import { useStore } from "@/lib/StoreContext";

export type { HolidayView } from "@/lib/holidayText";

/** The holiday the page was rendered with (GET /store/:ws, through the store layout); see lib/holidayText. */
export function useHoliday(): HolidayView {
  const { store, locale } = useStore();
  const holiday = store?.holiday ?? null;
  return useMemo(() => holidayView(holiday, fulfilmentCopy(locale), locale), [holiday, locale]);
}

/** A page that places orders follows the holiday itself. */
export type HolidayCheckout = HolidayView & {
  /** The shopper's words for a 423 STORE_ON_HOLIDAY refusal (the page then reads as paused); null for any other error. */
  onError: (err: unknown) => string | null;
};

/**
 * The holiday for a page that places orders (handoff 216): the store is read
 * again when the page opens — a holiday may have started or ended since the
 * shell was rendered — and a refused order, 423 STORE_ON_HOLIDAY, switches
 * the page to paused with the holiday the API named.
 */
export function useHolidayCheckout({ client, workspaceId }: { client: ApiClient; workspaceId: string }): HolidayCheckout {
  const { store, locale } = useStore();
  const [holiday, setHoliday] = useState<StorefrontHoliday | null>(store?.holiday ?? null);

  useEffect(() => {
    let cancelled = false;
    client
      .getStorefrontMeta(workspaceId)
      .then((meta) => {
        if (!cancelled) setHoliday(storefrontHolidayOf(meta));
      })
      .catch(() => {
        /* the page keeps what it was rendered with; the API still decides at checkout */
      });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId]);

  return useMemo(() => {
    const copy = fulfilmentCopy(locale);
    return {
      ...holidayView(holiday, copy, locale),
      onError(err: unknown) {
        const named = holidayRefusalOf(err);
        if (!named) return null;
        setHoliday(named);
        return holidaySentence(holidayView(named, copy, locale));
      },
    };
  }, [holiday, locale]);
}
