import { useState, type ReactNode } from "react";
import type { WebAnalyticsMetricRow, WebAnalyticsRealtime, WebAnalyticsRealtimeActivity } from "@store-builder/api-client";
import { Input, cn } from "@store-builder/ui";
import { Segmented } from "@/components/Segmented";
import { HBarList } from "@/components/charts";
import { IconCaretDown, IconClick, IconEye, IconGlobe, IconPeople, type IconComponent } from "@/components/icons";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { countOf } from "@/lib/plural";
import { countryName, flagOf } from "@/lib/webAnalytics";
import { useAgo } from "./ago";

/**
 * The parts of «تفاصيل أكتر» that are read from the snapshot already on screen
 * (no request of their own): the pages being looked at, where the visitors come
 * from, and the activity log of the old realtime screen with its totals.
 *
 * All of them cover the last 30 minutes of the WHOLE store — the realtime block
 * of the snapshot is not narrowed by the funnel filter.
 */

/** The realtime block looks back this far. */
export const REALTIME_WINDOW_MINUTES = 30;
/** Rows of a "top" list, as the old screen showed. */
const TOP_ROWS = 10;
/** Log lines shown before «اعرض الكل». */
const LOG_ROWS = 12;

const STRINGS = {
  en: {
    pagesNote: "The pages opened most in the last {window}, from the latest activity.",
    pagesEmpty: "No page was opened in the last {window}.",
    referrers: "Sites they came from",
    referrersEmpty: "Nobody came from another site in the last {window}.",
    countries: "Countries",
    countriesEmpty: "No country is known for these visitors yet.",
    sourcesNote: "Counted from the latest activity of the last {window}.",
    direct: "Direct",
    totals: "The last {window}",
    views: "Views",
    visitors: "Visitors",
    events: "Events",
    countriesCount: "Countries",
    filter: "Show",
    all: "All",
    onlyViews: "Views",
    onlyEvents: "Events",
    search: "Search the log",
    searchPlaceholder: "A page, an event, a site, a country…",
    opened: "Opened",
    did: "Did",
    logEmpty: "Nothing yet — the log fills up as visitors arrive.",
    logNoMatch: "Nothing in the log matches.",
    showAll: "Show all ({n})",
    showLess: "Show less",
  },
  ar: {
    pagesNote: "أكتر الصفحات اللي اتفتحت في آخر {window}، من آخر حركة في المتجر.",
    pagesEmpty: "مفيش صفحة اتفتحت في آخر {window}.",
    referrers: "المواقع اللي جايين منها",
    referrersEmpty: "محدّش جه من موقع تاني في آخر {window}.",
    countries: "الدول",
    countriesEmpty: "لسه مفيش دولة معروفة للزوار دول.",
    sourcesNote: "محسوبة من آخر حركة في المتجر في آخر {window}.",
    direct: "مباشر",
    totals: "آخر {window}",
    views: "مشاهدات",
    visitors: "زوار",
    events: "أحداث",
    countriesCount: "دول",
    filter: "اعرض",
    all: "الكل",
    onlyViews: "المشاهدات",
    onlyEvents: "الأحداث",
    search: "دوّر في السجل",
    searchPlaceholder: "صفحة، حدث، موقع، دولة…",
    opened: "فتح",
    did: "عمل",
    logEmpty: "لسه مفيش حاجة — السجل بيتملي أول ما الزوار ييجوا.",
    logNoMatch: "مفيش حاجة في السجل بالكلام ده.",
    showAll: "اعرض الكل ({n})",
    showLess: "اعرض أقل",
  },
} satisfies Messages;

/** A path as the visitor would read it («/products/قميص»), or as it came when it cannot be decoded. */
export function readablePath(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

const QUIET = "text-sm leading-6 text-pretty text-ink-soft";
const NOTE = "text-[13px] leading-5 text-pretty text-ink-soft";
const SUB_HEADING = "mb-2 text-[13px] leading-5 font-semibold text-ink-soft";

// ------------------------------------------------------------------ pages --

/** «أكتر الصفحات دلوقتي»: the ten pages opened most (the old screen's "Pages" list). */
export function NowPages({ rows }: { rows: WebAnalyticsMetricRow[] }) {
  const t = useT(STRINGS);
  const span = countOf("minute", REALTIME_WINDOW_MINUTES);
  if (rows.length === 0) return <p className={QUIET}>{fmt(t.pagesEmpty, { window: span })}</p>;
  return (
    <div className="min-w-0">
      <HBarList rows={rows.slice(0, TOP_ROWS).map((row) => ({ label: readablePath(row.x) || "/", value: row.y }))} format={formatCount} />
      <p className={cn(NOTE, "mt-3")}>{fmt(t.pagesNote, { window: span })}</p>
    </div>
  );
}

// ---------------------------------------------------------------- sources --

/** «الزوار جايين منين دلوقتي»: the sites they came from and their countries (the old screen's two lists). */
export function NowSources({ referrers, countries }: { referrers: WebAnalyticsMetricRow[]; countries: WebAnalyticsMetricRow[] }) {
  const t = useT(STRINGS);
  const { intlLocale } = useLocale();
  const span = countOf("minute", REALTIME_WINDOW_MINUTES);
  return (
    <div className="min-w-0">
      <div className="grid min-w-0 gap-x-8 gap-y-5 md:grid-cols-2">
        <section className="min-w-0">
          <h4 className={SUB_HEADING}>{t.referrers}</h4>
          {referrers.length === 0 ? (
            <p className={QUIET}>{fmt(t.referrersEmpty, { window: span })}</p>
          ) : (
            <HBarList rows={referrers.slice(0, TOP_ROWS).map((row) => ({ label: row.x || t.direct, value: row.y }))} format={formatCount} />
          )}
        </section>
        <section className="min-w-0">
          <h4 className={SUB_HEADING}>{t.countries}</h4>
          {countries.length === 0 ? (
            <p className={QUIET}>{t.countriesEmpty}</p>
          ) : (
            <HBarList
              rows={countries.slice(0, TOP_ROWS).map((row) => ({
                label: `${flagOf(row.x)} ${countryName(row.x, intlLocale)}`.trim(),
                value: row.y,
              }))}
              format={formatCount}
            />
          )}
        </section>
      </div>
      <p className={cn(NOTE, "mt-4")}>{fmt(t.sourcesNote, { window: span })}</p>
    </div>
  );
}

// -------------------------------------------------------------------- log --

type LogKind = "all" | "pageview" | "event";

function Total({ icon: TotalIcon, label, value }: { icon: IconComponent; label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-2xl px-3 py-2.5 ring-1 ring-line ring-inset">
      <TotalIcon weight="duotone" className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <dt className="truncate text-xs leading-4 text-ink-soft">{label}</dt>
        <dd className="text-base leading-6 font-semibold text-ink tabular-nums">
          <bdi dir="ltr">{value}</bdi>
        </dd>
      </div>
    </div>
  );
}

/**
 * «سجل النشاط»: the totals of the last 30 minutes (views, visitors, events,
 * countries) and the log itself — what each visitor just opened or did — with
 * the old screen's type filter and search.
 */
export function NowActivityLog({ realtime }: { realtime: WebAnalyticsRealtime }) {
  const t = useT(STRINGS);
  const { intlLocale } = useLocale();
  const { ago } = useAgo();
  const [kind, setKind] = useState<LogKind>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const needle = query.trim().toLowerCase();
  const matching = realtime.activity.filter(
    (entry) =>
      (kind === "all" || entry.type === kind) &&
      (!needle ||
        [entry.urlPath ? readablePath(entry.urlPath) : null, entry.urlPath, entry.eventName, entry.referrerDomain, entry.browser, entry.country].some(
          (value) => value?.toLowerCase().includes(needle)
        ))
  );
  const shown = expanded ? matching : matching.slice(0, LOG_ROWS);
  const subject = (entry: WebAnalyticsRealtimeActivity) =>
    entry.type === "event" ? (entry.eventName ?? "—") : readablePath(entry.urlPath ?? "/");

  return (
    <div className="min-w-0">
      <p className={SUB_HEADING}>{fmt(t.totals, { window: countOf("minute", REALTIME_WINDOW_MINUTES) })}</p>
      <dl className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-4">
        <Total icon={IconEye} label={t.views} value={formatCount(realtime.totals.views)} />
        <Total icon={IconPeople} label={t.visitors} value={formatCount(realtime.totals.visitors)} />
        <Total icon={IconClick} label={t.events} value={formatCount(realtime.totals.events)} />
        <Total icon={IconGlobe} label={t.countriesCount} value={formatCount(realtime.totals.countries)} />
      </dl>

      <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
        <Segmented<LogKind>
          label={t.filter}
          size="sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: t.all },
            { value: "pageview", label: t.onlyViews },
            { value: "event", label: t.onlyEvents },
          ]}
          className="w-full sm:w-auto"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t.search}
          placeholder={t.searchPlaceholder}
          className="h-11 min-w-0 flex-[1_1_12rem] sm:h-9 sm:max-w-xs pointer-coarse:h-11"
        />
      </div>

      {matching.length === 0 ? (
        <p className={cn(QUIET, "py-6 text-center")}>{realtime.activity.length === 0 ? t.logEmpty : t.logNoMatch}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {shown.map((entry, index) => (
            <li key={`${entry.sessionId}-${entry.createdAt}-${index}`} className="flex min-h-11 min-w-0 items-center gap-3 py-2 text-sm">
              <span
                aria-hidden
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg",
                  entry.type === "event" ? "bg-accent-soft text-accent-dark" : "bg-primary-soft text-primary"
                )}
              >
                {entry.type === "event" ? <IconClick className="size-4" /> : <IconEye className="size-4" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink">
                {entry.type === "event" ? t.did : t.opened}{" "}
                <bdi dir="ltr" className="font-medium">
                  {subject(entry)}
                </bdi>
              </span>
              <span className="hidden shrink-0 text-xs text-ink-soft md:inline" dir="ltr">
                {[entry.browser, entry.os, entry.device].filter(Boolean).join(" · ")}
              </span>
              {entry.country && (
                <span className="shrink-0 text-sm" role="img" aria-label={countryName(entry.country, intlLocale)} title={countryName(entry.country, intlLocale)}>
                  {flagOf(entry.country)}
                </span>
              )}
              <span className="shrink-0 text-xs text-ink-soft tabular-nums">{ago(entry.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}

      {matching.length > LOG_ROWS && (
        <div className="mt-1 flex justify-center border-t border-line pt-1.5">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-primary transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {expanded ? t.showLess : fmt(t.showAll, { n: matching.length })}
            <IconCaretDown
              weight="bold"
              className={cn(
                "size-3.5 shrink-0 transition-transform duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                expanded && "rotate-180"
              )}
              aria-hidden
            />
          </button>
        </div>
      )}
    </div>
  );
}
