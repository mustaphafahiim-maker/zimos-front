import { Fragment, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Download, Pause, Play, Plug, RefreshCw, Search } from "lucide-react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, cn } from "@store-builder/ui";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, formatDateTime, majorToMinor, minorToMajorInput } from "@/lib/format";
import { mockApi } from "@/mock/api";
import type { AdAccount, AdCreative, AdSet, Campaign } from "@/mock/types2";
import { computeMetrics, fmtPct, fmtX, PLATFORM_LABEL, verdictFor, withEstimatedCost, type AdMetrics } from "@/lib/adMetrics";
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
import { PlatformChip, VerdictPill, breakEvenCpdFor, tdNum, thClass } from "./adsShared";

// ------------------------------------------------------------ helpers --

const RANGE_DAYS: Record<AnalyticsRange, number> = { "7d": 7, "30d": 30, "90d": 90 };
const PLATFORMS: Array<AdAccount["platform"]> = ["facebook", "tiktok", "snapchat", "google"];

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

interface AdRule {
  id: string;
  title: string;
  description: string;
}

const AD_RULES: AdRule[] = [
  { id: "pause-over-be", title: "Pause ad set if CPD > break-even for 2 days", description: "Checks every morning at 09:00. Ad sets whose cost per delivered order exceeds the product's break-even CPD on two consecutive days are paused on the platform." },
  { id: "scale-winners", title: "Increase budget 20% if ROAS > 3 and CPD < 70% of break-even", description: "Once per day, capped at 2 increases per campaign per week so the algorithm has time to re-learn." },
  { id: "notify-zero-conf", title: "Notify on WhatsApp if spend > 5,000 EGP with 0 confirmed orders", description: "Sends a WhatsApp alert to the workspace owner — usually a broken pixel, a dead landing page or a confirmation team backlog." },
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

function SortableTh({ label, sortKey, sort, onSort, align = "right", className }: { label: string; sortKey: SortKey; sort: { key: SortKey; dir: "asc" | "desc" }; onSort: (k: SortKey) => void; align?: "left" | "right"; className?: string }) {
  const active = sort.key === sortKey;
  return (
    <th className={cn(thClass, align === "right" && "text-right", className)}>
      <button type="button" onClick={() => onSort(sortKey)} className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
        {label}
        {active && (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
}

function BudgetCell({ campaign, currency, onSave }: { campaign: Campaign; currency: string; onSave: (minor: number) => Promise<void> }) {
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
          min={0}
          step="1"
          value={value}
          disabled={busy}
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
    <button type="button" onClick={start} className="rounded px-1 tabular-nums text-ink underline decoration-dotted underline-offset-4 hover:bg-paper-raised hover:text-primary" title="Click to edit daily budget">
      {formatMoney(campaign.dailyBudgetAmount, currency)}
    </button>
  );
}

function MetricCells({ stats, breakEvenCpd, currency }: { stats: Parameters<typeof computeMetrics>[0]; breakEvenCpd: number | null; currency: string }) {
  const m = computeMetrics(stats);
  const verdict = verdictFor(m.cpd, breakEvenCpd);
  return (
    <>
      <td className={cn(tdNum, "text-ink")}>{formatMoney(stats.spendAmount, currency)}</td>
      <td className={cn(tdNum, "text-ink-soft")}>{stats.orders.toLocaleString()}</td>
      <td className={cn(tdNum, "text-ink-soft")}>{fmtPct(m.confirmationRate)}</td>
      <td className={cn(tdNum, "text-ink-soft")}>{fmtPct(m.deliveryRate)}</td>
      <td className={cn(tdNum, "text-ink-soft")}>{money(m.cpo, currency)}</td>
      <td className={cn(tdNum, "text-ink-soft")}>{money(m.cpco, currency)}</td>
      <td className={cn(tdNum, "font-medium text-ink")}>{money(m.cpd, currency)}</td>
      <td className={cn(tdNum, "text-ink-soft")}>{fmtX(m.roas)}</td>
      <td className={cn(tdNum, "font-medium", m.netProfit < 0 ? "text-danger" : "text-success")}>{formatMoney(m.netProfit, currency)}</td>
      <td className="px-3 py-2">
        <VerdictPill verdict={verdict} />
      </td>
    </>
  );
}

function CreativeRow({ creative, campaign, breakEvenCpd, currency }: { creative: AdCreative; campaign: Campaign; breakEvenCpd: number | null; currency: string }) {
  return (
    <tr className="border-b border-line/60 bg-paper text-xs last:border-0">
      <td className="px-3 py-2 pl-14">
        <div className="flex items-center gap-2">
          <span className="size-6 shrink-0 rounded" style={{ background: creative.thumbnailColor }} />
          <span className="truncate text-ink">{creative.name}</span>
          <span className="rounded border border-line bg-paper-raised px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-soft">{creative.format}</span>
        </div>
      </td>
      <MetricCells stats={withEstimatedCost(creative, campaign)} breakEvenCpd={breakEvenCpd} currency={currency} />
    </tr>
  );
}

function AdSetRows({ adSet, campaign, breakEvenCpd, currency, expanded, onToggle }: { adSet: AdSet; campaign: Campaign; breakEvenCpd: number | null; currency: string; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="cursor-pointer border-b border-line/60 bg-paper-raised/60 text-sm hover:bg-paper-raised" onClick={onToggle}>
        <td className="px-3 py-2 pl-8">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="size-3.5 text-ink-soft" /> : <ChevronRight className="size-3.5 text-ink-soft" />}
            <span className="truncate text-ink">{adSet.name}</span>
            <span className="text-xs text-ink-soft">· {adSet.creatives.length} creatives</span>
          </div>
        </td>
        <MetricCells stats={withEstimatedCost(adSet, campaign)} breakEvenCpd={breakEvenCpd} currency={currency} />
      </tr>
      {expanded && adSet.creatives.map((cr) => <CreativeRow key={cr.id} creative={cr} campaign={campaign} breakEvenCpd={breakEvenCpd} currency={currency} />)}
    </>
  );
}

function DrillDown({ campaign, breakEvenCpd, currency }: { campaign: Campaign; breakEvenCpd: number | null; currency: string }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  return (
    <tr className="border-b border-line">
      <td colSpan={16} className="bg-paper-raised/40 p-0">
        <div className="overflow-x-auto border-l-2 border-primary/40">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-1.5 pl-8 text-left font-medium">Ad set / creative</th>
                {["Spend", "Orders", "Conf %", "Deliv %", "CPO", "CPCO", "CPD", "ROAS", "Net profit"].map((h) => (
                  <th key={h} className="px-3 py-1.5 text-right font-medium">
                    {h}
                  </th>
                ))}
                <th className="px-3 py-1.5 text-left font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {campaign.adSets.map((s) => (
                <AdSetRows key={s.id} adSet={s} campaign={campaign} breakEvenCpd={breakEvenCpd} currency={currency} expanded={open.has(s.id)} onToggle={() => toggle(s.id)} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-2 text-xs text-ink-soft">
          <span>Ad set and creative net profit uses the campaign's average cost per delivered order.</span>
          <Link to={`/ads/${campaign.id}`} className="font-medium text-primary hover:underline">
            Open campaign →
          </Link>
        </div>
      </td>
    </tr>
  );
}

function ConnectModal({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: (acc: AdAccount) => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [platform, setPlatform] = useState<AdAccount["platform"]>("facebook");
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    try {
      const acc = await mockApi.connectAdAccount(workspaceId, platform, `${PLATFORM_LABEL[platform]} — New account`);
      onConnected(acc);
      toast.success(`${PLATFORM_LABEL[platform]} ad account connected.`);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect ad account"
      description="Zimos reads spend, impressions and clicks from the platform and matches them to your orders via utm_campaign, fbclid and ttclid."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void connect()} disabled={busy}>
            <Plug />
            {busy ? "Connecting…" : `Continue with ${PLATFORM_LABEL[platform]}`}
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
            className={cn(
              "rounded-[0.5rem] border px-3 py-3 text-sm font-medium transition-colors",
              platform === p ? "border-primary bg-primary-soft text-primary-dark" : "border-line text-ink hover:border-primary/40"
            )}
          >
            {PLATFORM_LABEL[p]}
          </button>
        ))}
      </div>
      <ol className="mt-4 space-y-2 text-sm text-ink-soft">
        <li>1. You'll be redirected to {PLATFORM_LABEL[platform]} to sign in and pick an ad account.</li>
        <li>2. Zimos asks for read access to ads insights and write access to pause / resume and change budgets.</li>
        <li>3. Spend syncs every 15 minutes; orders are attributed by click id and UTM.</li>
      </ol>
      <Alert variant="info" className="mt-4 text-xs">
        Demo mode: this creates a mock account locally. No real OAuth call is made.
      </Alert>
    </Modal>
  );
}

function AccountsStrip({ accounts, currency, onReconnect, onConnect }: { accounts: AdAccount[]; currency: string; onReconnect: (id: string) => Promise<void>; onConnect: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {accounts.map((a) => (
        <div key={a.id} className="flex min-w-[260px] shrink-0 flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-paper-raised px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <PlatformChip platform={a.platform} />
            <StatusBadge value={a.status} tone={a.status === "connected" ? "success" : a.status === "token_expired" ? "warning" : "neutral"} />
          </div>
          <p className="truncate text-sm font-medium text-ink">{a.name}</p>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ink-soft">Spend today</p>
              <p className="font-display text-lg font-medium tabular-nums text-ink">{formatMoney(a.spendTodayAmount, currency)}</p>
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
                Reconnect
              </Button>
            ) : (
              <span className="text-[11px] text-ink-soft">Synced {a.lastSyncAt ? formatDateTime(a.lastSyncAt) : "never"}</span>
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onConnect}
        className="flex min-w-[200px] shrink-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] border border-dashed border-line px-4 py-3 text-sm text-ink-soft transition-colors hover:border-primary/40 hover:text-primary"
      >
        <Plug className="size-5" />
        Connect ad account
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- page --

export function AdsPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
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
      .map(([date, v]) => ({ label: shortDate(date), ...v }));
  }, [data, range]);

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
    toast.success(`${ids.length} campaign${ids.length === 1 ? "" : "s"} ${next === "active" ? "activated" : "paused"}.`);
  }

  async function saveBudget(id: string, minor: number) {
    patchCampaign(id, { dailyBudgetAmount: minor });
    await mockApi.setCampaignBudget(workspaceId, id, minor);
    toast.success("Daily budget updated.");
  }

  async function reconnect(id: string) {
    await mockApi.reconnectAdAccount(workspaceId, id);
    await state.refresh({ silent: true });
    toast.success("Ad account reconnected.");
  }

  function exportCsv() {
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
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const kpiCards: Array<{ label: string; value: ReactNode; hint: string; tone?: string }> = [
    { label: "Spend", value: formatMoney(Math.round(kpi.spend), currency), hint: `Across ${data?.accounts.length ?? 0} ad accounts` },
    { label: "Orders", value: kpi.orders.toLocaleString(), hint: "Placed, before confirmation" },
    { label: "CPCO", value: money(kpi.cpco, currency), hint: "Spend ÷ confirmed orders" },
    { label: "CPD", value: money(kpi.cpd, currency), hint: "Spend ÷ delivered orders" },
    { label: "Real ROAS", value: fmtX(kpi.roas), hint: "Delivered revenue only ÷ spend" },
    { label: "Net profit", value: <span className={kpi.net < 0 ? "text-danger" : "text-success"}>{formatMoney(Math.round(kpi.net), currency)}</span>, hint: "Revenue − spend − cost of delivered" },
  ];

  return (
    <div className="max-w-7xl">
      <PageHeader
        title="Ads & media buying"
        description="Every campaign measured on what a COD business actually keeps: cost per delivered order and net profit, not platform ROAS."
        actions={
          <>
            <RangeSwitch value={range} onChange={setRange} />
            <Button variant="outline" size="sm" disabled={visible.length === 0} onClick={exportCsv}>
              <Download />
              Export CSV
            </Button>
          </>
        }
      />

      <DataState loading={state.loading && !data} error={state.error} onRetry={() => state.refresh()}>
        {data && (
          <div className="space-y-6">
            <AccountsStrip accounts={data.accounts} currency={currency} onReconnect={reconnect} onConnect={() => setConnectOpen(true)} />

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {kpiCards.map((k) => (
                <KpiCard key={k.label} label={k.label} value={k.value} hint={k.hint} />
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Spend vs revenue vs net profit</CardTitle>
                <CardDescription>Daily, summed across campaigns. Revenue counts delivered orders only.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { label: "Ad spend", key: "spend" as const, color: "var(--color-accent)" },
                    { label: "Delivered revenue", key: "revenue" as const, color: "var(--color-primary)" },
                    { label: "Net profit", key: "net" as const, color: "var(--color-success)" },
                  ].map((s) => (
                    <div key={s.key}>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">{s.label}</p>
                      <LineAreaChart points={chart.map((d) => ({ label: d.label, value: Math.max(d[s.key], 0) }))} color={s.color} format={(v) => formatMoney(Math.round(v), currency)} height={140} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Campaigns</CardTitle>
                    <CardDescription>Last 30 days. Click a row to drill into ad sets and creatives.</CardDescription>
                  </div>
                  {selected.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-soft">{selected.size} selected</span>
                      <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void bulkStatus("paused")}>
                        <Pause />
                        Pause selected
                      </Button>
                      <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void bulkStatus("active")}>
                        <Play />
                        Activate selected
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns or products" className="h-9 w-64 pl-8" />
                  </div>
                  <Select value={platform} onChange={(e) => setPlatform(e.target.value)} className="h-9 w-auto">
                    <option value="all">All platforms</option>
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {PLATFORM_LABEL[p]}
                      </option>
                    ))}
                  </Select>
                  <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-auto">
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="ended">Ended</option>
                  </Select>
                  <Select value={product} onChange={(e) => setProduct(e.target.value)} className="h-9 w-auto max-w-[240px]">
                    <option value="all">All products</option>
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
                  <EmptyState title="No campaigns match" description="Try clearing the filters or connect an ad account to import campaigns." />
                ) : (
                  <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
                    <table className="w-full min-w-[1400px] text-sm">
                      <thead>
                        <tr className="border-b border-line bg-paper-raised">
                          <th className="w-8 px-3 py-2.5">
                            <input
                              type="checkbox"
                              aria-label="Select all"
                              checked={allVisibleSelected}
                              onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((r) => r.c.id)) : new Set())}
                              className="size-4 accent-[var(--color-primary)]"
                            />
                          </th>
                          <SortableTh label="Campaign" sortKey="name" sort={sort} onSort={onSort} align="left" />
                          <SortableTh label="Status" sortKey="status" sort={sort} onSort={onSort} align="left" />
                          <SortableTh label="Budget/day" sortKey="budget" sort={sort} onSort={onSort} />
                          <SortableTh label="Spend" sortKey="spend" sort={sort} onSort={onSort} />
                          <SortableTh label="Orders" sortKey="orders" sort={sort} onSort={onSort} />
                          <SortableTh label="Conf %" sortKey="conf" sort={sort} onSort={onSort} />
                          <SortableTh label="Deliv %" sortKey="deliv" sort={sort} onSort={onSort} />
                          <SortableTh label="CPO" sortKey="cpo" sort={sort} onSort={onSort} />
                          <SortableTh label="CPCO" sortKey="cpco" sort={sort} onSort={onSort} />
                          <SortableTh label="CPD" sortKey="cpd" sort={sort} onSort={onSort} />
                          <SortableTh label="BE CPD" sortKey="be" sort={sort} onSort={onSort} />
                          <SortableTh label="ROAS" sortKey="roas" sort={sort} onSort={onSort} />
                          <SortableTh label="Net profit" sortKey="net" sort={sort} onSort={onSort} />
                          <th className={thClass}>Verdict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((r) => {
                          const isOpen = expanded.has(r.c.id);
                          return (
                            <Fragment key={r.c.id}>
                              <tr className={cn("cursor-pointer border-b border-line hover:bg-paper-raised", isOpen && "bg-paper-raised")} onClick={() => toggleExpanded(r.c.id)}>
                                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                  <input type="checkbox" aria-label={`Select ${r.c.name}`} checked={selected.has(r.c.id)} onChange={() => toggleSelected(r.c.id)} className="size-4 accent-[var(--color-primary)]" />
                                </td>
                                <td className="max-w-[320px] px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    {isOpen ? <ChevronDown className="size-4 shrink-0 text-ink-soft" /> : <ChevronRight className="size-4 shrink-0 text-ink-soft" />}
                                    <PlatformChip platform={r.c.platform} />
                                    <div className="min-w-0">
                                      <Link to={`/ads/${r.c.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-ink hover:text-primary">
                                        {r.c.name}
                                      </Link>
                                      <p className="truncate text-xs text-ink-soft">{r.c.productName ?? "No product linked"}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-2">
                                    <Toggle checked={r.c.status === "active"} disabled={r.c.status === "ended"} onChange={(on) => void setStatus1(r.c.id, on ? "active" : "paused")} label={undefined} />
                                    <StatusBadge value={r.c.status} tone={r.c.status === "active" ? "success" : r.c.status === "paused" ? "warning" : "neutral"} />
                                  </div>
                                </td>
                                <td className={tdNum}>
                                  <BudgetCell campaign={r.c} currency={currency} onSave={(minor) => saveBudget(r.c.id, minor)} />
                                </td>
                                <td className={cn(tdNum, "text-ink")}>{formatMoney(r.c.spendAmount, currency)}</td>
                                <td className={cn(tdNum, "text-ink-soft")}>{r.c.orders.toLocaleString()}</td>
                                <td className={cn(tdNum, "text-ink-soft")}>{fmtPct(r.m.confirmationRate)}</td>
                                <td className={cn(tdNum, "text-ink-soft")}>{fmtPct(r.m.deliveryRate)}</td>
                                <td className={cn(tdNum, "text-ink-soft")}>{money(r.m.cpo, currency)}</td>
                                <td className={cn(tdNum, "text-ink-soft")}>{money(r.m.cpco, currency)}</td>
                                <td className={cn(tdNum, "font-medium text-ink")}>{money(r.m.cpd, currency)}</td>
                                <td className={cn(tdNum, "text-ink-soft")}>{money(r.breakEvenCpd, currency)}</td>
                                <td className={cn(tdNum, "text-ink-soft")}>{fmtX(r.m.roas)}</td>
                                <td className={cn(tdNum, "font-medium", r.m.netProfit < 0 ? "text-danger" : "text-success")}>{formatMoney(r.m.netProfit, currency)}</td>
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
                  Verdict: CPD below 80% of break-even → <span className="font-medium text-success">Scale</span>, 80–100% → <span className="font-medium text-accent-dark">Hold</span>, above break-even →{" "}
                  <span className="font-medium text-danger">Kill</span>. Break-even comes from each product's cost assumptions on the{" "}
                  <Link to="/profit" className="text-primary hover:underline">
                    Profit page
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rules</CardTitle>
                <CardDescription>Automations that act on your campaigns using confirmation and delivery data the ad platforms never see.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-line">
                  {AD_RULES.map((rule) => (
                    <li key={rule.id} className="py-3">
                      <Toggle checked={rules[rule.id] ?? false} onChange={(on) => setRule(rule.id, on)} label={rule.title} description={rule.description} />
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
