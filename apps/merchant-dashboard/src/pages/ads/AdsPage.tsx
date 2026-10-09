import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, cn } from "@store-builder/ui";
import {
  profitDeleteAdSpend,
  profitGetCampaigns,
  profitListAdSpend,
  type ProfitAdSpendEntry,
  type ProfitCampaign,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatDate, formatMoney } from "@/lib/format";
import { formatCount, rangeWindows, type AnalyticsRange } from "@/lib/analytics";
import { countOf } from "@/lib/plural";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useViewNavigate } from "@/lib/viewTransition";
import { fmt, useT } from "@/i18n/LocaleContext";
import { AccordionGroup, AccordionSection } from "@/components/Accordion";
import { AdPlatformLabel, AdPlatformMark } from "@/components/AdPlatformMark";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { ContextMenu } from "@/components/ContextMenu";
import { CopyButton } from "@/components/CopyButton";
import { DataState, TilesSkeleton } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import {
  IconAnnounce,
  IconCopy,
  IconDelete,
  IconLink,
  IconPause,
  IconPlay,
  IconPlug,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconSearch,
  IconTool,
  IconUpload,
  IconWallet,
  IconWarning,
} from "@/components/icons";
import { KpiCard } from "@/components/KpiCard";
import { ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { RangeSwitch } from "@/components/RangeSwitch";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { Fact, Facts } from "@/pages/marketing/kit/Facts";
import { MoreMenu } from "@/pages/marketing/kit/MoreMenu";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction, rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { AD_ACCOUNT_STRINGS } from "./adAccountStrings";
import { AddSpendSheet, ImportSpendSheet } from "./AdSpendSheets";
import { ADS_STRINGS } from "./adsStrings";
import { useCampaignControls, type CampaignControl } from "./CampaignControls";

type Tab = "campaigns" | "entries";
const isTab = (value: string | null): value is Tab => value === "campaigns" || value === "entries";

const CAMPAIGN_COLUMNS = "grid-cols-[minmax(0,1.6fr)_repeat(7,max-content)]";
const CAMPAIGN_COLUMNS_CONTROLLED = "grid-cols-[minmax(0,1.6fr)_repeat(8,max-content)]";
const ENTRY_COLUMNS = "grid-cols-[max-content_minmax(0,1.4fr)_repeat(5,max-content)]";

const campaignKey = (c: ProfitCampaign) => `${c.platform}:${c.campaignName}`;
const fold = (text: string) => text.trim().toLowerCase();

/** A figure in its own direction, so it never flips inside an Arabic line. */
function Num({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("tabular-nums", className)}>
      {children}
    </bdi>
  );
}

/**
 * Ad spend (SPEC §15.4): spend per campaign against real orders, the spend
 * entries behind it, manual entry and CSV import.
 *
 * Top to bottom: the header («ضيف مصاريف», and «أدوات» for import, the ad
 * accounts and refresh), ONE toolbar (search by campaign, the period), the two
 * views as chips with their counts, four figures, then the list — cards on a
 * phone, a sheet of rows from a wide screen. A campaign opens its preview with
 * every figure and, where an ad account is followed, pause / resume and the
 * daily budget. `?tab=entries` opens the spend entries.
 */
export function AdsPage() {
  const t = useT(ADS_STRINGS);
  const at = useT(AD_ACCOUNT_STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const compact = useIsCompact();
  const phone = useIsPhone();
  const copy = useCopy();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const tab: Tab = isTab(rawTab) ? rawTab : "campaigns";
  function selectTab(next: Tab) {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === "campaigns") out.delete("tab");
        else out.set("tab", next);
        return out;
      },
      { replace: true }
    );
  }

  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [search, setSearch] = useState("");
  // The add sheet, with the campaign name it starts from (a campaign that brought orders with no spend).
  const [adding, setAdding] = useState<{ campaign: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [peek, setPeek] = useState<{ key: string; open: boolean } | null>(null);
  const [deleting, setDeleting] = useState<ProfitAdSpendEntry | null>(null);

  const window = rangeWindows(range).current;
  const report = useAsync(() => profitGetCampaigns(apiClient, workspaceId, window), [workspaceId, range]);
  const entries = useAsync(
    () => profitListAdSpend(apiClient, workspaceId, { from: window.from.slice(0, 10), to: window.to.slice(0, 10) }),
    [workspaceId, range]
  );
  const refresh = () => {
    void report.refresh({ silent: true });
    void entries.refresh({ silent: true });
  };

  const data = report.data;
  const currency = data?.currency ?? "EGP";
  const money = (v: number | null) => (v === null ? "—" : formatMoney(v, currency));
  const roas = (v: number | null) => (v === null ? "—" : `${v.toFixed(2)}×`);
  // Pause / resume and daily budget of a campaign, once an ad account is followed (handoff 261).
  const controls = useCampaignControls(workspaceId, currency);

  const query = fold(search);
  const campaigns = useMemo(
    () => (data?.campaigns ?? []).filter((c) => !query || fold(c.campaignName).includes(query)),
    [data?.campaigns, query]
  );
  const entryRows = useMemo(
    () => (entries.data?.entries ?? []).filter((e) => !query || fold(e.campaignName).includes(query)),
    [entries.data?.entries, query]
  );
  const peeked = peek ? ((data?.campaigns ?? []).find((c) => campaignKey(c) === peek.key) ?? null) : null;
  const peekedControl = peeked ? controls.of(peeked) : null;

  const chips: ChipItem<Tab>[] = [
    { value: "campaigns", label: t.tabCampaigns, count: data ? data.campaigns.length : null },
    { value: "entries", label: t.tabEntries, count: entries.data ? entries.data.total : null },
  ];

  const tools: ContextMenuItem[] = [
    { id: "import", label: t.importCsv, icon: IconUpload, onSelect: () => setImporting(true) },
    { id: "accounts", label: t.accounts, icon: IconPlug, onSelect: () => navigate("/ads/accounts") },
    { id: "refresh", label: t.refresh, icon: IconRefresh, separatorBefore: true, onSelect: refresh },
  ];

  const addButton = (
    <Button type="button" className="min-h-11 rounded-full px-5" onClick={() => setAdding({ campaign: "" })}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.addSpend}
    </Button>
  );

  const roasTone = (c: ProfitCampaign) => (c.realRoas === null ? "neutral" : c.realRoas >= 1 ? "success" : "danger");

  function campaignMenu(c: ProfitCampaign, control: CampaignControl | null): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    if (control) {
      items.push({ id: "status", label: control.paused ? at.resume : at.pause, icon: control.paused ? IconPlay : IconPause, onSelect: control.openStatus });
      items.push({ id: "budget", label: at.budget, icon: IconWallet, onSelect: control.openBudget });
    }
    items.push({ id: "add", label: t.addSpend, icon: IconPlus, separatorBefore: items.length > 0, onSelect: () => setAdding({ campaign: c.campaignName }) });
    items.push({ id: "copy", label: t.copyName, icon: IconCopy, onSelect: () => copy(c.campaignName, t.copiedName) });
    return items;
  }

  const anyControl = controls.any && campaigns.some((c) => controls.of(c) !== null);

  const campaignRows = campaigns.map((c) => {
    const key = campaignKey(c);
    const control = controls.of(c);
    const onPeek = () => setPeek({ key, open: true });
    const keys = rowKeyProps(onPeek, onPeek);
    const menu = campaignMenu(c, control);
    const peekLabel = fmt(t.peekCampaign, { name: c.campaignName });
    const action = control ? (
      <RowAction label={control.paused ? at.resume : at.pause} icon={control.paused ? IconPlay : IconPause} tone="quiet" onClick={control.openStatus} />
    ) : null;
    const state = control?.status ? (
      <StatusBadge value={control.status} tone={control.paused ? "neutral" : "success"} text={control.paused ? at.statusPaused : at.statusActive} />
    ) : null;

    if (compact) {
      return (
        <li key={key}>
          <ContextMenu items={menu} label={t.menuCampaign}>
            <ListRowCard
              leading={<AdPlatformMark platform={c.platform} decorative className="h-7 w-9" />}
              title={<bdi dir="auto">{c.campaignName}</bdi>}
              amount={<Num>{money(c.spendAmount)}</Num>}
              status={
                <StatusBadge
                  value="roas"
                  tone={roasTone(c)}
                  text={c.realRoas === null ? t.noRoas : fmt(t.roasChip, { roas: roas(c.realRoas) })}
                />
              }
              meta={fmt(t.deliveredOf, { delivered: c.delivered, orders: countOf("order", c.orders) })}
              action={action}
              footer={state}
              onOpen={onPeek}
              openLabel={peekLabel}
              aria-haspopup="dialog"
              {...keys}
            />
          </ContextMenu>
        </li>
      );
    }
    return (
      <DeskRow key={key} onOpen={onPeek} openLabel={peekLabel} keyProps={keys} current={peek?.open === true && peek.key === key} menu={menu} menuLabel={t.menuCampaign}>
        <div className="min-w-0">
          <p dir="auto" className="truncate text-[15px] leading-6 font-medium text-ink">
            {c.campaignName}
          </p>
          <p className="flex min-w-0 items-center gap-2 text-xs leading-5 text-ink-soft">
            <AdPlatformLabel platform={c.platform}>{t[c.platform]}</AdPlatformLabel>
            {state}
          </p>
        </div>
        <Num className="text-end font-medium">{money(c.spendAmount)}</Num>
        <Num className="text-end">{formatCount(c.orders)}</Num>
        <Num className="text-end">{formatCount(c.confirmed)}</Num>
        <Num className="text-end">{formatCount(c.delivered)}</Num>
        <Num className="text-end">{money(c.deliveredSalesAmount)}</Num>
        <Num className="text-end">{money(c.realCpa)}</Num>
        <Num className={cn("text-end font-semibold", c.realRoas !== null && (c.realRoas >= 1 ? "text-success" : "text-danger"))}>{roas(c.realRoas)}</Num>
        {anyControl && <div className="flex items-center justify-end">{action}</div>}
      </DeskRow>
    );
  });

  const entryList = entryRows.map((e) => {
    const menu: ContextMenuItem[] = [
      { id: "copy", label: t.copyName, icon: IconCopy, onSelect: () => copy(e.campaignName, t.copiedName) },
      { id: "delete", label: t.delete, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setDeleting(e) },
    ];
    const remove = <RowAction label={t.delete} icon={IconDelete} tone="danger" onClick={() => setDeleting(e)} />;
    if (compact) {
      return (
        <li key={e.id}>
          <ContextMenu items={menu} label={t.menuEntry}>
            <ListRowCard
              leading={<AdPlatformMark platform={e.platform} decorative className="h-7 w-9" />}
              title={<bdi dir="auto">{e.campaignName}</bdi>}
              amount={<Num>{money(e.spendAmount)}</Num>}
              status={<StatusBadge value={e.source} tone="neutral" text={t[e.source]} />}
              meta={formatDate(e.day)}
              action={remove}
              footer={
                (e.impressions !== null || e.clicks !== null) && (
                  <span className="text-xs text-ink-soft">
                    {t.impressions} <Num>{formatCount(e.impressions)}</Num> · {t.clicks} <Num>{formatCount(e.clicks)}</Num>
                  </span>
                )
              }
            />
          </ContextMenu>
        </li>
      );
    }
    return (
      <DeskRow key={e.id} menu={menu} menuLabel={t.menuEntry}>
        <span className="text-sm whitespace-nowrap text-ink">{formatDate(e.day)}</span>
        <div className="min-w-0">
          <p dir="auto" className="truncate text-sm leading-6 font-medium text-ink">
            {e.campaignName}
          </p>
          <p className="text-xs leading-5 text-ink-soft">
            <AdPlatformLabel platform={e.platform}>{t[e.platform]}</AdPlatformLabel>
          </p>
        </div>
        <Num className="text-end font-medium">{money(e.spendAmount)}</Num>
        <Num className="text-end">{formatCount(e.impressions)}</Num>
        <Num className="text-end">{formatCount(e.clicks)}</Num>
        <span className="text-[13px] text-ink-soft">{t[e.source]}</span>
        <div className="flex items-center justify-end">{remove}</div>
      </DeskRow>
    );
  });

  const noMatch = (
    <EmptyState
      icon={<IconSearch aria-hidden />}
      title={t.emptySearch}
      action={
        <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => setSearch("")}>
          {t.clearSearch}
        </Button>
      }
    />
  );

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader
        title={t.title}
        // A phone keeps the first screen for the figures and the list: the sentence is for wider screens.
        description={phone ? undefined : t.description}
        actions={<MoreMenu variant="pill" label={t.tools} icon={IconTool} items={tools} />}
        primaryAction={addButton}
      />

      <div className="flex flex-col gap-3">
        <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }}>
          <RangeSwitch value={range} onChange={setRange} compare={false} className="[&_select]:h-11 [&_select]:rounded-full" />
        </ListToolbar>
        <ChipRow items={chips} value={tab} onChange={selectTab} label={t.tabsLabel} collapseEmpty={false} countsLoading={report.loading || entries.loading} />

        <DataState
          loading={report.loading && !data}
          error={data ? null : report.error}
          onRetry={() => void report.refresh()}
          skeleton={
            <div className="flex flex-col gap-3">
              <TilesSkeleton />
              <ListSkeleton variant={compact ? "card" : "table"} rows={5} />
            </div>
          }
        >
          {data && (
            <div className="flex flex-col gap-[var(--bento-gap)]">
              {data.campaigns.length > 0 && (
                <div className="grid grid-cols-2 gap-[var(--bento-gap)] lg:grid-cols-4">
                  <KpiCard label={t.spend} value={<Num>{money(data.totals.spendAmount)}</Num>} />
                  <KpiCard
                    label={t.delivered}
                    value={<Num>{formatCount(data.totals.delivered)}</Num>}
                    hint={fmt(t.ofOrders, { orders: countOf("order", data.totals.orders) })}
                  />
                  <KpiCard label={t.realCpa} value={<Num>{money(data.totals.realCpa)}</Num>} hint={t.realCpaHint} />
                  <KpiCard label={t.realRoas} value={<Num>{roas(data.totals.realRoas)}</Num>} hint={t.realRoasHint} />
                </div>
              )}

              {tab === "campaigns" ? (
                data.campaigns.length === 0 ? (
                  <EmptyState
                    icon={<IconAnnounce aria-hidden />}
                    title={t.emptyTitle}
                    description={t.emptyDesc}
                    action={
                      <Button type="button" className="rounded-full px-5" onClick={() => setAdding({ campaign: "" })}>
                        <IconPlus className="size-4" weight="bold" aria-hidden />
                        {t.addSpend}
                      </Button>
                    }
                  />
                ) : campaigns.length === 0 ? (
                  noMatch
                ) : compact ? (
                  <ul aria-label={t.tabCampaigns} className="flex flex-col gap-2.5">
                    {campaignRows}
                  </ul>
                ) : (
                  <DeskList
                    columns={anyControl ? CAMPAIGN_COLUMNS_CONTROLLED : CAMPAIGN_COLUMNS}
                    label={t.tabCampaigns}
                    head={[
                      { label: t.campaign },
                      { label: t.spend, end: true },
                      { label: t.orders, end: true },
                      { label: t.confirmed, end: true },
                      { label: t.delivered, end: true },
                      { label: t.deliveredSales, end: true },
                      { label: t.realCpa, end: true },
                      { label: t.realRoas, end: true },
                      ...(anyControl ? [{ label: t.action, end: true }] : []),
                    ]}
                  >
                    {campaignRows}
                  </DeskList>
                )
              ) : (
                <DataState
                  loading={entries.loading && !entries.data}
                  error={entries.data ? null : entries.error}
                  onRetry={() => void entries.refresh()}
                  skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}
                >
                  {(entries.data?.entries.length ?? 0) === 0 ? (
                    <EmptyState
                      icon={<IconReceipt aria-hidden />}
                      title={t.noEntries}
                      description={t.noEntriesDesc}
                      action={
                        <Button type="button" className="rounded-full px-5" onClick={() => setAdding({ campaign: "" })}>
                          <IconPlus className="size-4" weight="bold" aria-hidden />
                          {t.addSpend}
                        </Button>
                      }
                    />
                  ) : entryRows.length === 0 ? (
                    noMatch
                  ) : compact ? (
                    <ul aria-label={t.tabEntries} className="flex flex-col gap-2.5">
                      {entryList}
                    </ul>
                  ) : (
                    <DeskList
                      columns={ENTRY_COLUMNS}
                      label={t.tabEntries}
                      head={[
                        { label: t.day },
                        { label: t.campaign },
                        { label: t.spend, end: true },
                        { label: t.impressions, end: true },
                        { label: t.clicks, end: true },
                        { label: t.source },
                        { label: t.action, end: true },
                      ]}
                    >
                      {entryList}
                    </DeskList>
                  )}
                </DataState>
              )}

              {tab === "campaigns" && (
                <AccordionGroup>
                  {data.withoutSpend.length > 0 && (
                    <AccordionSection
                      title={t.withoutSpendTitle}
                      summary={t.withoutSpendDesc}
                      icon={IconWarning}
                      badge={<Num className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-dark">{formatCount(data.withoutSpend.length)}</Num>}
                      persistKey="ads:without-spend"
                    >
                      <p className="text-[13px] leading-5 text-ink-soft">{t.withoutSpendDesc}</p>
                      <ul className="mt-2 divide-y divide-line">
                        {data.withoutSpend.map((c) => (
                          <li key={c.campaign} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
                            <div className="min-w-0">
                              <p dir="ltr" className="truncate text-start text-sm font-medium text-ink">
                                {c.campaign}
                              </p>
                              <p className="text-xs leading-5 text-ink-soft">
                                {fmt(t.deliveredOf, { delivered: c.delivered, orders: countOf("order", c.orders) })} · <Num>{money(c.salesAmount)}</Num>
                              </p>
                            </div>
                            <RowAction label={t.recordSpend} icon={IconPlus} tone="quiet" onClick={() => setAdding({ campaign: c.campaign })} />
                          </li>
                        ))}
                      </ul>
                    </AccordionSection>
                  )}
                  <AccordionSection title={t.urlTitle} summary={t.urlDesc} icon={IconLink} persistKey="ads:url-params">
                    <p className="text-[13px] leading-5 text-ink-soft">{t.urlDesc}</p>
                    <ul className="mt-3 space-y-3">
                      {(["meta", "tiktok", "snapchat", "google"] as const).map((p) => (
                        <li key={p}>
                          <div className="flex items-center justify-between gap-2">
                            <AdPlatformLabel platform={p} className="text-sm font-medium text-ink">
                              {t[p]}
                            </AdPlatformLabel>
                            <CopyButton value={data.suggestedUrlParameters[p]} label={t.copy} />
                          </div>
                          <code dir="ltr" data-slot="sweep-well" className="mt-1 block overflow-x-auto rounded-2xl bg-paper-sunken px-4 py-2.5 text-start text-xs leading-5 text-ink">
                            {data.suggestedUrlParameters[p]}
                          </code>
                        </li>
                      ))}
                    </ul>
                  </AccordionSection>
                </AccordionGroup>
              )}
            </div>
          )}
        </DataState>
      </div>

      {/* The preview of a campaign: every figure the row was too narrow for, and its controls. */}
      {peeked && (
        <Sheet
          open={Boolean(peek?.open)}
          onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
          side="auto-end"
          title={<bdi dir="auto">{peeked.campaignName}</bdi>}
          description={<AdPlatformLabel platform={peeked.platform}>{t[peeked.platform]}</AdPlatformLabel>}
          footer={
            <Button
              type="button"
              className="rounded-full px-5"
              onClick={() => {
                setPeek((current) => (current ? { ...current, open: false } : current));
                setAdding({ campaign: peeked.campaignName });
              }}
            >
              <IconPlus className="size-4" weight="bold" aria-hidden />
              {t.addSpend}
            </Button>
          }
        >
          <div className="space-y-5">
            <Facts>
              <Fact label={t.spend}>
                <Num>{money(peeked.spendAmount)}</Num>
              </Fact>
              <Fact label={t.period}>
                {formatDate(peeked.firstDay)} – {formatDate(peeked.lastDay)}
              </Fact>
              <Fact label={t.orders}>
                <Num>{formatCount(peeked.orders)}</Num>
              </Fact>
              <Fact label={t.confirmed}>
                <Num>{formatCount(peeked.confirmed)}</Num>
              </Fact>
              <Fact label={t.delivered}>
                <Num>{formatCount(peeked.delivered)}</Num>
              </Fact>
              <Fact label={t.deliveredSales}>
                <Num>{money(peeked.deliveredSalesAmount)}</Num>
              </Fact>
              <Fact label={t.realCpa}>
                <Num>{money(peeked.realCpa)}</Num>
              </Fact>
              <Fact label={t.realRoas}>
                <Num className={cn(peeked.realRoas !== null && (peeked.realRoas >= 1 ? "text-success" : "text-danger"))}>{roas(peeked.realRoas)}</Num>
              </Fact>
              {peeked.impressions !== null && (
                <Fact label={t.impressions}>
                  <Num>{formatCount(peeked.impressions)}</Num>
                </Fact>
              )}
              {peeked.clicks !== null && (
                <Fact label={t.clicks}>
                  <Num>{formatCount(peeked.clicks)}</Num>
                </Fact>
              )}
            </Facts>

            {peekedControl && (
              <div data-slot="sweep-well" className="rounded-2xl bg-paper-sunken px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{t.control}</p>
                  {peekedControl.status && (
                    <StatusBadge
                      value={peekedControl.status}
                      tone={peekedControl.paused ? "neutral" : "success"}
                      text={peekedControl.paused ? at.statusPaused : at.statusActive}
                    />
                  )}
                </div>
                {peekedControl.updatedAt && (
                  <p className="mt-0.5 text-xs leading-5 text-ink-soft">{fmt(at.lastSet, { when: formatRelativeTime(peekedControl.updatedAt) })}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <RowAction
                    label={peekedControl.paused ? at.resume : at.pause}
                    icon={peekedControl.paused ? IconPlay : IconPause}
                    tone="quiet"
                    onClick={() => {
                      setPeek((current) => (current ? { ...current, open: false } : current));
                      peekedControl.openStatus();
                    }}
                  />
                  <RowAction
                    label={
                      peekedControl.dailyBudgetAmount
                        ? fmt(at.budgetIs, { amount: formatMoney(peekedControl.dailyBudgetAmount, peekedControl.currency) })
                        : at.budget
                    }
                    icon={IconWallet}
                    tone="quiet"
                    onClick={() => {
                      setPeek((current) => (current ? { ...current, open: false } : current));
                      peekedControl.openBudget();
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </Sheet>
      )}

      {controls.dialogs}
      {adding && (
        <AddSpendSheet
          workspaceId={workspaceId}
          currency={currency}
          campaign={adding.campaign}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            refresh();
          }}
        />
      )}
      {importing && (
        <ImportSpendSheet
          workspaceId={workspaceId}
          onClose={() => setImporting(false)}
          onImported={() => {
            setImporting(false);
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t.deleteTitle}
        description={
          deleting ? fmt(t.deleteBody, { amount: money(deleting.spendAmount), day: formatDate(deleting.day), campaign: deleting.campaignName }) : undefined
        }
        confirmLabel={t.delete}
        busyLabel={t.deleting}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await profitDeleteAdSpend(apiClient, workspaceId, deleting.id);
          setDeleting(null);
          toast.success(t.deleted);
          refresh();
        }}
      />
    </div>
  );
}
