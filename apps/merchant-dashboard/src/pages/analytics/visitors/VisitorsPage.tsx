import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Footprints } from "lucide-react";
import { Alert, Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@store-builder/ui";
import {
  visitorsCampaigns,
  visitorsList,
  visitorsOutcomes,
  visitorsSummary,
  visitorsVisit,
  type VisitorsFilters,
  type VisitorsFunnelStep,
  type VisitorsOutcomeRange,
  type VisitorsRange,
  type VisitorsSort,
  type VisitorsVisit,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/KpiCard";
import { Section } from "@/components/Section";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { Sheet } from "@/components/Sheet";
import { BarChart, HBarList } from "@/components/charts";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatDateTime, formatMinorMoney } from "@/lib/format";
import { countryName } from "@/lib/webAnalytics";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { GOVERNORATE_CODES, VISITORS_STRINGS, formatDwell, formatRatePct, governorateName } from "./visitorsStrings";

type Strings = Record<keyof (typeof VISITORS_STRINGS)["en"], string>;
type Locale = "en" | "ar";

const RANGES: VisitorsRange[] = ["today", "7d", "30d"];
const OUTCOME_RANGES: VisitorsOutcomeRange[] = ["30d", "90d"];
const SORTS: VisitorsSort[] = ["recent", "started", "pages"];
const TABS = ["overview", "visits", "campaigns", "outcomes"] as const;
type Tab = (typeof TABS)[number];
const DEVICES = ["mobile", "tablet", "laptop", "desktop"] as const;
const PAGE_SIZE = 25;

const count = (n: number) => n.toLocaleString();

/**
 * Analytics → Visitors (VITE_VISITORS_ENABLED; analytics.view): the store's own
 * visitors from /analytics/visitors/*. A visitor is an anonymous label — no IP
 * address ever reaches this screen. The tab, period and filters live in the
 * address.
 */
export function VisitorsPage() {
  const t = useT(VISITORS_STRINGS);
  const { locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "overview";
  const range = (RANGES as string[]).includes(params.get("range") ?? "") ? (params.get("range") as VisitorsRange) : "7d";
  const filters: VisitorsFilters = {
    range,
    country: params.get("country") || undefined,
    governorate: params.get("governorate") || undefined,
    device: (DEVICES as readonly string[]).includes(params.get("device") ?? "") ? (params.get("device") as VisitorsFilters["device"]) : undefined,
    source: params.get("source") || undefined,
  };
  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };
  const [openVisit, setOpenVisit] = useState<string | null>(null);
  const anyFilter = Boolean(filters.country || filters.governorate || filters.device || filters.source);

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
        {tab !== "outcomes" && (
          <div className="flex flex-wrap items-center gap-2">
            <Segmented size="sm" label={t.title} value={range} onChange={(v) => set({ range: v === "7d" ? undefined : v })} options={RANGES.map((r) => ({ value: r, label: t[`range_${r}`] }))} />
            <Select aria-label={t.governorate} value={filters.governorate ?? ""} onChange={(e) => set({ governorate: e.target.value || undefined })} className="w-40">
              <option value="">{t.anyGovernorate}</option>
              {GOVERNORATE_CODES.map((g) => (
                <option key={g} value={g}>
                  {governorateName(g, locale)}
                </option>
              ))}
            </Select>
            <Select aria-label={t.device} value={filters.device ?? ""} onChange={(e) => set({ device: e.target.value || undefined })} className="w-32">
              <option value="">{t.anyDevice}</option>
              {DEVICES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
            {filters.country && <FilterChip label={`${t.country}: ${countryName(filters.country, locale)}`} onClear={() => set({ country: undefined })} />}
            {filters.source && <FilterChip label={`${t.source}: ${filters.source === "direct" ? t.direct : filters.source}`} onClear={() => set({ source: undefined })} />}
            {anyFilter && (
              <Button size="sm" variant="ghost" onClick={() => set({ country: undefined, governorate: undefined, device: undefined, source: undefined })}>
                {t.clear}
              </Button>
            )}
          </div>
        )}
      </div>

      {tab === "overview" && <Overview t={t} locale={locale} filters={filters} onFilter={set} />}
      {tab === "visits" && (
        <Visits
          t={t}
          locale={locale}
          filters={filters}
          sort={(SORTS as string[]).includes(params.get("sort") ?? "") ? (params.get("sort") as VisitorsSort) : "recent"}
          page={Math.max(1, Number(params.get("page")) || 1)}
          onSort={(sort) => set({ sort: sort === "recent" ? undefined : sort })}
          onPage={(page) => set({ page: page > 1 ? String(page) : undefined })}
          onOpen={setOpenVisit}
        />
      )}
      {tab === "campaigns" && <Campaigns t={t} filters={filters} />}
      {tab === "outcomes" && <Outcomes t={t} locale={locale} />}

      <VisitSheet t={t} locale={locale} sessionId={openVisit} onClose={() => setOpenVisit(null)} />
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button type="button" onClick={onClear} className="rounded-full bg-paper-sunken px-3 py-1 text-sm text-ink hover:bg-ink/8">
      {label} ×
    </button>
  );
}

function Governorate({ code, geoSource, t, locale }: { code: string | null; geoSource: string | null; t: Strings; locale: Locale }) {
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

function Overview({ t, locale, filters, onFilter }: { t: Strings; locale: Locale; filters: VisitorsFilters; onFilter: (p: Record<string, string | undefined>) => void }) {
  const workspaceId = useWorkspaceId();
  const { data, loading, error, refresh } = useAsync(
    () => visitorsSummary(apiClient, workspaceId, filters),
    [workspaceId, filters.range, filters.country, filters.governorate, filters.device, filters.source]
  );
  return (
    <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
      {data &&
        (data.visits === 0 ? (
          <EmptyState icon={<Footprints className="size-6" aria-hidden />} title={t.noData} description={t.noDataHint} />
        ) : (
          <div className="space-y-4">
            {data.overCap && data.overCap.events > 0 && <Alert>{fmt(t.overCap, { count: count(data.overCap.events) })}</Alert>}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <KpiCard label={t.visits} value={count(data.visits)} />
              <KpiCard label={t.visitors} value={count(data.visitors)} />
              <KpiCard label={t.orders} value={count(data.orders)} />
              <KpiCard label={t.conversion} value={formatRatePct(data.conversionRate)} hint={t.conversionHint} />
              <KpiCard label={t.avgDwell} value={formatDwell(data.pages?.avgDwellMs, locale)} hint={t.avgDwellHint} />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Section title={t.funnel} description={t.funnelHint}>
                <Funnel t={t} steps={data.funnel} />
              </Section>
              <Section title={t.daily} description={data.timeZone}>
                <BarChart
                  points={data.daily.map((d) => ({ label: d.day.slice(5), value: d.visits }))}
                  height={160}
                  format={(v) => count(v)}
                  summary={`${t.daily}: ${data.daily.map((d) => `${d.day} ${count(d.visits)}`).join(", ")}`}
                />
              </Section>
            </div>
            {data.pages && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Section title={t.topPages} flush>
                  <SimpleTable
                    heads={[t.page, t.views, t.timeOnPage]}
                    rows={data.pages.topPages.map((p) => [<span key="p" className="font-mono text-xs">{p.path}</span>, count(p.views), formatDwell(p.avgDwellMs, locale)])}
                  />
                </Section>
                <Section title={t.topProducts} flush>
                  <SimpleTable
                    heads={[t.product, t.views, t.timeOnPage]}
                    rows={data.pages.topProducts.map((p) => [p.name ?? <span key="p" className="font-mono text-xs">{p.productId}</span>, count(p.views), formatDwell(p.avgDwellMs, locale)])}
                  />
                </Section>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Section title={t.sources}>
                <PickList
                  rows={data.sources.map((s) => ({ key: s.source, label: s.source === "direct" ? t.direct : s.source, value: s.visits, note: formatRatePct(s.conversionRate) }))}
                  onPick={(source) => onFilter({ source })}
                />
              </Section>
              <Section title={t.governorates} description={t.approxNote}>
                <PickList
                  rows={data.governorates.map((g) => ({
                    key: g.governorate,
                    label: governorateName(g.governorate, locale),
                    value: g.visits,
                    note: g.approximate > 0 ? `${count(g.approximate)} ${t.approx}` : t.fromOrder,
                  }))}
                  onPick={(governorate) => onFilter({ governorate })}
                />
              </Section>
              <Section title={t.countries}>
                <PickList rows={data.countries.map((c) => ({ key: c.country ?? "", label: c.country ? countryName(c.country, locale) : "—", value: c.visits }))} onPick={(country) => country && onFilter({ country })} />
              </Section>
              <Section title={t.devices}>
                <HBarList rows={data.devices.map((d) => ({ label: d.device, value: d.visits }))} format={(v) => count(v)} />
              </Section>
            </div>
          </div>
        ))}
    </DataState>
  );
}

function Funnel({ t, steps }: { t: Strings; steps: VisitorsFunnelStep[] }) {
  const top = Math.max(1, steps[0]?.visitors ?? 1);
  return (
    <ol className="space-y-2.5">
      {steps.map((s) => (
        <li key={s.key} className="text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-ink">{t[`step_${s.key}` as keyof Strings]}</span>
            <span className="tabular-nums text-ink">
              {count(s.visitors)}
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

function PickList({ rows, onPick }: { rows: Array<{ key: string; label: string; value: number; note?: string }>; onPick: (key: string) => void }) {
  if (rows.length === 0) return <p className="text-sm text-ink-soft">—</p>;
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.key || r.label}>
          <button type="button" onClick={() => onPick(r.key)} className="w-full rounded-md px-1 py-0.5 text-start text-sm hover:bg-paper-sunken">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-ink">{r.label}</span>
              <span className="shrink-0 tabular-nums text-ink">
                {count(r.value)}
                {r.note && <span className="ms-2 text-xs text-ink-soft">{r.note}</span>}
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

function SimpleTable({ heads, rows }: { heads: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) return <p className="px-4 pb-4 text-sm text-ink-soft">—</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {heads.map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((cells, i) => (
            <TableRow key={i}>
              {cells.map((c, j) => (
                <TableCell key={j} className={j > 0 ? "tabular-nums" : undefined}>
                  {c}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function reached(t: Strings, v: VisitorsVisit): string {
  const steps = (["product", "cart", "checkout", "order"] as const).filter((k) => v.reached[k]);
  return steps.length ? t[`step_${steps[steps.length - 1]}` as keyof Strings] : "—";
}

function Visits({
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
  filters: VisitorsFilters;
  sort: VisitorsSort;
  page: number;
  onSort: (s: VisitorsSort) => void;
  onPage: (p: number) => void;
  onOpen: (sessionId: string) => void;
}) {
  const workspaceId = useWorkspaceId();
  const { data, loading, error, refresh } = useAsync(
    () => visitorsList(apiClient, workspaceId, { ...filters, page, pageSize: PAGE_SIZE, sort }),
    [workspaceId, filters.range, filters.country, filters.governorate, filters.device, filters.source, sort, page]
  );
  return (
    <Section
      title={t.tabVisits}
      flush
      actions={
        <Select aria-label={t.sortBy} value={sort} onChange={(e) => onSort(e.target.value as VisitorsSort)} className="w-36">
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t[`sort_${s}` as keyof Strings]}
            </option>
          ))}
        </Select>
      }
    >
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data &&
          (data.sessions.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-ink-soft">{t.noData}</p>
          ) : (
            <>
              <SimpleTable
                heads={[t.when, t.visitor, t.place, t.device, t.source, t.pages, t.timeOnPage, t.reachedCol]}
                rows={data.sessions.map((v) => [
                  <button key="w" type="button" className="text-start text-primary hover:underline" onClick={() => onOpen(v.sessionId)}>
                    {formatDateTime(v.lastSeenAt)}
                  </button>,
                  <span key="v" className="font-mono text-xs">
                    {v.visitor}
                  </span>,
                  <span key="p" className="flex flex-col">
                    <span>{v.country ? countryName(v.country, locale) : "—"}</span>
                    <Governorate code={v.governorate} geoSource={v.geoSource} t={t} locale={locale} />
                  </span>,
                  [v.device, v.browser].filter(Boolean).join(" · ") || "—",
                  v.source ?? v.referrerDomain ?? t.direct,
                  count(v.pageViews),
                  formatDwell(v.dwellMs, locale),
                  reached(t, v),
                ])}
              />
              <Pager t={t} total={data.total} page={data.page} pageSize={data.pageSize} onPage={onPage} />
            </>
          ))}
      </DataState>
    </Section>
  );
}

function Pager({ t, total, page, pageSize, onPage }: { t: Strings; total: number; page: number; pageSize: number; onPage: (p: number) => void }) {
  if (total <= pageSize && page === 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-ink-soft">
      <span className="tabular-nums">{fmt(t.ofTotal, { from, to, total })}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t.previous}
        </Button>
        <Button size="sm" variant="outline" disabled={to >= total} onClick={() => onPage(page + 1)}>
          {t.next}
        </Button>
      </div>
    </div>
  );
}

function VisitSheet({ t, locale, sessionId, onClose }: { t: Strings; locale: Locale; sessionId: string | null; onClose: () => void }) {
  const workspaceId = useWorkspaceId();
  const { data, loading, error, refresh } = useAsync(
    () => (sessionId ? visitorsVisit(apiClient, workspaceId, sessionId) : Promise.resolve(null)),
    [workspaceId, sessionId]
  );
  const v = data?.session;
  const utm = v ? [v.source, v.medium, v.campaign, v.utmContent, v.utmTerm].filter(Boolean).join(" / ") : "";
  const clicks = v ? (["fbclid", "gclid", "ttclid"] as const).filter((k) => v.clickIds[k]).join(", ") : "";
  return (
    <Sheet open={Boolean(sessionId)} onOpenChange={(open) => !open && onClose()} title={t.visitTitle} description={v?.visitor} side="end" size="lg">
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {v && data && (
          <div className="space-y-4">
            <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-ink-soft">{t.started}</dt>
              <dd>{formatDateTime(v.startedAt)}</dd>
              <dt className="text-ink-soft">{t.place}</dt>
              <dd>
                {v.country ? countryName(v.country, locale) : "—"}
                {v.city ? ` · ${v.city}` : ""} · <Governorate code={v.governorate} geoSource={v.geoSource} t={t} locale={locale} />
              </dd>
              <dt className="text-ink-soft">{t.device}</dt>
              <dd>{[v.device, v.browser, v.os].filter(Boolean).join(" · ") || "—"}</dd>
              <dt className="text-ink-soft">{t.utm}</dt>
              <dd>{utm || t.none}</dd>
              <dt className="text-ink-soft">{t.referrer}</dt>
              <dd>{v.referrerDomain ?? t.direct}</dd>
              <dt className="text-ink-soft">{t.landing}</dt>
              <dd className="font-mono text-xs">{v.landingPath ?? "—"}</dd>
              <dt className="text-ink-soft">{t.clickIds}</dt>
              <dd>{clicks || t.none}</dd>
              <dt className="text-ink-soft">{t.totalTime}</dt>
              <dd>{formatDwell(v.dwellMs, locale)}</dd>
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
                    {(e.productName || e.path) && <div className="truncate text-ink-soft">{e.productName ?? e.path}</div>}
                    {e.dwellMs !== null && <div className="text-xs text-ink-soft">{`${t.timeOnPage}: ${formatDwell(e.dwellMs, locale)}`}</div>}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </DataState>
    </Sheet>
  );
}

function Campaigns({ t, filters }: { t: Strings; filters: VisitorsFilters }) {
  const workspaceId = useWorkspaceId();
  const { data, loading, error, refresh } = useAsync(
    () => visitorsCampaigns(apiClient, workspaceId, filters),
    [workspaceId, filters.range, filters.country, filters.governorate, filters.device, filters.source]
  );
  return (
    <Section
      title={t.tabCampaigns}
      description={t.spendHint}
      flush
      actions={
        <Link to="/ads" className="text-sm text-primary hover:underline">
          {t.addSpend}
        </Link>
      }
    >
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data &&
          (data.campaigns.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-ink-soft">{t.noCampaigns}</p>
          ) : (
            <SimpleTable
              heads={[t.source, t.campaign, t.visits, t.visitors, t.carts, t.orders, t.revenue, t.conversion, t.spend, t.cpa]}
              rows={data.campaigns.map((c) => [
                c.source ?? "—",
                c.campaign ?? "—",
                count(c.visits),
                count(c.visitors),
                count(c.carts),
                count(c.orders),
                formatMinorMoney(c.revenue, c.currency),
                formatRatePct(c.conversionRate),
                c.spend === null ? "—" : formatMinorMoney(c.spend, c.currency),
                c.cpa === null ? "—" : formatMinorMoney(c.cpa, c.currency),
              ])}
            />
          ))}
      </DataState>
    </Section>
  );
}

function Outcomes({ t, locale }: { t: Strings; locale: Locale }) {
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<VisitorsOutcomeRange>("90d");
  const { data, loading, error, refresh } = useAsync(() => visitorsOutcomes(apiClient, workspaceId, range), [workspaceId, range]);
  return (
    <Section
      title={t.tabOutcomes}
      description={data ? fmt(t.outcomesHint, { min: data.minOrders }) : undefined}
      flush
      actions={<Segmented size="sm" label={t.tabOutcomes} value={range} onChange={setRange} options={OUTCOME_RANGES.map((r) => ({ value: r, label: t[`range_${r}`] }))} />}
    >
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && (
          <SimpleTable
            heads={[t.governorate, t.finished, t.inProgress, t.delivered, t.returned, t.cancelled]}
            rows={data.governorates.map((g) => {
              const pct = (rate: number | null, n: number) => (g.enough ? `${formatRatePct(rate)} (${count(n)})` : fmt(t.tooFew, { min: data.minOrders }));
              return [
                g.governorate === "other" ? t.otherPlace : governorateName(g.governorate, locale),
                count(g.finished),
                count(g.inProgress),
                pct(g.deliveryRate, g.delivered),
                pct(g.returnRate, g.returned),
                pct(g.cancelRate, g.cancelled),
              ];
            })}
          />
        )}
      </DataState>
    </Section>
  );
}
