import { useEffect, useMemo, useState } from "react";
import { LIVE_MAP_WINDOWS, liveMapGet, type LiveMapCounts, type LiveMapPlace } from "@store-builder/api-client";
import { Button, Spinner, cn } from "@store-builder/ui";
import { SkeletonBar } from "@/components/DataState";
import { FilterTabs } from "@/components/FilterTabs";
import { Segmented } from "@/components/Segmented";
import { ViewLink } from "@/components/ViewLink";
import { IconGlobe, IconLock, IconOffline, IconRefresh, IconWarning } from "@/components/icons";
import { ReportTable, type ReportColumn } from "@/components/report";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { countOf } from "@/lib/plural";
import { useAsync } from "@/lib/useAsync";
import { countryName, flagOf } from "@/lib/webAnalytics";
import {
  INSET_ZOOMS,
  InsetMap,
  KINDS,
  KindIcon,
  WorldMap,
  activityOf,
  topKind,
  type InsetMark,
  type InsetZoom,
  type Kind,
  type WorldMark,
} from "@/pages/analytics/liveMap/LiveMapSvg";
import { mapPlace } from "@/pages/analytics/liveMap/places";
import { REPORT_TAB_PATHS } from "../../reportTabs";
import { useAgo } from "./ago";

const STRINGS = {
  en: {
    window: "Time window",
    minutesShort: "{n} min",
    lastN: "The last {window}",
    every: "Updates every {every} while this page is open · {time}",
    visitors: "Visitors now",
    checkouts: "Checking out",
    orders: "Orders",
    colVisitors: "Visitors",
    colCheckouts: "Checking out",
    colOrders: "Orders",
    place: "Place",
    country: "Country",
    topPlaces: "Top places",
    topPlacesHint: "Governorates, regions and cities, busiest first.",
    noPlaces: "No governorate or city for these visitors yet.",
    countries: "Countries",
    countriesHint: "Every country with activity in this window.",
    unknown: "Unknown location",
    map: "Map",
    legend: "What the marks mean",
    size: "Bigger mark = more people",
    worldLabel: "World map of the last {window}: activity in {count} countries. The same numbers are in the Countries table.",
    inset: "Egypt and Saudi Arabia",
    zoomLabel: "Zoom the map",
    zoom_both: "Both",
    zoom_eg: "Egypt",
    zoom_delta: "Cairo & Delta",
    zoom_sa: "Saudi Arabia",
    insetLabel: "Map of Egypt and Saudi Arabia: activity in {count} governorates and regions. The same numbers are in the Top places table.",
    approx: "One approximate point per governorate or region.",
    emptyTitle: "Nobody on the store in the last {window}",
    emptyBody: "The map lights up as soon as someone opens your store. Share your store link, or check that your ads are running.",
    widen: "Show the last {window}",
    storeTab: "See earlier visits in the Store tab",
    refreshFailed: "We couldn't refresh. These are the last numbers we got.",
    retry: "Try again",
    loading: "Loading the map…",
    denied: "The live map isn't part of your role.",
  },
  ar: {
    window: "المدة",
    minutesShort: "{n} د",
    lastN: "آخر {window}",
    every: "بيتحدّث كل {every} طول ما الصفحة مفتوحة · {time}",
    visitors: "زوار دلوقتي",
    checkouts: "بيكمّلوا الأوردر",
    orders: "أوردرات",
    colVisitors: "زوار",
    colCheckouts: "بيكمّلوا الأوردر",
    colOrders: "أوردرات",
    place: "المكان",
    country: "الدولة",
    topPlaces: "أكتر الأماكن",
    topPlacesHint: "المحافظات والمناطق والمدن، الأكتر حركة الأول.",
    noPlaces: "لسه مفيش محافظة أو مدينة للزوار دول.",
    countries: "الدول",
    countriesHint: "كل دولة فيها حركة في المدة دي.",
    unknown: "مكان مش معروف",
    map: "الخريطة",
    legend: "معنى العلامات",
    size: "العلامة الأكبر = ناس أكتر",
    worldLabel: "خريطة العالم لآخر {window}: فيه حركة في {count} دولة. نفس الأرقام موجودة في جدول الدول.",
    inset: "مصر والسعودية",
    zoomLabel: "تكبير الخريطة",
    zoom_both: "الاتنين",
    zoom_eg: "مصر",
    zoom_delta: "القاهرة والدلتا",
    zoom_sa: "السعودية",
    insetLabel: "خريطة مصر والسعودية: فيه حركة في {count} محافظة ومنطقة. نفس الأرقام موجودة في جدول أكتر الأماكن.",
    approx: "كل محافظة أو منطقة نقطة واحدة تقريبية.",
    emptyTitle: "مفيش حد في المتجر في آخر {window}",
    emptyBody: "الخريطة هتنوّر أول ما حد يفتح متجرك. شارك لينك المتجر، أو اتأكد إن إعلاناتك شغّالة.",
    widen: "اعرض آخر {window}",
    storeTab: "شوف الزيارات اللي قبل كده في تبويب المتجر",
    refreshFailed: "معرفناش نحدّث الأرقام. دي آخر أرقام وصلتنا.",
    retry: "جرّب تاني",
    loading: "بنحمّل الخريطة…",
    denied: "الخريطة المباشرة مش ضمن صلاحياتك.",
  },
} satisfies Messages;

const POLL_MS = 15_000;
/** Rows of a table before «اعرض الكل», as the old lists. */
const LIST_LIMIT = 8;
/** The widest window the API offers: what the empty state proposes. */
const WIDEST_MINUTES = 60;
type WindowValue = `${(typeof LIVE_MAP_WINDOWS)[number]}`;

/**
 * Re-runs `refresh` every 15 seconds while the browser tab is visible, and
 * once on coming back to it when the numbers are older than that (moved as it
 * was from pages/analytics/liveMap/LiveMapView.tsx).
 */
function usePolling(refresh: () => void, deps: unknown[]) {
  useEffect(() => {
    let last = Date.now();
    const run = () => {
      last = Date.now();
      refresh();
    };
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - last >= POLL_MS) run();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

interface PlaceRow extends LiveMapCounts {
  key: string;
  name: string;
  /** The country of a place, or of the row itself in the countries table. */
  flag: string;
  countryLabel: string;
}

const SUB_HEADING = "text-[15px] leading-6 font-semibold text-ink";
const NOTE = "text-[13px] leading-5 text-pretty text-ink-soft";

/** The visible heading of a table that sits inside the section (the table keeps its own title for screen readers only). */
function TableHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <>
      <span className={cn("block", SUB_HEADING)}>{title}</span>
      <span className="block">{hint}</span>
    </>
  );
}

/**
 * «الخريطة المباشرة» inside «تفاصيل أكتر» of the "now" tab: who is on the
 * store, checking out and ordering in the last few minutes — the totals, a
 * world map with an Egypt / Saudi inset, and the same numbers as two sortable
 * tables (places, countries). The old realtime screen's "Live view" tab,
 * re-laid for a section: its request, its 15-second refresh while the browser
 * tab is visible, its window switch, its soft "couldn't refresh" notice and
 * its empty state are kept; the store / funnel filter is the tab's own.
 *
 * It is this file that pulls the map's geometry in, so the tab loads it lazily
 * — only when the section is opened (or the page is opened with `?view=map`).
 */
export default function NowMap({ workspaceId, funnelId }: { workspaceId: string; funnelId: string }) {
  const t = useT(STRINGS);
  const { locale, intlLocale } = useLocale();
  const errorMessage = useErrorMessage();
  const { seconds } = useAgo();
  const [minutes, setMinutes] = useState<number>(10);
  const [zoomChoice, setZoomChoice] = useState<InsetZoom | null>(null);

  const q = useAsync(
    () => liveMapGet(apiClient, workspaceId, { minutes, funnelId: funnelId || undefined }),
    [workspaceId, minutes, funnelId]
  );
  usePolling(() => void q.refresh({ silent: true }), [q.refresh, workspaceId, minutes, funnelId]);

  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (q.data) setUpdatedAt(new Date());
  }, [q.data]);

  const d = q.data;
  const labels: Record<Kind, string> = { visitors: t.colVisitors, checkouts: t.colCheckouts, orders: t.colOrders };
  const countryLabel = (code: string) => (code === "ZZ" ? t.unknown : countryName(code, intlLocale));
  const flag = (code: string) => (code === "ZZ" ? "" : flagOf(code));

  const placeRows = useMemo<PlaceRow[]>(
    () =>
      (d?.places ?? []).map((place: LiveMapPlace, index) => {
        const known = mapPlace(place.code);
        const raw = [place.city, place.region].filter(Boolean).join(locale === "ar" ? "، " : ", ");
        return {
          key: `${place.country}|${place.code ?? raw}|${index}`,
          name: known ? known[locale] : raw || t.unknown,
          flag: flag(place.country),
          countryLabel: countryLabel(place.country),
          visitors: place.visitors,
          checkouts: place.checkouts,
          orders: place.orders,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, locale, intlLocale]
  );

  const countryRows = useMemo<PlaceRow[]>(
    () =>
      (d?.countries ?? []).map((country) => ({
        key: country.country,
        name: countryLabel(country.country),
        flag: flag(country.country),
        countryLabel: countryLabel(country.country),
        visitors: country.visitors,
        checkouts: country.checkouts,
        orders: country.orders,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, intlLocale]
  );

  const worldMarks = useMemo<WorldMark[]>(
    () => (d?.countries ?? []).filter((c) => c.country !== "ZZ").map((c) => ({ ...c, name: countryLabel(c.country) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, intlLocale]
  );

  // Coded places of Egypt and Saudi Arabia, one per governorate / region (a city code folds into its governorate).
  const insetMarks = useMemo<InsetMark[]>(() => {
    const byCode = new Map<string, InsetMark>();
    for (const place of d?.places ?? []) {
      const known = mapPlace(place.code);
      if (!known) continue;
      const mark = byCode.get(known.code) ?? {
        code: known.code,
        name: known[locale],
        subtitle: countryLabel(known.country),
        visitors: 0,
        checkouts: 0,
        orders: 0,
      };
      mark.visitors += place.visitors;
      mark.checkouts += place.checkouts;
      mark.orders += place.orders;
      byCode.set(known.code, mark);
    }
    return [...byCode.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, locale, intlLocale]);

  const hasEg = insetMarks.some((mark) => mapPlace(mark.code)?.country === "EG");
  const hasSa = insetMarks.some((mark) => mapPlace(mark.code)?.country === "SA");
  const zoom: InsetZoom = zoomChoice ?? (hasEg && !hasSa ? "eg" : hasSa && !hasEg ? "sa" : "both");

  const denied = Boolean(q.error) && isPermissionError(q.error);
  const blockingError = q.error && (!d || denied) ? q.error : null;
  const empty = !!d && activityOf(d.totals) === 0 && d.countries.length === 0;
  const shownMinutes = d?.minutes ?? minutes;
  const shownWindow = countOf("minute", shownMinutes);

  const countColumns = KINDS.map(
    (kind): ReportColumn<PlaceRow> => ({
      key: kind,
      header: labels[kind],
      align: "end",
      cell: (row) => formatCount(row[kind]),
      sortValue: (row) => row[kind],
      csv: (row) => row[kind],
    })
  );
  const placeColumns: ReportColumn<PlaceRow>[] = [
    {
      key: "name",
      header: t.place,
      cell: (row) => (
        <span className="inline-flex max-w-full min-w-0 items-center gap-2 align-middle">
          <KindIcon kind={topKind(row)} />
          <span className="min-w-0 truncate" dir="auto">
            {row.name}
          </span>
        </span>
      ),
      sortValue: (row) => row.name,
      csv: (row) => row.name,
    },
    {
      key: "country",
      header: t.country,
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5">
          {row.flag && <span aria-hidden>{row.flag}</span>}
          {row.countryLabel}
        </span>
      ),
      sortValue: (row) => row.countryLabel,
      csv: (row) => row.countryLabel,
    },
    ...countColumns,
  ];
  const countryColumns: ReportColumn<PlaceRow>[] = [
    {
      key: "name",
      header: t.country,
      cell: (row) => (
        <span className="inline-flex max-w-full min-w-0 items-center gap-2 align-middle">
          <KindIcon kind={topKind(row)} />
          {row.flag && <span aria-hidden>{row.flag}</span>}
          <span className="min-w-0 truncate">{row.name}</span>
        </span>
      ),
      sortValue: (row) => row.name,
      csv: (row) => row.name,
    },
    ...countColumns,
  ];

  const windowSwitch = (
    <Segmented<WindowValue>
      label={t.window}
      size="sm"
      value={String(minutes) as WindowValue}
      onChange={(value) => setMinutes(Number(value))}
      options={LIVE_MAP_WINDOWS.map((n) => ({ value: `${n}` as WindowValue, label: fmt(t.minutesShort, { n }) }))}
      className="w-full sm:w-auto"
    />
  );

  if (q.loading && !d) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="min-w-0">
        <span className="sr-only">{t.loading}</span>
        <div aria-hidden className="space-y-3">
          <SkeletonBar className="h-9 w-full rounded-full sm:w-72" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((index) => (
              <div key={index} className="rounded-2xl p-3 ring-1 ring-line ring-inset">
                <SkeletonBar className="h-2.5 w-2/3" />
                <SkeletonBar className="mt-3 h-5 w-1/2" />
              </div>
            ))}
          </div>
          <SkeletonBar className="h-48 w-full rounded-2xl sm:h-72" />
        </div>
      </div>
    );
  }

  if (blockingError) {
    // A 403: this part is not for this role — said in one quiet line, nothing to retry.
    if (denied) {
      return (
        <p className="flex items-center gap-2 text-sm leading-6 text-ink-soft">
          <IconLock className="size-4 shrink-0" aria-hidden />
          {t.denied}
        </p>
      );
    }
    return (
      <div role="alert" className="flex min-w-0 flex-wrap items-center gap-2 text-sm leading-6 text-ink-soft">
        <IconWarning className="size-4 shrink-0 text-danger" aria-hidden />
        <span className="min-w-0 flex-1">{errorMessage(blockingError)}</span>
        <Button variant="outline" size="sm" className="h-11 rounded-full px-4" onClick={() => void q.refresh()}>
          <IconRefresh weight="bold" className="size-4" aria-hidden />
          {t.retry}
        </Button>
      </div>
    );
  }

  if (!d) return null;

  if (empty) {
    return (
      <div className="min-w-0">
        {windowSwitch}
        <div className="flex flex-col items-center px-2 py-8 text-center">
          <IconGlobe weight="duotone" className="mb-3 size-10 text-primary" aria-hidden />
          <p className={SUB_HEADING}>{fmt(t.emptyTitle, { window: shownWindow })}</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-pretty text-ink-soft">{t.emptyBody}</p>
          <div className="mt-4">
            {shownMinutes < WIDEST_MINUTES ? (
              <Button variant="outline" className="h-11 rounded-full px-5" onClick={() => setMinutes(WIDEST_MINUTES)}>
                {fmt(t.widen, { window: countOf("minute", WIDEST_MINUTES) })}
              </Button>
            ) : (
              <ViewLink
                to={REPORT_TAB_PATHS.store}
                className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {t.storeTab}
              </ViewLink>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {windowSwitch}

      <section aria-labelledby="now-map-totals" className="mt-4 min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h4 id="now-map-totals" className={SUB_HEADING}>
            {fmt(t.lastN, { window: shownWindow })}
          </h4>
          {q.loading && <Spinner className="size-3.5 text-ink-soft" aria-hidden />}
          <p className={NOTE}>
            {fmt(t.every, {
              every: seconds(POLL_MS / 1000),
              time: updatedAt
                ? new Intl.DateTimeFormat(intlLocale, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(updatedAt)
                : "—",
            })}
          </p>
        </div>
        <dl className="mt-2 grid min-w-0 grid-cols-3 gap-2">
          {KINDS.map((kind) => (
            <div key={kind} className="min-w-0 rounded-2xl p-3 ring-1 ring-line ring-inset">
              <dt className="flex items-center gap-1.5 text-xs leading-4 font-medium text-ink-soft">
                <KindIcon kind={kind} />
                <span className="min-w-0">{{ visitors: t.visitors, checkouts: t.checkouts, orders: t.orders }[kind]}</span>
              </dt>
              <dd className="mt-1 text-2xl leading-8 font-semibold text-ink tabular-nums">
                <bdi dir="ltr">{formatCount(d.totals[kind])}</bdi>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {!!q.error && (
        <p role="status" className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 text-sm leading-6 text-ink-soft ring-1 ring-line ring-inset">
          <IconOffline className="size-4 shrink-0 text-danger" aria-hidden />
          <span className="min-w-0 flex-1">{t.refreshFailed}</span>
          <Button variant="outline" size="sm" className="h-11 rounded-full px-4" onClick={() => void q.refresh({ silent: true })}>
            {t.retry}
          </Button>
        </p>
      )}

      <section aria-labelledby="now-map-world" className="mt-5 min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h4 id="now-map-world" className={SUB_HEADING}>
            {t.map}
          </h4>
          <ul aria-label={t.legend} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-ink-soft">
            {KINDS.map((kind) => (
              <li key={kind} className="inline-flex items-center gap-1.5">
                <KindIcon kind={kind} />
                {labels[kind]}
              </li>
            ))}
          </ul>
        </div>
        <WorldMap
          countries={worldMarks}
          labels={labels}
          showInsetFrame={insetMarks.length > 0}
          label={fmt(t.worldLabel, { window: shownWindow, count: worldMarks.length })}
        />
        <p className={cn(NOTE, "mt-2")}>{t.size}</p>
      </section>

      {insetMarks.length > 0 && (
        <section aria-labelledby="now-map-inset" className="mt-5 min-w-0 border-t border-line pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 id="now-map-inset" className={SUB_HEADING}>
              {t.inset}
            </h4>
            <FilterTabs<InsetZoom>
              label={t.zoomLabel}
              value={zoom}
              onChange={setZoomChoice}
              tabs={INSET_ZOOMS.map((choice) => ({ value: choice, label: t[`zoom_${choice}`] }))}
              className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto"
              buttonClassName="min-h-11 sm:min-h-0"
            />
          </div>
          <InsetMap places={insetMarks} zoom={zoom} labels={labels} label={fmt(t.insetLabel, { count: insetMarks.length })} />
          <p className={cn(NOTE, "mt-2")}>{t.approx}</p>
        </section>
      )}

      {/* The same numbers as two tables, edge to edge in the section: side by side from lg, one under the other on a phone. */}
      <div className="-mx-4 mt-5 -mb-4 grid min-w-0 border-t border-line lg:grid-cols-2 [&>*+*]:border-t [&>*+*]:border-line lg:[&>*+*]:border-t-0 lg:[&>*+*]:border-s">
        <ReportTable<PlaceRow>
          embedded
          caption={t.topPlaces}
          note={<TableHeading title={t.topPlaces} hint={t.topPlacesHint} />}
          columns={placeColumns}
          rows={placeRows}
          rowKey={(row) => row.key}
          exportName="zimos-live-places"
          empty={t.noPlaces}
          pageSize={LIST_LIMIT}
        />
        <ReportTable<PlaceRow>
          embedded
          caption={t.countries}
          note={<TableHeading title={t.countries} hint={t.countriesHint} />}
          columns={countryColumns}
          rows={countryRows}
          rowKey={(row) => row.key}
          exportName="zimos-live-countries"
          pageSize={LIST_LIMIT}
        />
      </div>
    </div>
  );
}
