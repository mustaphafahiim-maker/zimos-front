import { useEffect, useMemo, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { IconExpand, IconGlobe, IconOffline } from "@/components/icons";
import { Button, Card, Spinner } from "@store-builder/ui";
import { LIVE_MAP_WINDOWS, liveMapGet, type LiveMapCounts, type LiveMapPlace } from "@store-builder/api-client";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { Section } from "@/components/Section";
import { apiClient } from "@/lib/apiClient";
import { formatCount } from "@/lib/analytics";
import { isPermissionError } from "@/lib/errors";
import { useAsync } from "@/lib/useAsync";
import { countryName, flagOf } from "@/lib/webAnalytics";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { LiveFunnelSelect } from "../LiveView";
import { mapPlace } from "./places";
import { INSET_ZOOMS, InsetMap, KINDS, KindIcon, WorldMap, activityOf, topKind, type InsetMark, type InsetZoom, type Kind, type WorldMark } from "./LiveMapSvg";

const STRINGS = {
  en: {
    window: "Time window",
    minutes: "{n} min",
    lastN: "Last {n} minutes",
    every: "Updates every {s} seconds while this page is open · {time}",
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
    unknown: "Unknown location",
    showAll: "Show all ({n})",
    showFewer: "Show fewer",
    map: "Map",
    legend: "What the marks mean",
    size: "Bigger mark = more people",
    worldLabel: "World map of the last {n} minutes: activity in {count} countries. The same numbers are in the Countries list.",
    inset: "Egypt and Saudi Arabia",
    zoomLabel: "Zoom the map",
    zoom_both: "Both",
    zoom_eg: "Egypt",
    zoom_delta: "Cairo & Delta",
    zoom_sa: "Saudi Arabia",
    insetLabel: "Map of Egypt and Saudi Arabia: activity in {count} governorates and regions. The same numbers are in the Top places list.",
    approx: "One approximate point per governorate or region.",
    emptyTitle: "Nobody on the store in the last {n} minutes",
    emptyBody: "The map lights up as soon as someone opens your store. Share your store link, or check that your ads are running.",
    widen: "Show the last {n} minutes",
    webAnalytics: "See earlier visits in Web analytics",
    refreshFailed: "We couldn't refresh. These are the last numbers we got.",
    retry: "Try again",
    fullscreen: "Full screen",
  },
  ar: {
    window: "الفترة",
    minutes: "{n} دقيقة",
    lastN: "آخر {n} دقيقة",
    every: "بيتحدّث كل {s} ثانية طول ما الصفحة مفتوحة · {time}",
    visitors: "زوار دلوقتي",
    checkouts: "بيكملوا الأوردر",
    orders: "أوردرات",
    colVisitors: "زوار",
    colCheckouts: "بيكملوا الأوردر",
    colOrders: "أوردرات",
    place: "المكان",
    country: "الدولة",
    topPlaces: "أكتر الأماكن",
    topPlacesHint: "المحافظات والمناطق والمدن، الأكتر حركة الأول.",
    noPlaces: "لسه مفيش محافظة أو مدينة للزوار دول.",
    countries: "الدول",
    unknown: "مكان غير معروف",
    showAll: "اعرض الكل ({n})",
    showFewer: "اعرض أقل",
    map: "الخريطة",
    legend: "معنى العلامات",
    size: "العلامة الأكبر = ناس أكتر",
    worldLabel: "خريطة العالم لآخر {n} دقيقة: فيه حركة في {count} دولة. نفس الأرقام موجودة في قايمة الدول.",
    inset: "مصر والسعودية",
    zoomLabel: "تكبير الخريطة",
    zoom_both: "الاتنين",
    zoom_eg: "مصر",
    zoom_delta: "القاهرة والدلتا",
    zoom_sa: "السعودية",
    insetLabel: "خريطة مصر والسعودية: فيه حركة في {count} محافظة ومنطقة. نفس الأرقام موجودة في قايمة أكتر الأماكن.",
    approx: "كل محافظة أو منطقة نقطة واحدة تقريبية.",
    emptyTitle: "مفيش حد في المتجر آخر {n} دقيقة",
    emptyBody: "الخريطة هتنوّر أول ما حد يفتح متجرك. شارك لينك المتجر، أو اتأكد إن إعلاناتك شغالة.",
    widen: "اعرض آخر {n} دقيقة",
    webAnalytics: "شوف الزيارات اللي قبل كده في زيارات الموقع",
    refreshFailed: "معرفناش نحدّث الأرقام. دي آخر أرقام وصلتنا.",
    retry: "جرّب تاني",
    fullscreen: "ملء الشاشة",
  },
} satisfies Messages;

const POLL_MS = 15_000;
const LIST_LIMIT = 8;
type WindowValue = `${(typeof LIVE_MAP_WINDOWS)[number]}`;

/**
 * Re-runs `refresh` every 15 seconds while the browser tab is visible, and
 * once on coming back to it when the numbers are older than that.
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
  /** A flag before the name (the countries list). */
  flag: string;
  /** The country line under a place's name. */
  where: { flag: string; label: string } | null;
}

/**
 * Analytics → Live now → Live view: who is on the store, checking out and
 * ordering in the last few minutes, on a world map with an Egypt / Saudi inset
 * (handoff 171, GET /analytics/web/live-map). On a phone the totals and the
 * top places come first, the map below them.
 */
export function LiveMapView({
  workspaceId,
  funnelId,
  onFunnelChange,
  fullscreenTarget,
}: {
  workspaceId: string;
  funnelId: string;
  onFunnelChange: (funnelId: string) => void;
  fullscreenTarget: RefObject<HTMLElement | null>;
}) {
  const t = useT(STRINGS);
  const { locale, intlLocale } = useLocale();
  const [minutes, setMinutes] = useState<number>(10);
  const [zoomChoice, setZoomChoice] = useState<InsetZoom | null>(null);
  const [allPlaces, setAllPlaces] = useState(false);
  const [allCountries, setAllCountries] = useState(false);

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
      (d?.places ?? []).map((p: LiveMapPlace, i) => {
        const known = mapPlace(p.code);
        const raw = [p.city, p.region].filter(Boolean).join(locale === "ar" ? "، " : ", ");
        return {
          key: `${p.country}|${p.code ?? raw}|${i}`,
          name: known ? known[locale] : raw || t.unknown,
          flag: "",
          where: { flag: flag(p.country), label: countryLabel(p.country) },
          visitors: p.visitors,
          checkouts: p.checkouts,
          orders: p.orders,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, locale, intlLocale]
  );

  const countryRows = useMemo<PlaceRow[]>(
    () =>
      (d?.countries ?? []).map((c) => ({
        key: c.country,
        name: countryLabel(c.country),
        flag: flag(c.country),
        where: null,
        visitors: c.visitors,
        checkouts: c.checkouts,
        orders: c.orders,
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
    for (const p of d?.places ?? []) {
      const known = mapPlace(p.code);
      if (!known) continue;
      const mark = byCode.get(known.code) ?? {
        code: known.code,
        name: known[locale],
        subtitle: countryLabel(known.country),
        visitors: 0,
        checkouts: 0,
        orders: 0,
      };
      mark.visitors += p.visitors;
      mark.checkouts += p.checkouts;
      mark.orders += p.orders;
      byCode.set(known.code, mark);
    }
    return [...byCode.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, locale, intlLocale]);

  const hasEg = insetMarks.some((m) => mapPlace(m.code)?.country === "EG");
  const hasSa = insetMarks.some((m) => mapPlace(m.code)?.country === "SA");
  const zoom: InsetZoom = zoomChoice ?? (hasEg && !hasSa ? "eg" : hasSa && !hasEg ? "sa" : "both");

  const permissionLost = q.error && isPermissionError(q.error);
  const blockingError = q.error && (!d || permissionLost) ? q.error : null;
  const empty = !!d && activityOf(d.totals) === 0 && d.countries.length === 0;
  const shownMinutes = d?.minutes ?? minutes;

  const fullscreen = () => {
    const el = fullscreenTarget.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  const countColumns = (KINDS as Kind[]).map(
    (kind): Column<PlaceRow> => ({
      key: kind,
      align: "end",
      header: (
        // The shape above the word keeps three count columns narrow enough for the side column and a phone.
        <span className="inline-flex flex-col items-end gap-0.5 text-[11px] leading-tight">
          <KindIcon kind={kind} />
          {labels[kind]}
        </span>
      ),
      headerClassName: "w-px align-bottom px-2",
      className: "w-px whitespace-nowrap px-2",
      cell: (row) => (
        <bdi dir="ltr" className={row[kind] ? "tabular-nums font-medium text-ink" : "tabular-nums text-ink-soft"}>
          {formatCount(row[kind])}
        </bdi>
      ),
    })
  );
  const nameColumn = (header: string): Column<PlaceRow> => ({
    key: "name",
    header,
    headerClassName: "align-bottom",
    className: "w-full",
    cell: (row) => (
      <span className="flex min-w-0 items-start gap-2">
        <KindIcon kind={topKind(row)} className="mt-1" />
        <span className="min-w-0">
          <span className="block break-words font-medium text-ink">
            {row.flag && (
              <span aria-hidden className="me-1">
                {row.flag}
              </span>
            )}
            <span dir="auto">{row.name}</span>
          </span>
          {row.where && (
            <span className="block break-words text-xs text-ink-soft">
              {row.where.flag && (
                <span aria-hidden className="me-1">
                  {row.where.flag}
                </span>
              )}
              {row.where.label}
            </span>
          )}
        </span>
      </span>
    ),
  });

  const toggle = (all: boolean, total: number, set: (v: boolean) => void) =>
    total > LIST_LIMIT ? (
      <Button variant="ghost" size="sm" className="mt-2 min-h-11 w-full sm:min-h-9" onClick={() => set(!all)}>
        {all ? t.showFewer : fmt(t.showAll, { n: formatCount(total) })}
      </Button>
    ) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterTabs<WindowValue>
          label={t.window}
          value={String(minutes) as WindowValue}
          onChange={(v) => setMinutes(Number(v))}
          tabs={LIVE_MAP_WINDOWS.map((n) => ({ value: `${n}` as WindowValue, label: fmt(t.minutes, { n: formatCount(n) }) }))}
          className="flex w-full flex-nowrap sm:inline-flex sm:w-auto"
          buttonClassName="min-h-11 flex-1 sm:min-h-0 sm:flex-none"
        />
        <LiveFunnelSelect
          workspaceId={workspaceId}
          value={funnelId}
          onChange={onFunnelChange}
          className="h-11 w-full max-w-none sm:h-9 sm:w-auto sm:max-w-[14rem]"
        />
        <Button variant="outline" size="sm" className="ms-auto hidden sm:inline-flex" onClick={fullscreen}>
          <IconExpand className="size-4" aria-hidden />
          {t.fullscreen}
        </Button>
      </div>

      <DataState loading={q.loading && !d} error={blockingError} onRetry={() => void q.refresh()}>
        {d &&
          (empty ? (
            <EmptyState
              icon={<IconGlobe />}
              title={fmt(t.emptyTitle, { n: formatCount(shownMinutes) })}
              description={t.emptyBody}
              action={
                shownMinutes < 60 ? (
                  <Button variant="outline" className="min-h-11" onClick={() => setMinutes(60)}>
                    {fmt(t.widen, { n: formatCount(60) })}
                  </Button>
                ) : (
                  <Link to="/analytics/web" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
                    {t.webAnalytics}
                  </Link>
                )
              }
            />
          ) : (
            <div className="space-y-4">
              <section aria-labelledby="live-map-totals" className="space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 id="live-map-totals" className="text-[15px] font-medium text-ink">
                    {fmt(t.lastN, { n: formatCount(shownMinutes) })}
                  </h2>
                  {q.loading && <Spinner className="size-3.5 text-ink-soft" aria-hidden />}
                  <p className="text-xs text-ink-soft">
                    {fmt(t.every, {
                      s: formatCount(POLL_MS / 1000),
                      time: updatedAt
                        ? new Intl.DateTimeFormat(intlLocale, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(updatedAt)
                        : "—",
                    })}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {KINDS.map((kind) => (
                    <Card key={kind} className="min-w-0 gap-0 p-3 sm:p-4">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                        <KindIcon kind={kind} />
                        <span className="min-w-0">{{ visitors: t.visitors, checkouts: t.checkouts, orders: t.orders }[kind]}</span>
                      </p>
                      <p className="tabular-nums mt-1 text-2xl font-semibold text-ink sm:text-3xl">
                        <bdi dir="ltr">{formatCount(d.totals[kind])}</bdi>
                      </p>
                    </Card>
                  ))}
                </div>
              </section>

              {!!q.error && !blockingError && (
                <p role="status" className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] bg-paper-raised px-3 py-2 text-sm text-ink-soft ring-1 ring-line">
                  <IconOffline className="size-4 shrink-0 text-danger" aria-hidden />
                  <span className="min-w-0 flex-1">{t.refreshFailed}</span>
                  <Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" onClick={() => void q.refresh({ silent: true })}>
                    {t.retry}
                  </Button>
                </p>
              )}

              {/* Phone: totals, top places, the map, then countries. Wide: the map on the start side, the lists beside it. */}
              <div className="grid gap-4 xl:grid-cols-3 xl:grid-rows-[auto_1fr]">
                <Section title={t.topPlaces} description={t.topPlacesHint} flush className="xl:col-start-3 xl:row-start-1 xl:self-start">
                  <div className="px-1 pb-2">
                    <DataTable
                      columns={[nameColumn(t.place), ...countColumns]}
                      rows={allPlaces ? placeRows : placeRows.slice(0, LIST_LIMIT)}
                      rowKey={(r) => r.key}
                      phoneCards={false}
                      minWidth="0"
                      empty={<p className="px-3 py-4 text-sm text-ink-soft">{t.noPlaces}</p>}
                    />
                    <div className="px-3">{toggle(allPlaces, placeRows.length, setAllPlaces)}</div>
                  </div>
                </Section>

                <Section
                  title={t.map}
                  className="xl:col-span-2 xl:col-start-1 xl:row-span-2 xl:row-start-1 xl:self-start"
                  actions={
                    <ul aria-label={t.legend} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                      {KINDS.map((kind) => (
                        <li key={kind} className="inline-flex items-center gap-1.5">
                          <KindIcon kind={kind} />
                          {labels[kind]}
                        </li>
                      ))}
                    </ul>
                  }
                >
                  <WorldMap
                    countries={worldMarks}
                    labels={labels}
                    showInsetFrame={insetMarks.length > 0}
                    label={fmt(t.worldLabel, { n: formatCount(shownMinutes), count: formatCount(worldMarks.length) })}
                  />
                  <p className="mt-2 text-xs text-ink-soft">{t.size}</p>

                  {insetMarks.length > 0 && (
                    <div className="mt-4 border-t border-line pt-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-ink">{t.inset}</h3>
                        <FilterTabs<InsetZoom>
                          label={t.zoomLabel}
                          value={zoom}
                          onChange={setZoomChoice}
                          tabs={INSET_ZOOMS.map((z) => ({ value: z, label: t[`zoom_${z}`] }))}
                          className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto"
                          buttonClassName="min-h-11 sm:min-h-0"
                        />
                      </div>
                      <InsetMap
                        places={insetMarks}
                        zoom={zoom}
                        labels={labels}
                        label={fmt(t.insetLabel, { count: formatCount(insetMarks.length) })}
                      />
                      <p className="mt-2 text-xs text-ink-soft">{t.approx}</p>
                    </div>
                  )}
                </Section>

                <Section title={t.countries} flush className="xl:col-start-3 xl:row-start-2 xl:self-start">
                  <div className="px-1 pb-2">
                    <DataTable
                      columns={[nameColumn(t.country), ...countColumns]}
                      rows={allCountries ? countryRows : countryRows.slice(0, LIST_LIMIT)}
                      rowKey={(r) => r.key}
                      phoneCards={false}
                      minWidth="0"
                    />
                    <div className="px-3">{toggle(allCountries, countryRows.length, setAllCountries)}</div>
                  </div>
                </Section>
              </div>
            </div>
          ))}
      </DataState>
    </div>
  );
}
