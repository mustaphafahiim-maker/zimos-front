import { useState } from "react";
import { Button } from "@store-builder/ui";
import { stockCountsList, type StockCountStatus, type StockCountSummary } from "@store-builder/api-client";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconChecklist, IconPlus, IconSearch } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { PageActionBar } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import { canManageInventory } from "@/lib/inventoryAccess";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { markViewSource, useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { TOOL_BUTTON, ViewOnlyNote, foldText, matchesText, useStockLocations } from "./kit";
import { COUNT_STATUS_KEY, COUNT_STATUS_TONE, PURCHASING_STRINGS } from "./purchasingStrings";
import { StartCountDialog } from "./StartCountDialog";
import { INV_UI } from "./sweepStrings";

type Filter = "all" | StockCountStatus;
const STATUSES: readonly StockCountStatus[] = ["open", "applied", "cancelled"];
const COUNT_COLUMNS = "grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_max-content_minmax(0,1.2fr)_max-content]";
const NAME_LINK = "rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * Inventory → «الجرد» / Stock counts (handoff 207): the counts so far — where,
 * when, and whether each is still open, applied or cancelled — and «ابدأ
 * جرد». A row opens the counting page: an open count's one action is to go on
 * counting, so there is nothing to preview in between.
 */
export function StockCountsTab() {
  const t = useT(PURCHASING_STRINGS);
  const u = useT(INV_UI);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const compact = useIsCompact();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageInventory(currentWorkspace?.role);
  const list = useCachedAsync<StockCountSummary[]>(`inventory:counts:${workspaceId}`, () => stockCountsList(apiClient, workspaceId), [workspaceId]);
  // Names for the "where" column; without them a count at a location still lists.
  const locations = useStockLocations(workspaceId);
  const allLocations = locations.data?.locations ?? [];
  const counts = list.data ?? [];
  const [starting, setStarting] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const where = (count: StockCountSummary) =>
    count.locationId ? (allLocations.find((l) => l.id === count.locationId)?.name ?? t.aLocation) : t.wholeStore;
  const titleOf = (count: StockCountSummary) => fmt(t.countTitle, { date: formatDateTime(count.createdAt) });

  const needle = foldText(search.trim());
  const visible = counts.filter((count) => (filter === "all" || count.status === filter) && matchesText(needle, [where(count), count.note, titleOf(count)]));
  const figure = (n: number) => (list.loading ? null : n);
  const chips: ChipItem<Filter>[] = [
    { value: "all", label: t.filterAll, count: figure(counts.length) },
    ...STATUSES.map((status) => ({
      value: status,
      label: t[COUNT_STATUS_KEY[status]],
      count: figure(counts.filter((count) => count.status === status).length),
      tone: status === "open" ? ("attention" as const) : undefined,
    })),
  ];

  const startButton = (
    <Button type="button" className={TOOL_BUTTON} onClick={() => setStarting(true)}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.startCount}
    </Button>
  );

  const rows = visible.map((count) => {
    const to = `/inventory/stock-counts/${count.id}`;
    const title = titleOf(count);
    const status = <StatusBadge value={count.status} tone={COUNT_STATUS_TONE[count.status]} text={t[COUNT_STATUS_KEY[count.status]]} />;
    const open = () => navigate(to);
    const action =
      count.status === "open" && canManage ? <RowAction tone="quiet" label={u.continueCount} onClick={open} /> : null;
    if (compact) {
      return (
        <li key={count.id}>
          <ListRowCard
            title={<span data-vt-part="title">{title}</span>}
            status={status}
            meta={<bdi>{where(count)}</bdi>}
            action={action}
            footer={
              count.note ? (
                <p dir="auto" className="min-w-0 truncate text-xs leading-5 text-ink-soft">
                  {count.note}
                </p>
              ) : undefined
            }
            onOpen={open}
            openLabel={fmt(u.openNamed, { name: title })}
            onClick={(event) => markViewSource(event.currentTarget.closest("[data-slot='list-row-card']"))}
          />
        </li>
      );
    }
    return (
      <DeskRow key={count.id} onOpen={open} openLabel={fmt(u.openNamed, { name: title })}>
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-6 font-medium text-ink">
            <ViewLink to={to} className={NAME_LINK}>
              {title}
            </ViewLink>
          </p>
          <p className="text-xs leading-5 text-ink-soft">
            <time dateTime={count.createdAt}>{formatRelativeTime(count.createdAt)}</time>
          </p>
        </div>
        <p className="min-w-0 truncate text-sm text-ink-soft">
          <bdi>{where(count)}</bdi>
        </p>
        <div className="flex items-center">{status}</div>
        {count.note ? (
          <p dir="auto" className="line-clamp-2 min-w-0 text-sm leading-5 wrap-anywhere text-ink-soft">
            {count.note}
          </p>
        ) : (
          <p className="text-sm text-ink-soft">—</p>
        )}
        <div className="flex items-center justify-end">{action}</div>
      </DeskRow>
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-6 text-ink-soft max-md:hidden">{t.countsHint}</p>
      <ListToolbar search={{ value: search, onChange: setSearch, placeholder: u.countListSearchPlaceholder, label: u.countListSearch }}>
        {canManage && counts.length > 0 && (
          <Button type="button" className="h-11 gap-2 rounded-full px-4 max-md:hidden" onClick={() => setStarting(true)}>
            <IconPlus className="size-4" weight="bold" aria-hidden />
            {t.startCount}
          </Button>
        )}
      </ListToolbar>
      {counts.length > 0 && <ChipRow items={chips} value={filter} onChange={setFilter} label={u.countListChips} countsLoading={list.loading} />}

      <DataState
        loading={list.loading}
        error={list.data ? null : list.error}
        onRetry={() => void list.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={4} />}
      >
        {counts.length === 0 ? (
          <EmptyState
            icon={<IconChecklist aria-hidden />}
            title={t.countsEmptyTitle}
            description={canManage ? t.countsEmptyHint : t.viewOnly}
            action={canManage ? startButton : undefined}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<IconSearch aria-hidden />}
            title={u.noMatch}
            action={
              <Button
                type="button"
                variant="outline"
                className="rounded-full px-5"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                {u.clearSearch}
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {compact ? (
              <ul aria-label={u.countList} className="flex flex-col gap-2.5">
                {rows}
              </ul>
            ) : (
              <DeskList
                columns={COUNT_COLUMNS}
                label={u.countList}
                head={[{ label: t.colStarted }, { label: t.colWhere }, { label: t.colStatus }, { label: t.colNote }, { label: "", end: true }]}
              >
                {rows}
              </DeskList>
            )}
            {!canManage && <ViewOnlyNote>{t.viewOnly}</ViewOnlyNote>}
          </div>
        )}
      </DataState>

      {canManage && counts.length > 0 && <PageActionBar>{startButton}</PageActionBar>}

      <StartCountDialog
        open={starting}
        locations={allLocations}
        onClose={() => setStarting(false)}
        onStarted={(count) => {
          setStarting(false);
          void list.refresh({ silent: true });
          navigate(`/inventory/stock-counts/${count.id}`);
        }}
      />
    </div>
  );
}
