import { useMemo, useState } from "react";
import { Button, cn } from "@store-builder/ui";
import {
  funnelsDelete,
  funnelsList,
  funnelsListSteps,
  funnelsPause,
  funnelsProblemsOf,
  funnelsPublish,
  funnelsResume,
  type FunnelDto,
  type FunnelStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { formatMoney, formatPercentValue } from "@/lib/format";
import { percentToRatio, rangeWindows, type AnalyticsRange } from "@/lib/analytics";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, getIntlLocale, useT } from "@/i18n/LocaleContext";
import {
  IconChart,
  IconClick,
  IconCopy,
  IconDelete,
  IconExternal,
  IconEye,
  IconFunnels,
  IconLayout,
  IconLink,
  IconOrders,
  IconPause,
  IconPlay,
  IconPlus,
  IconRefresh,
  IconLaunch,
  IconSearch,
  IconShare,
  IconStore,
  IconUpload,
  IconWallet,
} from "@/components/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { ChipRow, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { RangeSwitch } from "@/components/RangeSwitch";
import { useToast } from "@/components/Toast";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { duplicateFunnel, funnelPublicUrl, useFunnelErrorMessage } from "./funnelAdapter";
import { FunnelBulkBar } from "./FunnelBulkBar";
import { FunnelShareDialog, FunnelWizardSheet } from "./FunnelWizard";
import { FunnelDesk, FunnelRow } from "./list/FunnelRow";
import { FunnelStats, type FunnelStat } from "./list/FunnelStats";
import { FUNNEL_LIST_STRINGS } from "./list/funnelListStrings";
import { ShareTemplateDialog } from "./marketplace/ShareTemplateDialog";
// Deleted funnels go to the trash (handoff 373).
import { trashRestore } from "@store-builder/api-client";
import { invalidateCached } from "@/lib/useCachedAsync";
import { TrashLink } from "@/pages/trash/TrashLink";

type StatusFilter = "all" | FunnelStatus;
const STATUS_ORDER: FunnelStatus[] = ["published", "draft", "paused"];

function partialIdOf(err: unknown): string | null {
  const id = (err as { partialFunnelId?: unknown } | null)?.partialFunnelId;
  return typeof id === "string" ? id : null;
}

/**
 * /funnels on the list pattern: the header with «فانل جديد» (a bar above the
 * dock on a phone), four compact stat cards, one toolbar (search by name), the
 * statuses as chips with their counts, then the funnels — a card each on a
 * phone, a sheet of rows on a wide screen. A row opens the editor; «…», a
 * right-click or a long press holds the rest; ticking rows raises the bulk bar.
 *
 * The list shows at once from the session's cache on a return visit and
 * refreshes behind. Nothing here changes what is saved or who may do it: the
 * same calls, and a refusal (a role, the plan) is said in words.
 */
export function FunnelsPage() {
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const toast = useToast();
  const t = useT(FUNNEL_LIST_STRINGS);
  const describeError = useFunnelErrorMessage();
  const compact = useIsCompact();
  const phone = useIsPhone();
  const list = useCachedAsync(`funnels:${workspaceId}`, () => funnelsList(apiClient, workspaceId), [workspaceId]);

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<FunnelDto | null>(null);
  const [sharing, setSharing] = useState<FunnelDto | null>(null);
  // The funnel being sent to the template marketplace (handoff 192).
  const [marketing, setMarketing] = useState<FunnelDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const funnels = useMemo(() => list.data ?? [], [list.data]);
  const reload = () => list.refresh({ silent: true });

  // Search and the status chip narrow the list in the browser: the endpoint returns every funnel at once.
  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return funnels.filter(
      (f) => (status === "all" || f.status === status) && (!q || f.name.toLocaleLowerCase().includes(q) || (f.subdomain ?? "").toLocaleLowerCase().includes(q))
    );
  }, [funnels, query, status]);
  const filtered = query.trim() !== "" || status !== "all";

  // Funnels ticked for a bulk action (FunnelBulkBar); only the ones still listed count.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectedFunnels = funnels.filter((f) => selected.has(f.id));
  const allSelected = shown.length > 0 && shown.every((f) => selected.has(f.id));
  const setOne = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(shown.map((f) => f.id)));

  // The list endpoint has no step count; fetch each funnel's steps (read-only, parallel).
  const idsKey = funnels.map((f) => f.id).join(",");
  const stepCounts = useCachedAsync(
    idsKey ? `funnel-steps:${workspaceId}:${idsKey}` : null,
    async () => {
      const entries = await Promise.all(
        funnels.map(async (f) => [f.id, (await funnelsListSteps(apiClient, workspaceId, f.id)).length] as const)
      );
      return new Map(entries);
    },
    [workspaceId, idsKey]
  );

  // Funnel stats need analytics.view; a role without it gets dashes and one sentence, not a 403.
  const { currentWorkspace } = useWorkspace();
  const analyticsAllowed = canViewAnalytics(currentWorkspace?.role);
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const stats = useAsync(
    () =>
      analyticsAllowed ? apiClient.getFunnelAnalytics(workspaceId, rangeWindows(range).current) : Promise.resolve(null),
    [workspaceId, range, analyticsAllowed]
  );
  const statsById = new Map((stats.data?.funnels ?? []).map((row) => [row.id, row]));
  const currency = stats.data?.currency ?? "EGP";
  const totals = stats.data?.totals;
  const digits = new Intl.NumberFormat(getIntlLocale());
  const figure = (value: number | null | undefined, render: (v: number) => string) =>
    value === null || value === undefined ? null : <bdi dir="ltr">{render(value)}</bdi>;
  const statCards: FunnelStat[] = [
    { id: "visits", label: t.kpiVisits, icon: IconEye, value: figure(totals?.sessions, digits.format) },
    { id: "orders", label: t.kpiOrders, icon: IconOrders, value: figure(totals?.orders, digits.format) },
    { id: "revenue", label: t.kpiRevenue, icon: IconWallet, value: figure(totals?.revenue, (v) => formatMoney(v, currency)), hint: t.kpiRevenueHint },
    {
      id: "conversion",
      label: t.kpiConversion,
      icon: IconClick,
      value: figure(totals?.conversionRate, (v) => formatPercentValue(percentToRatio(v))),
      hint: t.kpiConversionHint,
    },
  ];
  const noStatReason = !analyticsAllowed ? t.statsNoAccess : stats.error ? t.statsUnavailable : undefined;

  async function changeStatus(f: FunnelDto) {
    setBusyId(f.id);
    try {
      if (f.status === "published") {
        await funnelsPause(apiClient, workspaceId, f.id);
        // Pausing is undone by resuming: the same permission, the same button.
        toast.undo(fmt(t.toastPaused, { name: f.name }), async () => {
          await funnelsResume(apiClient, workspaceId, f.id);
          await reload();
        });
      } else if (f.status === "paused") {
        await funnelsResume(apiClient, workspaceId, f.id);
        toast.undo(fmt(t.toastResumed, { name: f.name }), async () => {
          await funnelsPause(apiClient, workspaceId, f.id);
          await reload();
        });
      } else {
        await funnelsPublish(apiClient, workspaceId, f.id);
        toast.success(fmt(t.toastLive, { name: f.name }));
      }
      await reload();
    } catch (err) {
      const problems = funnelsProblemsOf(err);
      toast.error(problems.length > 0 ? fmt(t.toastPublishBlocked, { name: f.name, n: problems.length }) : describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(f: FunnelDto) {
    setBusyId(f.id);
    try {
      const copy = await duplicateFunnel(workspaceId, f.id, (name) => fmt(t.copySuffix, { name }));
      toast.success(fmt(t.toastDuplicatedAs, { name: copy.name }));
      void reload();
      navigate(`/funnels/${copy.id}`);
    } catch (err) {
      const partial = partialIdOf(err);
      if (partial) {
        toast.error(fmt(t.toastDuplicatePartial, { message: describeError(err) }));
        void reload();
        navigate(`/funnels/${partial}`);
      } else {
        toast.error(describeError(err));
        await reload();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t.toastCopied);
    } catch {
      toast.error(t.toastCopyFailed);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await funnelsDelete(apiClient, workspaceId, deleting.id);
    } catch (err) {
      throw new Error(describeError(err));
    }
    // In the trash for 30 days: «تراجع» puts it back as it was.
    const gone = deleting;
    invalidateCached("trash:");
    toast.undo(t.toastDeleted, async () => {
      await trashRestore(apiClient, workspaceId, "funnel", gone.id);
      invalidateCached("trash:");
      await reload();
    });
    setOne(deleting.id, false);
    setDeleting(null);
    await reload();
  }

  /** The row's menu: the same list for «…», a right-click and a long press. */
  function menuFor(f: FunnelDto): ContextMenuItem[] {
    const busy = busyId === f.id;
    const url = funnelPublicUrl(f.subdomain);
    const items: ContextMenuItem[] = [];
    if (url) {
      items.push({ id: "preview", label: t.preview, icon: IconExternal, onSelect: () => void window.open(url, "_blank", "noopener,noreferrer") });
      items.push({ id: "copy-link", label: t.copyLink, icon: IconLink, onSelect: () => void copyLink(url) });
    }
    if (analyticsAllowed) items.push({ id: "report", label: t.report, icon: IconChart, onSelect: () => navigate(`/analytics/funnels/${f.id}`) });
    items.push({
      id: "status",
      label: f.status === "published" ? t.pause : f.status === "paused" ? t.resume : t.publish,
      icon: f.status === "published" ? IconPause : f.status === "paused" ? IconPlay : IconLaunch,
      disabled: busy,
      onSelect: () => void changeStatus(f),
    });
    items.push({ id: "duplicate", label: t.duplicate, icon: IconCopy, disabled: busyId !== null, onSelect: () => void duplicate(f) });
    items.push({ id: "share-code", label: t.shareCode, icon: IconShare, onSelect: () => setSharing(f) });
    items.push({ id: "share-market", label: t.shareMarket, icon: IconUpload, onSelect: () => setMarketing(f) });
    items.push({ id: "delete", label: t.delete, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setDeleting(f) });
    return items;
  }

  const tools: ContextMenuItem[] = [
    { id: "marketplace", label: t.marketplace, icon: IconStore, onSelect: () => navigate("/funnels/marketplace") },
    { id: "mine", label: t.myTemplates, icon: IconLayout, onSelect: () => navigate("/funnels/marketplace?tab=mine") },
    { id: "refresh", label: t.refresh, icon: IconRefresh, onSelect: () => void Promise.all([reload(), stats.refresh({ silent: true })]) },
  ];

  const newFunnel = (
    <Button className="min-h-11 rounded-full px-5" onClick={() => setCreating(true)}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.newFunnel}
    </Button>
  );

  const count = (s: FunnelStatus) => funnels.filter((f) => f.status === s).length;
  const statusLabels: Record<FunnelStatus, string> = { draft: t.statusDraft, published: t.statusPublished, paused: t.statusPaused };
  const chips: ChipItem<StatusFilter>[] = [
    { value: "all", label: t.all, count: funnels.length },
    ...STATUS_ORDER.map((s) => ({ value: s, label: statusLabels[s], count: count(s), tone: s === "paused" ? ("attention" as const) : ("default" as const) })),
  ];

  const lines = shown.map((f) => (
    <FunnelRow
      key={f.id}
      t={t}
      funnel={f}
      compact={compact}
      stepCount={stepCounts.data?.get(f.id)}
      stats={statsById.get(f.id)}
      showStats={analyticsAllowed}
      currency={currency}
      selected={selected.has(f.id)}
      onSelectedChange={(on) => setOne(f.id, on)}
      menu={menuFor(f)}
      busy={busyId === f.id}
    />
  ));

  const firstLoad = list.loading && !list.data;
  const nothingYet = !firstLoad && !list.error && funnels.length === 0;

  return (
    <div className="max-w-6xl">
      <PageHeader
        tutorial="funnels"
        title={t.title}
        // A phone keeps the first screen for the funnels: the sentence is for wider screens.
        description={phone ? undefined : t.description}
        actions={
          <>
            {/* Nothing on this page is compared with the period before, so no comparison chip. */}
            {analyticsAllowed && !nothingYet && <RangeSwitch value={range} onChange={setRange} compare={false} />}
            {/* Remounted when the list changes, so its count follows a delete or a restore. */}
            <TrashLink key={funnels.length} kinds={["funnel"]} from="funnels" />
            <ItemMenu items={tools} label={t.tools} />
          </>
        }
        primaryAction={newFunnel}
      />

      <DataState
        loading={firstLoad}
        error={list.data ? null : list.error}
        onRetry={() => void list.refresh()}
        skeleton={
          <div className="flex flex-col gap-3">
            <FunnelStats stats={statCards} label={t.stats} loading />
            <ListSkeleton variant={compact ? "card" : "table"} rows={5} />
          </div>
        }
      >
        {nothingYet ? (
          <EmptyState
            icon={<IconFunnels weight="duotone" aria-hidden />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={
              <div className="flex flex-col items-center gap-1">
                <Button className="min-h-11 rounded-full px-5" onClick={() => setCreating(true)}>
                  <IconPlus className="size-4" weight="bold" aria-hidden />
                  {t.emptyAction}
                </Button>
                <Button variant="ghost" className="min-h-11 rounded-full px-4" onClick={() => navigate("/funnels/marketplace")}>
                  <IconStore className="size-4" aria-hidden /> {t.marketplace}
                </Button>
              </div>
            }
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <FunnelStats stats={statCards} label={t.stats} loading={analyticsAllowed && stats.loading && !stats.data} reason={noStatReason} />

            <ListToolbar search={{ value: query, onChange: setQuery, placeholder: t.searchPlaceholder, label: t.search }} />
            <ChipRow items={chips} value={status} onChange={setStatus} label={t.statuses} />

            <FunnelBulkBar
              selected={selectedFunnels}
              onClear={() => setSelected(new Set())}
              onDone={async (response) => {
                // The ones that did not change stay ticked, ready for another try.
                setSelected(new Set(response.results.filter((r) => !r.ok).map((r) => r.funnelId)));
                invalidateCached("trash:");
                await reload();
              }}
              extra={
                // The cards a phone shows have no header row to hold the select-all box, so it is offered here.
                compact && !allSelected ? (
                  <button
                    type="button"
                    onClick={toggleAll}
                    aria-label={t.selectAll}
                    className="inline-flex min-h-11 cursor-pointer items-center font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {t.selectAllShort}
                  </button>
                ) : undefined
              }
            />

            {shown.length === 0 ? (
              <EmptyState
                icon={<IconSearch aria-hidden />}
                title={t.noMatchTitle}
                description={filtered ? t.noMatchBody : undefined}
                action={
                  <Button
                    variant="outline"
                    className="min-h-11 rounded-full px-5"
                    onClick={() => {
                      setQuery("");
                      setStatus("all");
                    }}
                  >
                    {t.showAll}
                  </Button>
                }
              />
            ) : (
              <div
                aria-busy={list.stale || undefined}
                className={cn("min-w-0 transition-opacity duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none")}
              >
                {compact ? (
                  <ul aria-label={t.list} className="flex flex-col gap-2.5">
                    {lines}
                  </ul>
                ) : (
                  <FunnelDesk t={t} showStats={analyticsAllowed} allSelected={allSelected} onToggleAll={toggleAll}>
                    {lines}
                  </FunnelDesk>
                )}
              </div>
            )}
          </div>
        )}
      </DataState>

      <FunnelWizardSheet open={creating} onOpenChange={setCreating} onCreated={(id) => navigate(`/funnels/${id}`)} />

      <FunnelShareDialog funnel={sharing} onClose={() => setSharing(null)} />
      <ShareTemplateDialog open={marketing !== null} funnelId={marketing?.id} onClose={() => setMarketing(null)} />

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? fmt(t.deleteTitle, { name: deleting.name }) : t.deleteTitlePlain}
        description={t.deleteDescription}
        confirmLabel={t.deleteConfirm}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
