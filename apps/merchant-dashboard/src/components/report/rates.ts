import { formatPercentValue } from "@/lib/format";

/**
 * Whether a conversion rate says something about the store. The API reports it as a
 * percentage (12.5 = 12.5%) of orders over the visits the store counted. Orders can
 * outnumber those visits — orders the merchant typed in, visits a browser never
 * reported — and then the rate is over 100% and means nothing.
 */
export function conversionKnown(percent: number | null | undefined): percent is number {
  return percent !== null && percent !== undefined && Number.isFinite(percent) && percent <= 100;
}

/** A conversion rate for the screen: "—" when there is none or when it is over 100% (see `conversionKnown`). */
export function formatConversion(percent: number | null | undefined): string {
  return conversionKnown(percent) ? formatPercentValue(percent / 100) : "—";
}
