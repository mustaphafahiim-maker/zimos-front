import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Alert, Badge, Button, Segmented, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { DetailRow, Drawer } from "@/components/Drawer";
import { KpiCard } from "@/components/KpiCard";
import { BarChart, ChartAxis, HBarList } from "@/components/charts";
import { NativeSelect, SearchInput } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import { apiClient } from "@/lib/apiClient";
import * as api from "@/lib/storeTrafficApi";
import {
  DEVICES,
  OUTCOME_RANGES,
  TRAFFIC_RANGES,
  VISIT_SORTS,
  type OutcomeRange,
  type TrafficFilters,
  type TrafficRange,
  type VisitSort,
} from "@/lib/storeTrafficApi";
import {
  GOVERNORATE_CODES,
  STORE_TRAFFIC_STRINGS,
  clickIdLine,
  countryName,
  formatDwell,
  formatRatePct,
  governorateName,
  utmLine,
} from "@/lib/storeTrafficStrings";
import { formatChartLabel, formatDateTime, formatMinorMoney, formatNumber, formatRelative } from "@/lib/format";
import { Pager } from "@/pages/BlocklistPage";

type Strings = Record<keyof (typeof STORE_TRAFFIC_STRINGS)["en"], string>;
type Locale = "en" | "ar";
const TABS = ["overview", "visits", "campaigns", "outcomes", "protection"] as const;
type Tab = (typeof TABS)[number];
const PAGE_SIZE = 25;

/**
 * The console's Store traffic (VITE_STORE_TRAFFIC_ENABLED, workspaces.view):
 * every store's visitors — or one store's — from /admin/store-traffic/*.
 * The tab, period, store and filters live in the address, so a view can be
 * shared and survives a reload.
 */
export function StoreTrafficPage() {
  const t = useT(STORE_TRAFFIC_STRINGS);
  const { locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "overview";
  const range = (TRAFFIC_RANGES as string[]).includes(params.get("range") ?? "") ? (params.get("range") as TrafficRange) : "7d";
  const filters: TrafficFilters = {
    range,
    workspaceId: params.get("workspaceId") || undefined,
    country: params.get("country") || undefined,
    governorate: params.get("governorate") || undefined,
    device: params.get("device") || undefined,
    source: params.get("source") || undefined,
  };
  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any change of what is shown starts the visits list again at its first page.
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };
  const stores = useAsync(() => apiClient.adminListWorkspaces(), []);
  const [visit, setVisit] = useState<{ workspaceId: string; sessionId: string } | null>(null);

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-4 space-y-3">
        <Segmented
          label={t.title}
          value={tab}
          onChange={(v) => set({ tab: v === "overview" ? undefined : v })}
          options={TABS.map((v) => ({ value: v, label: t[`tab${v[0].toUpperCase()}${v.slice(1)}` as keyof Strings] }))}
        />
        <div className="flex flex-wrap items-end gap-2">
          {tab !== "outcomes" && (
            <Segmented
              size="sm"
              label={t.title}
              value={range}
              onChange={(v) => set({ range: v === "7d" ? undefined : v })}
              options={TRAFFIC_RANGES.map((r) => ({ value: r, label: t[`range_${r}`] }))}
            />
          )}
          <NativeSelect aria-label={t.store} value={filters.workspaceId ?? ""} onChange={(e) => set({ workspaceId: e.target.value || undefined })} className="w-48">
            <option value="">{t.allStores}</option>
            {(stores.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
          {tab !== "outcomes" && tab !== "protection" && (
            <VisitFilters t={t} locale={locale} filters={filters} onChange={set} />
          )}
        </div>
      </div>

      {tab === "overview" && <OverviewTab t={t} locale={locale} filters={filters} onFilter={set} />}
      {tab === "visits" && (
        <VisitsTab
          t={t}
          locale={locale}
          filters={filters}
          sort={(VISIT_SORTS as string[]).includes(params.get("sort") ?? "") ? (params.get("sort") as VisitSort) : "recent"}
          page={Math.max(1, Number(params.get("page")) || 1)}
          onSort={(sort) => set({ sort: sort === "recent" ? undefined : sort })}
          onPage={(page) => set({ page: page > 1 ? String(page) : undefined })}
          onOpen={setVisit}
        />
      )}
      {tab === "campaigns" && <CampaignsTab t={t} filters={filters} />}
      {tab === "outcomes" && <OutcomesTab t={t} locale={locale} workspaceId={filters.workspaceId} />}
      {tab === "protection" && <ProtectionTab t={t} locale={locale} range={range} workspaceId={filters.workspaceId} onOpen={setVisit} />}

      <VisitDrawer t={t} locale={locale} visit={visit} onClose={() => setVisit(null)} />
    </div>
  );
}

function VisitFilters({
  t,
  locale,
  filters,
  onChange,
}: {
  t: Strings;
  locale: Locale;
  filters: TrafficFilters;
  onChange: (patch: Record<string, string | undefined>) => void;
}) {
  const [source, setSource] = useState(filters.source ?? "");
  const any = Boolean(filters.country || filters.governorate || filters.device || filters.source);
  return (
    <>
      <NativeSelect aria-label={t.country} value={filters.country ?? ""} onChange={(e) => onChange({ country: e.target.value || undefined })} className="w-36">
        <option value="">{t.anyCountry}</option>
        {["EG", "SA", "AE", "KW", "QA", "JO", "LY", "US", "GB", "DE"].map((c) => (
          <option key={c} value={c}>
            {countryName(c, locale)}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect aria-label={t.governorate} value={filters.governorate ?? ""} onChange={(e) => onChange({ governorate: e.target.value || undefined })} className="w-40">
        <option value="">{t.anyGovernorate}</option>
        {GOVERNORATE_CODES.map((g) => (
          <option key={g} value={g}>
            {governorateName(g, locale)}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect aria-label={t.device} value={filters.device ?? ""} onChange={(e) => onChange({ device: e.target.value || undefined })} className="w-32">
        <option value="">{t.anyDevice}</option>
        {DEVICES.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </NativeSelect>
      <form
        className="w-56"
        onSubmit={(e) => {
          e.preventDefault();
          onChange({ source: source.trim() || undefined });
        }}
      >
        <SearchInput
          value={source}
          onChange={(v) => {
            setSource(v);
            if (!v) onChange({ source: undefined });
          }}
          placeholder={t.sourcePlaceholder}
          aria-label={t.source}
        />
      </form>
      {any && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setSource("");
            onChange({ country: undefined, governorate: undefined, device: undefined, source: undefined });
          }}
        >
          {t.clear}
        </Button>
      )}
    </>
  );
}

function GovernorateCell({ code, geoSource, t, locale }: { code: string | null; geoSource: string | null; t: Strings; locale: Locale }) {
  if (!code) return <span className="text-ink-soft">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {governorateName(code, locale)}
      {geoSource === "ip_approx" && (
        <Badge variant="outline" className="text-[10px]">
          {t.approx}
        </Badge>
      )}
    </span>
  );
}

function OverviewTab({ t, locale, filters, onFilter }: { t: Strings; locale: Locale; filters: TrafficFilters; onFilter: (p: Record<string, string | undefined>) => void }) {
  const { data, loading, error, refresh } = useAsync(
    () => api.getSummary(filters),
    [filters.range, filters.workspaceId, filters.country, filters.governorate, filters.device, filters.source]
  );
  return (
    <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
      {data && (
        <div className="space-y-4">
          {data.overCap && data.overCap.events > 0 && <Alert>{fmt(t.overCap, { count: formatNumber(data.overCap.events) })}</Alert>}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KpiCard label={t.visits} value={formatNumber(data.visits)} />
            <KpiCard label={t.visitors} value={formatNumber(data.visitors)} />
            <KpiCard label={t.pageViews} value={formatNumber(data.pageViews)} />
            <KpiCard label={t.conversion} value={formatRatePct(data.conversionRate)} hint={t.conversionHint} />
            <KpiCard label={t.avgDwell} value={data.pages ? formatDwell(data.pages.avgDwellMs, locale) : "—"} hint={data.pages ? t.avgDwellHint : t.pickStore} />
          </div>
          {data.visits === 0 ? (
            <EmptyBlock message={t.noData} />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Panel title={t.funnel} description={t.funnelHint}>
                  <FunnelList t={t} steps={data.funnel} />
                </Panel>
                <Panel title={t.daily} description={data.timeZone}>
                  <BarChart points={data.daily.map((d) => ({ label: formatChartLabel(d.day), value: d.visits }))} height={140} format={(v) => formatNumber(v)} />
                  <ChartAxis points={data.daily.map((d) => ({ label: formatChartLabel(d.day), value: d.visits }))} />
                </Panel>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Panel title={t.sources}>
                  <ClickableList
                    rows={data.sources.map((s) => ({ key: s.source, label: s.source === "direct" ? t.direct : s.source, value: s.visits, extra: formatRatePct(s.conversionRate) }))}
                    onPick={(source) => onFilter({ source })}
                  />
                </Panel>
                <Panel title={t.governorates} description={t.approxNote}>
                  <ClickableList
                    rows={data.governorates.map((g) => ({
                      key: g.governorate,
                      label: governorateName(g.governorate, locale),
                      value: g.visits,
                      extra: g.approximate > 0 ? `${formatNumber(g.approximate)} ${t.approx}` : t.fromOrder,
                    }))}
                    onPick={(governorate) => onFilter({ governorate })}
                  />
                </Panel>
                <Panel title={t.countries}>
                  <ClickableList
                    rows={data.countries.map((c) => ({ key: c.country ?? "", label: countryName(c.country, locale), value: c.visits }))}
                    onPick={(country) => country && onFilter({ country })}
                  />
                </Panel>
                <Panel title={t.devices}>
                  <HBarList rows={data.devices.map((d) => ({ label: d.device, value: d.visits }))} format={(v) => formatNumber(v)} />
                </Panel>
                <Panel title={t.browsers}>
                  <HBarList rows={data.browsers.map((b) => ({ label: b.browser, value: b.visits }))} format={(v) => formatNumber(v)} color="var(--color-accent)" />
                </Panel>
              </div>
              {data.pages ? (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <Panel title={t.topPages} flush>
                    <SimpleTable
                      heads={[t.path, t.views, t.timeOnPage]}
                      rows={data.pages.topPages.map((p) => [<Mono key="p">{p.path}</Mono>, formatNumber(p.views), formatDwell(p.avgDwellMs, locale)])}
                    />
                  </Panel>
                  <Panel title={t.topProducts} flush>
                    <SimpleTable
                      heads={[t.product, t.views, t.timeOnPage]}
                      rows={data.pages.topProducts.map((p) => [p.name ?? <Mono key="p">{p.productId}</Mono>, formatNumber(p.views), formatDwell(p.avgDwellMs, locale)])}
                    />
                  </Panel>
                </div>
              ) : (
                <Alert>{t.pickStore}</Alert>
              )}
            </>
          )}
        </div>
      )}
    </DataState>
  );
}

function FunnelList({ t, steps }: { t: Strings; steps: api.FunnelStep[] }) {
  const top = Math.max(1, steps[0]?.visitors ?? 1);
  return (
    <ol className="space-y-2">
      {steps.map((s) => (
        <li key={s.key} className="text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-ink">{t[`step_${s.key}` as keyof Strings]}</span>
            <span className="tabular-nums text-ink">
              {formatNumber(s.visitors)}
              {s.dropRate !== null && <span className="ms-2 text-xs text-ink-soft">{fmt(t.dropped, { rate: formatRatePct(s.dropRate) })}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-paper-sunken">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.round((s.visitors / top) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ClickableList({ rows, onPick }: { rows: Array<{ key: string; label: string; value: number; extra?: string }>; onPick: (key: string) => void }) {
  if (rows.length === 0) return <p className="text-sm text-ink-soft">—</p>;
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.key || r.label}>
          <button type="button" onClick={() => onPick(r.key)} className="w-full cursor-pointer rounded-md px-1 py-0.5 text-start text-sm hover:bg-paper-sunken">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-ink">{r.label}</span>
              <span className="shrink-0 tabular-nums text-ink">
                {formatNumber(r.value)}
                {r.extra && <span className="ms-2 text-xs text-ink-soft">{r.extra}</span>}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-paper-sunken">
              <div className="h-1.5 rounded-full bg-primary/70" style={{ width: `${Math.round((r.value / top) * 100)}%` }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SimpleTable({ heads, rows }: { heads: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) return <p className="px-4 pb-4 text-sm text-ink-soft">—</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {heads.map((h) => (
            <Th key={h}>{h}</Th>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((cells, i) => (
          <TableRow key={i}>
            {cells.map((c, j) => (
              <Td key={j} className={j > 0 ? "tabular-nums" : undefined}>
                {c}
              </Td>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function stepsReached(t: Strings, r: api.VisitRow): string {
  const reached = (["product", "cart", "checkout", "order"] as const).filter((k) => r.reached[k]);
  return reached.length ? t[`step_${reached[reached.length - 1]}` as keyof Strings] : "—";
}

function VisitsTab({
  t,
  locale,
  filters,
  sort,
  page,
  onSort,
  onPage,
  onOpen,
}: {
  t: Strings;
  locale: Locale;
  filters: TrafficFilters;
  sort: VisitSort;
  page: number;
  onSort: (sort: VisitSort) => void;
  onPage: (page: number) => void;
  onOpen: (v: { workspaceId: string; sessionId: string }) => void;
}) {
  const { data, loading, error, refresh } = useAsync(
    () => api.getVisits({ ...filters, page, pageSize: PAGE_SIZE, sort }),
    [filters.range, filters.workspaceId, filters.country, filters.governorate, filters.device, filters.source, sort, page]
  );
  return (
    <Panel
      flush
      actions={
        <>
          <NativeSelect aria-label={t.sortBy} value={sort} onChange={(e) => onSort(e.target.value as VisitSort)} className="w-36">
            {VISIT_SORTS.map((s) => (
              <option key={s} value={s}>
                {t[`sort_${s}` as keyof Strings]}
              </option>
            ))}
          </NativeSelect>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className="size-4" aria-hidden />
          </Button>
        </>
      }
    >
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data &&
          (data.sessions.length === 0 ? (
            <div className="p-4">
              <EmptyBlock message={t.noData} />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <Th>{t.when}</Th>
                      <Th>{t.store}</Th>
                      <Th>{t.visitor}</Th>
                      <Th>{t.place}</Th>
                      <Th>{t.deviceCol}</Th>
                      <Th>{t.sourceCol}</Th>
                      <Th>{t.pages}</Th>
                      <Th>{t.timeOnPage}</Th>
                      <Th>{t.steps}</Th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sessions.map((r) => (
                      <TableRow key={`${r.workspaceId}:${r.sessionId}`} className="cursor-pointer" onClick={() => onOpen({ workspaceId: r.workspaceId, sessionId: r.sessionId })}>
                        <Td>
                          <span title={formatDateTime(r.lastSeenAt)}>{formatRelative(r.lastSeenAt)}</span>
                        </Td>
                        <Td>{r.storeName ?? "—"}</Td>
                        <Td>
                          <Mono>{r.visitor}</Mono>
                        </Td>
                        <Td>
                          <div className="flex flex-col">
                            <span>{countryName(r.country, locale)}</span>
                            <GovernorateCell code={r.governorate} geoSource={r.geoSource} t={t} locale={locale} />
                          </div>
                        </Td>
                        <Td>
                          {r.device ?? "—"}
                          <span className="block text-xs text-ink-soft">{[r.browser, r.os].filter(Boolean).join(" · ")}</span>
                        </Td>
                        <Td>{r.source ?? r.referrerDomain ?? t.direct}</Td>
                        <Td className="tabular-nums">{formatNumber(r.pageViews)}</Td>
                        <Td className="tabular-nums">{formatDwell(r.dwellMs, locale)}</Td>
                        <Td>{stepsReached(t, r)}</Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="px-4 pb-4">
                <Pager total={data.total} limit={data.pageSize} offset={(data.page - 1) * data.pageSize} onOffset={(o) => onPage(Math.floor(o / data.pageSize) + 1)} />
              </div>
            </>
          ))}
      </DataState>
    </Panel>
  );
}

function VisitDrawer({ t, locale, visit, onClose }: { t: Strings; locale: Locale; visit: { workspaceId: string; sessionId: string } | null; onClose: () => void }) {
  const { data, loading, error, refresh } = useAsync(
    () => (visit ? api.getVisit(visit.workspaceId, visit.sessionId) : Promise.resolve(null)),
    [visit?.workspaceId, visit?.sessionId]
  );
  const s = data?.session;
  return (
    <Drawer open={Boolean(visit)} onClose={onClose} title={t.visitTitle} description={s ? `${s.storeName ?? ""} · ${s.visitor}` : undefined}>
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {s && data && (
          <div className="space-y-4">
            {data.quarantined && <Alert>{t.quarantined}</Alert>}
            <dl>
              <DetailRow label={t.started}>{formatDateTime(s.startedAt)}</DetailRow>
              <DetailRow label={t.lastSeen}>{formatDateTime(s.lastSeenAt)}</DetailRow>
              <DetailRow label={t.place}>
                {countryName(s.country, locale)}
                {s.city ? ` · ${s.city}` : ""} · <GovernorateCell code={s.governorate} geoSource={s.geoSource} t={t} locale={locale} />
              </DetailRow>
              <DetailRow label={t.deviceCol}>{[s.device, s.browser, s.os].filter(Boolean).join(" · ") || "—"}</DetailRow>
              <DetailRow label={t.ipHash}>
                <Mono>{s.ipHash ?? "—"}</Mono>
                <span className="mt-0.5 block text-xs text-ink-soft">{t.ipHashHint}</span>
              </DetailRow>
              <DetailRow label={t.utm}>{utmLine(s) ?? t.none}</DetailRow>
              <DetailRow label={t.referrer}>{s.referrerDomain ?? t.direct}</DetailRow>
              <DetailRow label={t.landing}>{s.landingPath ? <Mono>{s.landingPath}</Mono> : "—"}</DetailRow>
              <DetailRow label={t.clickIds}>{clickIdLine(s.clickIds) ?? t.none}</DetailRow>
              <DetailRow label={t.totalTime}>{formatDwell(s.dwellMs, locale)}</DetailRow>
              {s.flagged && <DetailRow label={t.reason}>{s.flagged}</DetailRow>}
            </dl>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink">{t.timeline}</h3>
              <ol className="space-y-2">
                {data.events.map((e, i) => (
                  <li key={i} className="rounded-md bg-paper-sunken/60 px-3 py-2 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-ink">{t[`ev_${e.type}` as keyof Strings] ?? e.type}</span>
                      <span className="text-xs text-ink-soft tabular-nums">{formatDateTime(e.at)}</span>
                    </div>
                    {(e.productName || e.path) && <div className="truncate text-ink-soft">{e.productName ?? <Mono>{e.path}</Mono>}</div>}
                    {e.dwellMs !== null && <div className="text-xs text-ink-soft">{`${t.timeOnPage}: ${formatDwell(e.dwellMs, locale)}`}</div>}
                    {e.amount !== null && <div className="text-xs text-ink-soft tabular-nums">{formatNumber(e.amount)}</div>}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </DataState>
    </Drawer>
  );
}

function CampaignsTab({ t, filters }: { t: Strings; filters: TrafficFilters }) {
  const { data, loading, error, refresh } = useAsync(
    () => api.getCampaigns(filters),
    [filters.range, filters.workspaceId, filters.country, filters.governorate, filters.device, filters.source]
  );
  return (
    <Panel description={t.spendHint} flush>
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data &&
          (data.campaigns.length === 0 ? (
            <div className="p-4">
              <EmptyBlock message={t.noCampaigns} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <SimpleTable
                heads={[t.store, t.source, t.campaign, t.visits, t.visitors, t.carts, t.orders, t.revenue, t.conversion, t.spend, t.cpa]}
                rows={data.campaigns.map((c) => [
                  c.storeName ?? "—",
                  c.source ?? "—",
                  c.campaign ?? "—",
                  formatNumber(c.visits),
                  formatNumber(c.visitors),
                  formatNumber(c.carts),
                  formatNumber(c.orders),
                  formatMinorMoney(c.revenue, c.currency),
                  formatRatePct(c.conversionRate),
                  c.spend === null ? "—" : formatMinorMoney(c.spend, c.currency),
                  c.cpa === null ? "—" : formatMinorMoney(c.cpa, c.currency),
                ])}
              />
            </div>
          ))}
      </DataState>
    </Panel>
  );
}

function OutcomesTab({ t, locale, workspaceId }: { t: Strings; locale: Locale; workspaceId?: string }) {
  const [range, setRange] = useState<OutcomeRange>("90d");
  const { data, loading, error, refresh } = useAsync(() => api.getOutcomes(range, workspaceId), [range, workspaceId]);
  return (
    <Panel
      description={data ? fmt(t.outcomesHint, { min: data.minOrders }) : undefined}
      actions={<Segmented size="sm" label={t.tabOutcomes} value={range} onChange={setRange} options={OUTCOME_RANGES.map((r) => ({ value: r, label: t[`range_${r}`] }))} />}
      flush
    >
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && (
          <SimpleTable
            heads={[t.governorate, t.finished, t.inProgress, t.delivered, t.returned, t.cancelled]}
            rows={data.governorates.map((g) => {
              const pct = (rate: number | null, n: number) => (g.enough ? `${formatRatePct(rate)} (${formatNumber(n)})` : fmt(t.tooFew, { min: data.minOrders }));
              return [
                g.governorate === "other" ? t.otherPlace : governorateName(g.governorate, locale),
                formatNumber(g.finished),
                formatNumber(g.inProgress),
                pct(g.deliveryRate, g.delivered),
                pct(g.returnRate, g.returned),
                pct(g.cancelRate, g.cancelled),
              ];
            })}
          />
        )}
      </DataState>
    </Panel>
  );
}

function ProtectionTab({
  t,
  locale,
  range,
  workspaceId,
  onOpen,
}: {
  t: Strings;
  locale: Locale;
  range: TrafficRange;
  workspaceId?: string;
  onOpen: (v: { workspaceId: string; sessionId: string }) => void;
}) {
  const { data, loading, error, refresh } = useAsync(() => api.getProtection(range, workspaceId), [range, workspaceId]);
  const kinds = ["bot", "rejected", "suspicious", "capped"] as const;
  return (
    <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
      {data && (
        <div className="space-y-4">
          {!data.enabled && <Alert>{t.protectionOff}</Alert>}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kinds.map((k) => (
              <KpiCard key={k} label={t[`kept_${k}` as keyof Strings]} value={formatNumber(data.totals[k])} />
            ))}
          </div>
          <p className="text-sm text-ink-soft">
            {t.originMode}: <Mono>{data.originCheck}</Mono> · {t.dailyCap}: {formatNumber(data.dailyCap)}
          </p>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel title={t.byReason}>
              <HBarList rows={data.byReason.map((r) => ({ label: `${t[`kept_${r.kind}` as keyof Strings] ?? r.kind} · ${r.reason}`, value: r.count }))} format={(v) => formatNumber(v)} />
            </Panel>
            <Panel title={t.bySource} description={t.bySourceHint}>
              <HBarList rows={data.bySource.map((r) => ({ label: r.label, value: r.count }))} format={(v) => formatNumber(v)} color="var(--color-accent)" />
            </Panel>
            <Panel title={t.byCountry}>
              <HBarList
                rows={data.byCountry.map((c) => ({ label: countryName(c.country, locale), value: c.bot + c.rejected + c.suspicious + c.capped }))}
                format={(v) => formatNumber(v)}
              />
            </Panel>
          </div>
          <Panel title={t.byStore} flush>
            <SimpleTable
              heads={[t.store, ...kinds.map((k) => t[`kept_${k}` as keyof Strings])]}
              rows={data.byStore.map((s) => [s.name ?? "—", formatNumber(s.bot), formatNumber(s.rejected), formatNumber(s.suspicious), formatNumber(s.capped)])}
            />
          </Panel>
          {data.cappedStores.length > 0 && (
            <Panel title={t.cappedStores} flush>
              <SimpleTable
                heads={[t.store, t.day, t.stored, t.overflow]}
                rows={data.cappedStores.map((c) => [c.name, c.day, formatNumber(c.stored), formatNumber(c.overflow)])}
              />
            </Panel>
          )}
          <Panel title={t.flaggedVisits} flush>
            {data.flaggedSessions.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-ink-soft">—</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <Th>{t.when}</Th>
                    <Th>{t.store}</Th>
                    <Th>{t.reason}</Th>
                    <Th>{t.excluded}</Th>
                    <Th>{t.ipHash}</Th>
                    <Th>{t.place}</Th>
                    <Th>{t.deviceCol}</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.flaggedSessions.map((f) => (
                    <TableRow key={`${f.workspaceId}:${f.sessionId}`} className="cursor-pointer" onClick={() => onOpen({ workspaceId: f.workspaceId, sessionId: f.sessionId })}>
                      <Td>{formatRelative(f.flaggedAt)}</Td>
                      <Td>{f.storeName}</Td>
                      <Td>{f.reason}</Td>
                      <Td className="tabular-nums">{formatNumber(f.excludedEvents)}</Td>
                      <Td>
                        <Mono>{f.ipHash ?? "—"}</Mono>
                      </Td>
                      <Td>{countryName(f.country, locale)}</Td>
                      <Td>{[f.device, f.browser].filter(Boolean).join(" · ") || "—"}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </div>
      )}
    </DataState>
  );
}
