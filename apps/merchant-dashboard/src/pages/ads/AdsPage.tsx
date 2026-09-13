import { Fragment, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Download, Pause, Play, Plug, RefreshCw, Search } from "lucide-react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, cn } from "@store-builder/ui";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, formatDateTime, majorToMinor, minorToMajorInput } from "@/lib/format";
import { mockApi } from "@/mock/api";
import type { AdAccount, AdCreative, AdSet, Campaign } from "@/mock/types2";
import { computeMetrics, fmtPct, fmtX, PLATFORM_LABEL, platformLabel, verdictFor, verdictLabel, withEstimatedCost, type AdMetrics } from "@/lib/adMetrics";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { EmptyState } from "@/components/EmptyState";
import { LineAreaChart } from "@/components/charts";
import { RangeSwitch, type AnalyticsRange } from "@/components/RangeSwitch";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useLocale, useT } from "@/i18n/LocaleContext";
import { Num, PlatformChip, VerdictPill, breakEvenCpdFor, fmtNodes, tdNum, thClass, useAdsLabels } from "./adsShared";
import { ADS_COMMON, ADS_PAGE } from "./ads.strings";

// ------------------------------------------------------------ helpers --

const RANGE_DAYS: Record<AnalyticsRange, number> = { "7d": 7, "30d": 30, "90d": 90 };
const PLATFORMS: Array<AdAccount["platform"]> = ["facebook", "tiktok", "snapchat", "google"];

function shortDate(iso: string, intlLocale: string): string {
  return new Date(iso).toLocaleDateString(intlLocale, { month: "short", day: "numeric" });
}

function money(v: number | null, currency: string): string {
  return v === null ? "—" : formatMoney(Math.round(v), currency);
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

interface CampaignRow {
  c: Campaign;
  m: AdMetrics;
  breakEvenCpd: number | null;
  verdict: ReturnType<typeof verdictFor>;
}

type SortKey = "name" | "status" | "budget" | "spend" | "orders" | "conf" | "deliv" | "cpo" | "cpco" | "cpd" | "be" | "roas" | "net";

const SORT_VALUE: Record<SortKey, (r: CampaignRow) => number | string> = {
  name: (r) => r.c.name,
  status: (r) => r.c.status,
  budget: (r) => r.c.dailyBudgetAmount,
  spend: (r) => r.c.spendAmount,
  orders: (r) => r.c.orders,
  conf: (r) => r.m.confirmationRate ?? -1,
  deliv: (r) => r.m.deliveryRate ?? -1,
  cpo: (r) => r.m.cpo ?? Number.MAX_SAFE_INTEGER,
  cpco: (r) => r.m.cpco ?? Number.MAX_SAFE_INTEGER,
  cpd: (r) => r.m.cpd ?? Number.MAX_SAFE_INTEGER,
  be: (r) => r.breakEvenCpd ?? -1,
  roas: (r) => r.m.roas ?? -1,
  net: (r) => r.m.netProfit,
};

type AdsPageKey = keyof (typeof ADS_PAGE)["en"];

/** Rule ids are persisted; their copy is resolved per locale from ADS_PAGE. */
const AD_RULES: Array<{ id: string; titleKey: AdsPageKey; descriptionKey: AdsPageKey }> = [
  { id: "pause-over-be", titleKey: "rulePauseTitle", descriptionKey: "rulePauseDesc" },
  { id: "scale-winners", titleKey: "ruleScaleTitle", descriptionKey: "ruleScaleDesc" },
  { id: "notify-zero-conf", titleKey: "ruleNotifyTitle", descriptionKey: "ruleNotifyDesc" },
];

function rulesKey(ws: string) {
  return `zimos.mock.${ws}.adRules`;
}

function readRules(ws: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(rulesKey(ws));
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    /* ignore */
  }
  return { "pause-over-be": true, "scale-winners": false, "notify-zero-conf": true };
}

// ------------------------------------------------------- sub-components --

function SortableTh({ label, title, sortKey, sort, onSort, align = "end", className }: { label: string; title?: string; sortKey: SortKey; sort: { key: SortKey; dir: "asc" | "desc" }; onSort: (k: SortKey) => void; align?: "start" | "end"; className?: string }) {
  const active = sort.key === sortKey;
  return (
    <th className={cn(thClass, align === "end" && "text-end", className)} title={title} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => onSort(sortKey)} className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
        {label}
        {active && (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
}

function BudgetCell({ campaign, currency, onSave }: { campaign: Campaign; currency: string; onSave: (minor: number) => Promise<void> }) {
  const t = useT(ADS_PAGE);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  function start(e: MouseEvent) {
    e.stopPropagation();
    setValue(minorToMajorInput(campaign.dailyBudgetAmount));
    setEditing(true);
  }

  async function commit() {
    const minor = majorToMinor(value);
    if (!Number.isFinite(minor) || minor < 0 || minor === campaign.dailyBudgetAmount) {
      setEditing(false);
      return;
    }
    setBusy(true);
    await onSave(minor);
    setBusy(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Input
          autoFocus
          type="number"
          dir="ltr"
          min={0}
          step="1"
          value={value}
          disabled={busy}
          aria-label={t.tipBudget}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-7 w-24 text-right text-xs"
        />
      </div>
    );
  }
  return (
    <button type="button" onClick={start} className="rounded px-1 tabular-nums text-ink underline decoration-dotted underline-offset-4 hover:bg-paper hover:text-primary" title={t.budgetEditTitle}>
      <Num>{formatMoney(campaign.dailyBudgetAmount, currency)}</Num>
    </button>
  );
}

function MetricCells({ stats, breakEvenCpd, currency }: { stats: Parameters<typeof computeMetrics>[0]; breakEvenCpd: number | null; currency: string }) {
  const { intlLocale } = useLocale();
  const m = computeMetrics(stats);
  const verdict = verdictFor(m.cpd, breakEvenCpd);
  return (
    <>
      <td className={cn(tdNum, "text-ink")}>
        <Num>{formatMoney(stats.spendAmount, currency)}</Num>
      </td>
      <td className={cn(tdNum, "text-ink-soft")}>
        <Num>{stats.orders.toLocaleString(intlLocale)}</Num>
      </td>
      <td className={cn(tdNum, "text-ink-soft")}>
        <Num>{fmtPct(m.confirmationRate)}</Num>
      </td>
      <td className={cn(tdNum, "text-ink-soft")}>
        <Num>{fmtPct(m.deliveryRate)}</Num>
      </td>
      <td className={cn(tdNum, "text-ink-soft")}>
        <Num>{money(m.cpo, currency)}</Num>
      </td>
      <td className={cn(tdNum, "text-ink-soft")}>
        <Num>{money(m.cpco, currency)}</Num>
      </td>
      <td className={cn(tdNum, "font-medium text-ink")}>
        <Num>{money(m.cpd, currency)}</Num>
      </td>
      <td className={cn(tdNum, "text-ink-soft")}>
        <Num>{fmtX(m.roas)}</Num>
      </td>
      <td className={cn(tdNum, "font-medium", m.netProfit < 0 ? "text-danger" : "text-success")}>
        <Num>{formatMoney(m.netProfit, currency)}</Num>
      </td>
      <td className="px-3 py-2">
        <VerdictPill verdict={verdict} />
      </td>
    </>
  );
}

function CreativeRow({ creative, campaign, breakEvenCpd, currency }: { creative: AdCreative; campaign: Campaign; breakEvenCpd: number | null; currency: string }) {
  const { creativeFormat } = useAdsLabels();
  return (
    <tr className="border-b border-line/60 bg-paper text-xs last:border-0">
      <td className="px-3 py-2 ps-14">
        <div className="flex items-center gap-2">
          <span className="size-6 shrink-0 rounded" style={{ background: creative.thumbnailColor }} />
          <span className="truncate text-ink">{creative.name}</span>
          <span className="rounded border border-line bg-paper-raised px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-soft">{creativeFormat[creative.format]}</span>
        </div>
      </td>
      <MetricCells stats={withEstimatedCost(creative, campaign)} breakEvenCpd={breakEvenCpd} currency={currency} />
    </tr>
  );
}

function AdSetRows({ adSet, campaign, breakEvenCpd, currency, expanded, onToggle }: { adSet: AdSet; campaign: Campaign; breakEvenCpd: number | null; currency: string; expanded: boolean; onToggle: () => void }) {
  const t = useT(ADS_PAGE);
  return (
    <>
      <tr className="cursor-pointer border-b border-line/60 bg-paper-raised text-sm hover:bg-paper" onClick={onToggle} aria-expanded={expanded}>
        <td className="px-3 py-2 ps-8">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="size-3.5 text-ink-soft" /> : <ChevronRight className="size-3.5 text-ink-soft rtl:rotate-180" />}
            <span className="truncate text-ink">{adSet.name}</span>
            <span className="whitespace-nowrap text-xs text-ink-soft">{fmt(t.creativesCount, { n: adSet.creatives.length })}</span>
          </div>
        </td>
        <MetricCells stats={withEstimatedCost(adSet, campaign)} breakEvenCpd={breakEvenCpd} currency={currency} />
      </tr>
      {expanded && adSet.creatives.map((cr) => <CreativeRow key={cr.id} creative={cr} campaign={campaign} breakEvenCpd={breakEvenCpd} currency={currency} />)}
    </>
  );
}

function DrillDown({ campaign, breakEvenCpd, currency }: { campaign: Campaign; breakEvenCpd: number | null; currency: string }) {
  const t = useT(ADS_PAGE);
  const a = useT(ADS_COMMON);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const headers: Array<{ label: string; title?: string }> = [
    { label: a.spend },
    { label: a.orders },
    { label: a.confPct, title: a.tipConf },
    { label: a.delivPct, title: a.tipDeliv },
    { label: a.cpo, title: a.tipCpo },
    { label: a.cpco, title: a.tipCpco },
    { label: a.cpd, title: a.tipCpd },
    { label: a.roas, title: a.tipRoas },
    { label: a.netProfit },
  ];
  return (
    <tr className="border-b border-line">
      <td colSpan={16} className="bg-paper/60 p-0">
        <div className="overflow-x-auto border-s-2 border-primary/40">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-1.5 ps-8 text-start font-medium">{t.colAdSetCreative}</th>
                {headers.map((h) => (
                  <th key={h.label} className="px-3 py-1.5 text-end font-medium" title={h.title}>
                    {h.label}
                  </th>
                ))}
                <th className="px-3 py-1.5 text-start font-medium">{a.verdict}</th>
              </tr>
            </thead>
            <tbody>
              {campaign.adSets.map((s) => (
                <AdSetRows key={s.id} adSet={s} campaign={campaign} breakEvenCpd={breakEvenCpd} currency={currency} expanded={open.has(s.id)} onToggle={() => toggle(s.id)} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-ink-soft">
          <span>{t.drillNote}</span>
          <Link to={`/ads/${campaign.id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            {t.openCampaign}
            <span aria-hidden className="inline-block rtl:rotate-180">
              →
            </span>
          </Link>
        </div>
      </td>
    </tr>
  );
}

function ConnectModal({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: (acc: AdAccount) => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(ADS_PAGE);
  const c = useCommon();
  const { locale } = useLocale();
  const [platform, setPlatform] = useState<AdAccount["platform"]>("facebook");
  const [busy, setBusy] = useState(false);
  const name = platformLabel(platform, locale);

  async function connect() {
    setBusy(true);
    try {
      // The account name is data sent to the API; keep it unchanged across locales.
      const acc = await mockApi.connectAdAccount(workspaceId, platform, `${PLATFORM_LABEL[platform]} — New account`);
      onConnected(acc);
      toast.success(fmt(t.toastConnected, { platform: name }));
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.connectTitle}
      description={t.connectDesc}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {c.cancel}
          </Button>
          <Button onClick={() => void connect()} disabled={busy}>
            <Plug />
            {busy ? t.connecting : fmt(t.continueWith, { platform: name })}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlatform(p)}
            aria-pressed={platform === p}
            className={cn("rounded-xl border px-3 py-3 text-sm font-medium transition-colors", platform === p ? "border-primary bg-primary-soft text-primary" : "border-line text-ink hover:border-primary/40")}
          >
            {platformLabel(p, locale)}
          </button>
        ))}
      </div>
      <ol className="mt-4 space-y-2 text-sm text-ink-soft">
        <li>{fmt(t.step1, { platform: name })}</li>
        <li>{t.step2}</li>
        <li>{t.step3}</li>
      </ol>
      <Alert variant="info" className="mt-4 text-xs">
        {t.demoNote}
      </Alert>
    </Modal>
  );
}

function AccountsStrip({ accounts, currency, onReconnect, onConnect }: { accounts: AdAccount[]; currency: string; onReconnect: (id: string) => Promise<void>; onConnect: () => void }) {
  const t = useT(ADS_PAGE);
  const { accountStatus } = useAdsLabels();
  const [busyId, setBusyId] = useState<string | null>(null);
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {accounts.map((a) => (
        <div key={a.id} className="flex min-w-[260px] shrink-0 flex-col gap-2 rounded-2xl border border-line bg-paper-raised px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <PlatformChip platform={a.platform} />
            <StatusBadge value={accountStatus[a.status]} tone={a.status === "connected" ? "success" : a.status === "token_expired" ? "warning" : "neutral"} />
          </div>
          <p className="truncate text-sm font-medium text-ink">{a.name}</p>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ink-soft">{t.spendToday}</p>
              <p className="font-display text-lg font-medium text-ink">
                <Num>{formatMoney(a.spendTodayAmount, currency)}</Num>
              </p>
            </div>
            {a.status === "token_expired" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === a.id}
                onClick={async () => {
                  setBusyId(a.id);
                  await onReconnect(a.id);
                  setBusyId(null);
                }}
              >
                <RefreshCw className={cn(busyId === a.id && "animate-spin")} />
                {t.reconnect}
              </Button>
            ) : (
              <span className="text-[11px] text-ink-soft">{fmt(t.synced, { time: a.lastSyncAt ? formatDateTime(a.lastSyncAt) : t.never })}</span>
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onConnect}
        className="flex min-w-[200px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-ink-soft transition-colors hover:border-primary/40 hover:text-primary"
      >
        <Plug className="size-5" />
        {t.connectTitle}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- page --

export function AdsPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(ADS_PAGE);
  const c = useCommon();
  const { t: a, campaignStatus } = useAdsLabels();
  const { locale, intlLocale } = useLocale();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [platform, setPlatform] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [product, setProduct] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "spend", dir: "desc" });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [connectOpen, setConnectOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rules, setRules] = useState<Record<string, boolean>>(() => readRules(workspaceId));

  useEffect(() => {
    setRules(readRules(workspaceId));
  }, [workspaceId]);

  function setRule(id: string, on: boolean) {
    setRules((prev) => {
      const next = { ...prev, [id]: on };
      try {
        localStorage.setItem(rulesKey(workspaceId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const state = useAsync(
    () =>
      Promise.all([mockApi.listAdAccounts(workspaceId), mockApi.listCampaigns(workspaceId), mockApi.listEconomics(workspaceId)]).then(([accounts, campaigns, economics]) => ({ accounts, campaigns, economics })),
    [workspaceId]
  );
  const data = state.data;
  const currency = "EGP";
  const factor = RANGE_DAYS[range] / 30;

  const rows = useMemo<CampaignRow[]>(() => {
    if (!data) return [];
    return data.campaigns.map((c) => {
      const m = computeMetrics(c);
      const be = breakEvenCpdFor(c, data.economics);
      return { c, m, breakEvenCpd: be, verdict: verdictFor(m.cpd, be) };
    });
  }, [data]);

  const products = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.c.productId && r.c.productName) map.set(r.c.productId, r.c.productName);
    });
    return Array.from(map.entries());
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter(
      (r) =>
        (platform === "all" || r.c.platform === platform) &&
        (status === "all" || r.c.status === status) &&
        (product === "all" || r.c.productId === product) &&
        (q === "" || r.c.name.toLowerCase().includes(q) || (r.c.productName ?? "").toLowerCase().includes(q))
    );
    const get = SORT_VALUE[sort.key];
    return [...filtered].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const cmp = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, platform, status, product, search, sort]);

  // KPIs for the range: mock campaigns are 30-day totals, scale linearly.
  const kpi = useMemo(() => {
    const active = rows.filter((r) => r.c.status !== "ended" || range !== "7d");
    const sum = (f: (r: CampaignRow) => number) => active.reduce((a, r) => a + f(r), 0);
    const spend = sum((r) => r.c.spendAmount) * factor;
    const orders = Math.round(sum((r) => r.c.orders) * factor);
    const confirmed = sum((r) => r.c.confirmedOrders) * factor;
    const delivered = sum((r) => r.c.deliveredOrders) * factor;
    const revenue = sum((r) => r.c.revenueAmount) * factor;
    const cost = sum((r) => r.c.costOfDeliveredAmount) * factor;
    return {
      spend,
      orders,
      cpco: confirmed > 0 ? spend / confirmed : null,
      cpd: delivered > 0 ? spend / delivered : null,
      roas: spend > 0 ? revenue / spend : null,
      net: revenue - spend - cost,
      revenue,
    };
  }, [rows, factor, range]);

  const chart = useMemo(() => {
    if (!data) return [];
    const byDate = new Map<string, { spend: number; revenue: number; net: number }>();
    data.campaigns.forEach((c) => {
      const costPerDelivered = c.deliveredOrders > 0 ? c.costOfDeliveredAmount / c.deliveredOrders : 0;
      const deliveredShare = c.orders > 0 ? c.deliveredOrders / c.orders : 0;
      c.daily.forEach((d) => {
        const cur = byDate.get(d.date) ?? { spend: 0, revenue: 0, net: 0 };
        const cost = d.orders * deliveredShare * costPerDelivered;
        byDate.set(d.date, { spend: cur.spend + d.spendAmount, revenue: cur.revenue + d.revenueAmount, net: cur.net + d.revenueAmount - d.spendAmount - cost });
      });
    });
    const days = Math.min(RANGE_DAYS[range], 30);
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-days)
      .map(([date, v]) => ({ label: shortDate(date, intlLocale), ...v }));
  }, [data, range, intlLocale]);

  function onSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.c.id));

  function patchCampaign(id: string, patch: Partial<Campaign>) {
    state.setData((prev) => (prev ? { ...prev, campaigns: prev.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : prev!));
  }

  async function setStatus1(id: string, next: Campaign["status"]) {
    patchCampaign(id, { status: next });
    await mockApi.setCampaignStatus(workspaceId, id, next);
  }

  async function bulkStatus(next: Campaign["status"]) {
    const ids = visible.filter((r) => selected.has(r.c.id) && r.c.status !== "ended").map((r) => r.c.id);
    if (ids.length === 0) return;
    setBulkBusy(true);
    await Promise.all(ids.map((id) => setStatus1(id, next)));
    setBulkBusy(false);
    setSelected(new Set());
    const one = ids.length === 1;
    const template = next === "active" ? (one ? t.toastActivatedOne : t.toastActivatedMany) : one ? t.toastPausedOne : t.toastPausedMany;
    toast.success(fmt(template, { n: ids.length }));
  }

  async function saveBudget(id: string, minor: number) {
    patchCampaign(id, { dailyBudgetAmount: minor });
    await mockApi.setCampaignBudget(workspaceId, id, minor);
    toast.success(t.toastBudget);
  }

  async function reconnect(id: string) {
    await mockApi.reconnectAdAccount(workspaceId, id);
    await state.refresh({ silent: true });
    toast.success(t.toastReconnected);
  }

  function exportCsv() {
    // Machine-readable snake_case headers and raw enum values are kept stable across locales.
    const header = ["platform", "campaign", "product", "status", "daily_budget", "spend", "orders", "confirmed", "delivered", "conf_rate", "deliv_rate", "cpo", "cpco", "cpd", "break_even_cpd", "roas", "net_profit", "verdict"];
    const lines = visible.map((r) => [
      r.c.platform,
      r.c.name,
      r.c.productName ?? "",
      r.c.status,
      (r.c.dailyBudgetAmount / 100).toFixed(2),
      (r.c.spendAmount / 100).toFixed(2),
      r.c.orders,
      r.c.confirmedOrders,
      r.c.deliveredOrders,
      r.m.confirmationRate === null ? "" : (r.m.confirmationRate * 100).toFixed(1),
      r.m.deliveryRate === null ? "" : (r.m.deliveryRate * 100).toFixed(1),
      r.m.cpo === null ? "" : (r.m.cpo / 100).toFixed(2),
      r.m.cpco === null ? "" : (r.m.cpco / 100).toFixed(2),
      r.m.cpd === null ? "" : (r.m.cpd / 100).toFixed(2),
      r.breakEvenCpd === null ? "" : (r.breakEvenCpd / 100).toFixed(2),
      r.m.roas === null ? "" : r.m.roas.toFixed(2),
      (r.m.netProfit / 100).toFixed(2),
      r.verdict ?? "",
    ]);
    const csv = [header, ...lines].map((l) => l.map(csvCell).join(",")).join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(el);
    el.click();
    el.remove();
    URL.revokeObjectURL(url);
  }

  const kpiCards: Array<{ id: string; label: string; value: ReactNode; hint: string }> = [
    { id: "spend", label: a.spend, value: <Num>{formatMoney(Math.round(kpi.spend), currency)}</Num>, hint: fmt(t.kpiSpendHint, { n: data?.accounts.length ?? 0 }) },
    { id: "orders", label: a.orders, value: <Num>{kpi.orders.toLocaleString(intlLocale)}</Num>, hint: t.kpiOrdersHint },
    { id: "cpco", label: t.kpiCpco, value: <Num>{money(kpi.cpco, currency)}</Num>, hint: t.kpiCpcoHint },
    { id: "cpd", label: t.kpiCpd, value: <Num>{money(kpi.cpd, currency)}</Num>, hint: t.kpiCpdHint },
    { id: "roas", label: t.kpiRoas, value: <Num>{fmtX(kpi.roas)}</Num>, hint: t.kpiRoasHint },
    { id: "net", label: a.netProfit, value: <Num className={kpi.net < 0 ? "text-danger" : "text-success"}>{formatMoney(Math.round(kpi.net), currency)}</Num>, hint: t.kpiNetHint },
  ];

  const series = [
    { label: t.seriesSpend, key: "spend" as const, color: "var(--color-accent)" },
    { label: t.seriesRevenue, key: "revenue" as const, color: "var(--color-primary)" },
    { label: a.netProfit, key: "net" as const, color: "var(--color-success)" },
  ];

  return (
    <div className="max-w-7xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            <RangeSwitch value={range} onChange={setRange} />
            <Button variant="outline" size="sm" disabled={visible.length === 0} onClick={exportCsv}>
              <Download />
              {c.exportCsv}
            </Button>
          </>
        }
      />

      <DataState loading={state.loading && !data} error={state.error} onRetry={() => state.refresh()}>
        {data && (
          <div className="space-y-6">
            <AccountsStrip accounts={data.accounts} currency={currency} onReconnect={reconnect} onConnect={() => setConnectOpen(true)} />

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
              {kpiCards.map((k) => (
                <KpiCard key={k.id} label={k.label} value={k.value} hint={k.hint} />
              ))}
            </div>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="font-semibold">{t.chartTitle}</CardTitle>
                <CardDescription>{t.chartDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {series.map((s) => (
                    <div key={s.key}>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">{s.label}</p>
                      <div dir="ltr">
                        <LineAreaChart points={chart.map((d) => ({ label: d.label, value: Math.max(d[s.key], 0) }))} color={s.color} format={(v) => formatMoney(Math.round(v), currency)} height={140} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-semibold">{t.campaignsTitle}</CardTitle>
                    <CardDescription>{t.campaignsDesc}</CardDescription>
                  </div>
                  {selected.size > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-ink-soft">{fmt(t.selectedCount, { n: selected.size })}</span>
                      <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void bulkStatus("paused")}>
                        <Pause />
                        {t.pauseSelected}
                      </Button>
                      <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void bulkStatus("active")}>
                        <Play />
                        {t.activateSelected}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-auto">
                    <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} className="h-9 w-full ps-8 sm:w-64" />
                  </div>
                  <Select value={platform} onChange={(e) => setPlatform(e.target.value)} className="h-9 w-auto" aria-label={t.allPlatforms}>
                    <option value="all">{t.allPlatforms}</option>
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {platformLabel(p, locale)}
                      </option>
                    ))}
                  </Select>
                  <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-auto" aria-label={t.allStatuses}>
                    <option value="all">{t.allStatuses}</option>
                    <option value="active">{campaignStatus.active}</option>
                    <option value="paused">{campaignStatus.paused}</option>
                    <option value="ended">{campaignStatus.ended}</option>
                  </Select>
                  <Select value={product} onChange={(e) => setProduct(e.target.value)} className="h-9 w-auto max-w-[240px]" aria-label={t.allProducts}>
                    <option value="all">{t.allProducts}</option>
                    {products.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {visible.length === 0 ? (
                  <EmptyState title={t.emptyTitle} description={t.emptyDesc} />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
                    <table className="w-full min-w-[1400px] text-sm">
                      <thead>
                        <tr className="border-b border-line bg-paper">
                          <th className="w-8 px-3 py-2.5">
                            <input
                              type="checkbox"
                              aria-label={t.selectAll}
                              checked={allVisibleSelected}
                              onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((r) => r.c.id)) : new Set())}
                              className="size-4 accent-[var(--color-primary)]"
                            />
                          </th>
                          <SortableTh label={a.campaign} sortKey="name" sort={sort} onSort={onSort} align="start" />
                          <SortableTh label={c.status} sortKey="status" sort={sort} onSort={onSort} align="start" />
                          <SortableTh label={t.colBudget} title={t.tipBudget} sortKey="budget" sort={sort} onSort={onSort} />
                          <SortableTh label={a.spend} sortKey="spend" sort={sort} onSort={onSort} />
                          <SortableTh label={a.orders} sortKey="orders" sort={sort} onSort={onSort} />
                          <SortableTh label={a.confPct} title={a.tipConf} sortKey="conf" sort={sort} onSort={onSort} />
                          <SortableTh label={a.delivPct} title={a.tipDeliv} sortKey="deliv" sort={sort} onSort={onSort} />
                          <SortableTh label={a.cpo} title={a.tipCpo} sortKey="cpo" sort={sort} onSort={onSort} />
                          <SortableTh label={a.cpco} title={a.tipCpco} sortKey="cpco" sort={sort} onSort={onSort} />
                          <SortableTh label={a.cpd} title={a.tipCpd} sortKey="cpd" sort={sort} onSort={onSort} />
                          <SortableTh label={t.colBe} title={t.tipBe} sortKey="be" sort={sort} onSort={onSort} />
                          <SortableTh label={a.roas} title={a.tipRoas} sortKey="roas" sort={sort} onSort={onSort} />
                          <SortableTh label={a.netProfit} sortKey="net" sort={sort} onSort={onSort} />
                          <th className={thClass}>{a.verdict}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((r) => {
                          const isOpen = expanded.has(r.c.id);
                          return (
                            <Fragment key={r.c.id}>
                              <tr className={cn("cursor-pointer border-b border-line hover:bg-paper", isOpen && "bg-paper")} onClick={() => toggleExpanded(r.c.id)} aria-expanded={isOpen}>
                                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                  <input type="checkbox" aria-label={fmt(t.selectRow, { name: r.c.name })} checked={selected.has(r.c.id)} onChange={() => toggleSelected(r.c.id)} className="size-4 accent-[var(--color-primary)]" />
                                </td>
                                <td className="max-w-[320px] px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    {isOpen ? <ChevronDown className="size-4 shrink-0 text-ink-soft" /> : <ChevronRight className="size-4 shrink-0 text-ink-soft rtl:rotate-180" />}
                                    <PlatformChip platform={r.c.platform} />
                                    <div className="min-w-0">
                                      <Link to={`/ads/${r.c.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-ink hover:text-primary">
                                        {r.c.name}
                                      </Link>
                                      <p className="truncate text-xs text-ink-soft">{r.c.productName ?? t.noProduct}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-2">
                                    <Toggle checked={r.c.status === "active"} disabled={r.c.status === "ended"} onChange={(on) => void setStatus1(r.c.id, on ? "active" : "paused")} label={undefined} />
                                    <StatusBadge value={campaignStatus[r.c.status]} tone={r.c.status === "active" ? "success" : r.c.status === "paused" ? "warning" : "neutral"} />
                                  </div>
                                </td>
                                <td className={tdNum}>
                                  <BudgetCell campaign={r.c} currency={currency} onSave={(minor) => saveBudget(r.c.id, minor)} />
                                </td>
                                <td className={cn(tdNum, "text-ink")}>
                                  <Num>{formatMoney(r.c.spendAmount, currency)}</Num>
                                </td>
                                <td className={cn(tdNum, "text-ink-soft")}>
                                  <Num>{r.c.orders.toLocaleString(intlLocale)}</Num>
                                </td>
                                <td className={cn(tdNum, "text-ink-soft")}>
                                  <Num>{fmtPct(r.m.confirmationRate)}</Num>
                                </td>
                                <td className={cn(tdNum, "text-ink-soft")}>
                                  <Num>{fmtPct(r.m.deliveryRate)}</Num>
                                </td>
                                <td className={cn(tdNum, "text-ink-soft")}>
                                  <Num>{money(r.m.cpo, currency)}</Num>
                                </td>
                                <td className={cn(tdNum, "text-ink-soft")}>
                                  <Num>{money(r.m.cpco, currency)}</Num>
                                </td>
                                <td className={cn(tdNum, "font-medium text-ink")}>
                                  <Num>{money(r.m.cpd, currency)}</Num>
                                </td>
                                <td className={cn(tdNum, "text-ink-soft")}>
                                  <Num>{money(r.breakEvenCpd, currency)}</Num>
                                </td>
                                <td className={cn(tdNum, "text-ink-soft")}>
                                  <Num>{fmtX(r.m.roas)}</Num>
                                </td>
                                <td className={cn(tdNum, "font-medium", r.m.netProfit < 0 ? "text-danger" : "text-success")}>
                                  <Num>{formatMoney(r.m.netProfit, currency)}</Num>
                                </td>
                                <td className="px-3 py-2.5">
                                  <VerdictPill verdict={r.verdict} />
                                </td>
                              </tr>
                              {isOpen && <DrillDown campaign={r.c} breakEvenCpd={r.breakEvenCpd} currency={currency} />}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-3 text-xs text-ink-soft">
                  {fmtNodes(t.verdictLegend, {
                    scale: <span className="font-medium text-success">{verdictLabel("scale", locale)}</span>,
                    hold: <span className="font-medium text-warning">{verdictLabel("hold", locale)}</span>,
                    kill: <span className="font-medium text-danger">{verdictLabel("kill", locale)}</span>,
                    profitLink: (
                      <Link to="/profit" className="text-primary hover:underline">
                        {a.profitPage}
                      </Link>
                    ),
                  })}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="font-semibold">{t.rulesTitle}</CardTitle>
                <CardDescription>{t.rulesDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-line">
                  {AD_RULES.map((rule) => (
                    <li key={rule.id} className="py-3">
                      <Toggle checked={rules[rule.id] ?? false} onChange={(on) => setRule(rule.id, on)} label={t[rule.titleKey]} description={t[rule.descriptionKey]} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </DataState>

      <ConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} onConnected={(acc) => state.setData((prev) => (prev ? { ...prev, accounts: [...prev.accounts, acc] } : prev!))} />
    </div>
  );
}
