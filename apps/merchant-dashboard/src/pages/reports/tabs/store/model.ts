import type {
  ReportsCompare,
  ReportsFunnelStep,
  ReportsFunnelStepKey,
  WebAnalyticsCompare,
  WebAnalyticsFilterKey,
  WebAnalyticsFilters,
  WebAnalyticsRangeParams,
  WebAnalyticsUnit,
} from "@store-builder/api-client";
import { formatPercentValue } from "@/lib/format";
import type { ReportRange } from "@/lib/reportRange";
import { FILTER_KEYS } from "@/lib/webAnalytics";

/**
 * The numbers behind the "store" tab, without any drawing: how the hub's ONE
 * range becomes web-analytics params, the web-analytics filters, the ways the
 * visitors' table can be broken down, and the rule of the tab's sentence.
 */

/** What every request of the tab needs from the hub's range. */
export type StoreRange = Pick<ReportRange, "from" | "to" | "compare" | "fromDay" | "toDay">;

/** Element ids: the visitors' table (a filter keeps the page there) and the store-search block (`/analytics/search` lands on it). */
export const TRAFFIC_ANCHOR = "traffic";
export const SEARCH_ANCHOR = "search";

// ------------------------------------------------------- range → web params --

/**
 * The web-analytics screen had its own period (11 presets, default 24 hours)
 * and its own comparison words. In the hub it takes the hub's range: the same
 * instants (`to` exclusive), and «الفترة اللي قبلها» → `prev`, «نفس الأيام السنة
 * اللي فاتت» → `yoy`, no comparison → nothing asked for.
 */
export function webCompare(compare: ReportsCompare): WebAnalyticsCompare | undefined {
  return compare === "previous" ? "prev" : compare === "year" ? "yoy" : undefined;
}

export function webParams(range: Pick<ReportRange, "from" | "to">, filters: WebAnalyticsFilters = {}): WebAnalyticsRangeParams {
  return { from: range.from, to: range.to, ...filters };
}

// ------------------------------------------------------------------ filters --

export type FilterEntry = [WebAnalyticsFilterKey, string];

/** The active filters in the API's own order of keys. */
export function filterEntries(filters: WebAnalyticsFilters): FilterEntry[] {
  const entries: FilterEntry[] = [];
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) entries.push([key, value]);
  }
  return entries;
}

/** Names a set of filters, for a cache key. Empty when nothing is filtered. */
export function filtersKey(filters: WebAnalyticsFilters): string {
  return filterEntries(filters)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

// ---------------------------------------------------- the visitors' table --

/** The four ways the table is switched (the panels of the old web-analytics screen). */
export type TrafficView = "pages" | "sources" | "devices" | "countries";

/**
 * What a view can be broken down by — the tabs inside each old panel. "path"
 * also brings the pages people entered on and left from, as columns.
 */
export type TrafficDim =
  | "path"
  | "title"
  | "referrer"
  | "channel"
  | "utm_source"
  | "utm_campaign"
  | "device"
  | "browser"
  | "os"
  | "screen"
  | "language"
  | "country"
  | "region"
  | "city";

export const TRAFFIC_VIEWS: readonly TrafficView[] = ["pages", "sources", "devices", "countries"];

export const VIEW_DIMS: Record<TrafficView, readonly TrafficDim[]> = {
  pages: ["path", "title"],
  sources: ["referrer", "channel", "utm_source", "utm_campaign"],
  devices: ["device", "browser", "os", "screen", "language"],
  countries: ["country", "region", "city"],
};

/**
 * The filter a row applies when it is pressed. A channel is worked out from
 * several fields and cannot be filtered on; a language is grouped by its first
 * two letters while the filter matches the whole tag, so pressing one would
 * find nothing — neither is offered.
 */
export const DIM_FILTER: Partial<Record<TrafficDim, WebAnalyticsFilterKey>> = {
  path: "url",
  title: "title",
  referrer: "referrer",
  utm_source: "utm_source",
  utm_campaign: "utm_campaign",
  device: "device",
  browser: "browser",
  os: "os",
  screen: "screen",
  country: "country",
  region: "region",
  city: "city",
};

/** Rows asked for per list — the API's ceiling, and what «المزيد» used to open. */
export const ROW_LIMIT = 500;

// ------------------------------------------------------------- time buckets --

export const WEB_UNITS: readonly WebAnalyticsUnit[] = ["minute", "hour", "day", "month"];

const UNIT_MS: Record<WebAnalyticsUnit, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  month: 30 * 86_400_000,
};

/** A chart of more bars than this is a blur, and a slow request: such a unit is not offered for the range. */
const MAX_BUCKETS = 750;

/** The units the range can be split by: minutes only inside a day, hours up to a month. */
export function unitsFor(range: Pick<ReportRange, "from" | "to">): WebAnalyticsUnit[] {
  const span = Date.parse(range.to) - Date.parse(range.from);
  if (!Number.isFinite(span) || span <= 0) return ["day"];
  const fit = WEB_UNITS.filter((unit) => span / UNIT_MS[unit] <= MAX_BUCKETS);
  return fit.length > 0 ? fit : ["month"];
}

export function isWebUnit(value: string | null): value is WebAnalyticsUnit {
  return value !== null && (WEB_UNITS as readonly string[]).includes(value);
}

// --------------------------------------------------------------- formatting --

/** The API's rates are percentages (12.5 = 12.5%); "—" when there is no denominator. */
export function formatRate(percent: number | null | undefined): string {
  return percent === null || percent === undefined || !Number.isFinite(percent) ? "—" : formatPercentValue(percent / 100);
}

/** `part` as a percentage of `whole`; null when the whole is unknown or zero. */
export function shareOf(part: number, whole: number | null | undefined): number | null {
  return whole && whole > 0 ? (part / whole) * 100 : null;
}

/** A percentage for a CSV cell: one decimal, a plain number. */
export function csvRate(percent: number | null | undefined): number | null {
  return percent === null || percent === undefined || !Number.isFinite(percent) ? null : Math.round(percent * 10) / 10;
}

/** A signed change in percent between two counts; null without a baseline. */
export function changePercent(value: number | null | undefined, previous: number | null | undefined): number | null {
  if (value === null || value === undefined || previous === null || previous === undefined || previous === 0) return null;
  return ((value - previous) / Math.abs(previous)) * 100;
}

/** "+12.3%" / "-4.0%" / "—". */
export function formatChange(percent: number | null): string {
  if (percent === null) return "—";
  return `${percent > 0 ? "+" : ""}${formatPercentValue(percent / 100)}`;
}

/** A page path as people read it («/products/تيشيرت»), never throwing on a broken escape. */
export function safeDecode(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

const minorDigits = new Map<string, number>();

/** An amount in minor units as a plain number of its currency (for a CSV cell). */
export function majorAmount(minor: number, currency: string): number {
  let digits = minorDigits.get(currency);
  if (digits === undefined) {
    try {
      digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      digits = 2;
    }
    minorDigits.set(currency, digits);
  }
  return minor / 10 ** digits;
}

/** Hands a file fetched through the API client (a server-made CSV) to the browser's download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // The browser needs a moment to start reading the blob before it is let go.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * A percentage as «n من كل of», the way a sentence says a rate: out of 10 from
 * 10% up, out of 100 below it — so 4% reads «٤ من كل ١٠٠», never «٠ من كل ١٠».
 * `n` is 0 only when less than half a percent is left.
 */
export function outOf(percent: number): { n: number; of: number } {
  if (percent >= 10) return { n: Math.min(10, Math.round(percent / 10)), of: 10 };
  return { n: Math.max(0, Math.round(percent)), of: 100 };
}

// ------------------------------------------------------------- the sentence --

/**
 * THE RULE OF THE TAB'S SENTENCE — "the step that loses the most visitors".
 *
 * The funnel has five steps (entered the store → viewed a product → added to
 * cart → started the order → ordered), each with `rateOfPrevious`: the share
 * of the step before it that reached it.
 *
 * 1. A step is judged only when the step BEFORE it has at least MIN_SESSIONS
 *    (50) sessions: a share of fewer is noise. With fewer than 50 entries to
 *    the store nothing is judged, and the sentence says the data is too thin.
 * 2. The leak is the judged step with the SMALLEST `rateOfPrevious`. On a tie
 *    the earlier step wins — more people pass through it.
 * 3. If even that step keeps HEALTHY_RATE (60%) or more, nothing is leaking:
 *    the sentence says so (good news) and names the weakest step.
 * 4. Otherwise the sentence names the step, says the rate as «n من كل ١٠» and
 *    what to do about that step. It is a warning; it turns to bad news when the
 *    same step kept clearly more in the comparison period — its share fell by
 *    WORSE_BY (a fifth) or more, both periods having 50 sessions or more at the
 *    step before. With no comparison asked for there is no "before" to say.
 */
export const MIN_SESSIONS = 50;
export const HEALTHY_RATE = 60;
export const WORSE_BY = 0.2;

export type FunnelLeakStep = Exclude<ReportsFunnelStepKey, "sessions">;

export interface FunnelLeak {
  step: FunnelLeakStep;
  /** The share of the step before that reached this one, in percent. */
  rate: number;
  /** The same share in the comparison period; null when there is none, or too few sessions in it. */
  previousRate: number | null;
}

export function findLeak(funnel: readonly ReportsFunnelStep[]): FunnelLeak | null {
  let leak: FunnelLeak | null = null;
  for (let index = 1; index < funnel.length; index++) {
    const step = funnel[index];
    const before = funnel[index - 1];
    const key = step.step;
    if (key === "sessions" || before.sessions < MIN_SESSIONS || step.rateOfPrevious === null) continue;
    // Strictly smaller: on a tie the earlier step stays.
    if (leak && step.rateOfPrevious >= leak.rate) continue;
    const previousRate =
      step.previous !== null && before.previous !== null && before.previous >= MIN_SESSIONS
        ? (step.previous / before.previous) * 100
        : null;
    leak = { step: key, rate: step.rateOfPrevious, previousRate };
  }
  return leak;
}
