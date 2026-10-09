import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input } from "@store-builder/ui";
import {
  STOCK_FORECAST_MAX_ROWS,
  STOCK_FORECAST_STATUSES,
  stockForecastGet,
  type StockForecast,
  type StockForecastFilter,
  type StockForecastVariant,
} from "@store-builder/api-client";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconClipboard, IconSearch, IconSliders, IconTrendDown } from "@/components/icons";
import { BulkBar, ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { canManageInventory } from "@/lib/inventoryAccess";
import { countOf, pluralOf } from "@/lib/plural";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatDay, parseWholeNumber } from "@/lib/wholeNumber";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { num, variantDetail, variantFullName } from "../inventoryText";
import { ViewOnlyNote, foldText, matchesText } from "../kit";
import { INV_UI } from "../sweepStrings";
import { ForecastOrderDialog, type ForecastOrderLine } from "./ForecastOrderDialog";
import { ForecastSettingsDialog } from "./ForecastSettingsDialog";
import { FORECAST_FILTER_KEY, FORECAST_STATUS_KEY, FORECAST_STATUS_TONE, FORECAST_STRINGS } from "./forecastStrings";

type Filter = "all" | StockForecastFilter;

const FILTERS: readonly StockForecastFilter[] = [...STOCK_FORECAST_STATUSES, "needs_order"];
/** Rows drawn at first, and added by each "Load more". */
const PAGE = 50;
const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

const FORECAST_COLUMNS = "grid-cols-[max-content_minmax(0,1.6fr)_max-content_max-content_max-content_max-content_max-content]";
const FORECAST_COLUMNS_VIEW = "grid-cols-[minmax(0,1.6fr)_max-content_max-content_max-content_max-content_max-content]";
const TICK = "size-5 cursor-pointer accent-primary";

const matches = (row: StockForecastVariant, filter: StockForecastFilter) => (filter === "needs_order" ? row.suggested > 0 : row.status === filter);
const quantityInputId = (variantId: string) => `forecast-quantity-${variantId}`;

/**
 * Inventory → «توقّع المخزون» / Stock forecast (handoff 224, GET /stock-forecast):
 * every stock-tracked variant with what is left to sell, what is on its way,
 * how fast it sells, when it runs out and by when to reorder — most urgent
 * first, narrowed by the status chips. The suggested quantity can be changed;
 * ticked rows become a draft purchase order for one supplier, from the bar
 * that rises while anything is ticked.
 */
export function StockForecastTab() {
  const t = useT(FORECAST_STRINGS);
  const u = useT(INV_UI);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const compact = useIsCompact();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageInventory(currentWorkspace?.role);
  const toast = useToast();

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);
  // Bumped when the settings change, so every read is made again.
  const [version, setVersion] = useState(0);
  const everything = useCachedAsync<StockForecast>(
    `inventory:forecast:${workspaceId}`,
    () => stockForecastGet(apiClient, workspaceId, { limit: STOCK_FORECAST_MAX_ROWS }),
    [workspaceId, version]
  );
  const all = everything.data;
  // The whole store fits one read: the chips narrow it here. Past 1000 variants a chip asks the server.
  const complete = all ? all.total <= all.variants.length : true;
  const narrowOnServer = filter !== "all" && !complete;
  const narrowed = useAsync(
    () =>
      narrowOnServer
        ? stockForecastGet(apiClient, workspaceId, { status: filter as StockForecastFilter, limit: STOCK_FORECAST_MAX_ROWS })
        : Promise.resolve(null),
    [workspaceId, filter, narrowOnServer, version]
  );

  const nameOf = (row: StockForecastVariant) => variantFullName(row.productName, variantDetail(row.optionValues, row.sku));
  const needle = foldText(search.trim());
  const rows = useMemo(() => {
    if (!all) return [];
    const inFilter = filter === "all" ? all.variants : narrowOnServer ? (narrowed.data?.variants ?? []) : all.variants.filter((row) => matches(row, filter));
    return needle ? inFilter.filter((row) => matchesText(needle, [row.productName, row.sku, variantDetail(row.optionValues, row.sku)])) : inFilter;
  }, [all, filter, narrowOnServer, narrowed.data, needle]);
  const visible = rows.slice(0, shown);

  /** How many variants a chip holds; null when only the server knows and was not asked. */
  function countFor(value: Filter): number | null {
    if (!all) return null;
    if (value === "all") return all.total;
    if (value !== "needs_order") return all.counts[value] ?? 0;
    if (complete) return all.variants.filter((row) => row.suggested > 0).length;
    return filter === "needs_order" && narrowed.data ? narrowed.data.total : null;
  }

  // What was typed over a suggestion, the rows ticked (kept with their numbers, whatever chip is showing), and what is wrong with a row.
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<ReadonlyMap<string, StockForecastVariant>>(new Map());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const focusRow = useRef<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [orderLines, setOrderLines] = useState<ForecastOrderLine[] | null>(null);
  const [lastOrderLines, setLastOrderLines] = useState<ForecastOrderLine[]>([]);

  const quantityText = (row: StockForecastVariant) => typed[row.variantId] ?? (row.suggested > 0 ? String(row.suggested) : "");

  // The row whose quantity was found missing: the cursor goes into it once it is drawn (another chip may have hidden it).
  useEffect(() => {
    if (!focusRow.current) return;
    const field = document.getElementById(quantityInputId(focusRow.current));
    if (!field) return;
    field.focus();
    focusRow.current = null;
  });

  function changeFilter(next: Filter) {
    // A cursor still waiting for a row that never showed must not jump in later.
    focusRow.current = null;
    setFilter(next);
    setShown(PAGE);
  }

  function toggle(row: StockForecastVariant) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(row.variantId)) next.delete(row.variantId);
      else next.set(row.variantId, row);
      return next;
    });
  }

  const allVisibleSelected = visible.length > 0 && visible.every((row) => selected.has(row.variantId));
  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Map(prev);
      for (const row of visible) {
        if (allVisibleSelected) next.delete(row.variantId);
        else next.set(row.variantId, row);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Map());
  }

  /** Every ticked row needs a quantity above zero before the order is made. */
  function startOrder() {
    const errors: Record<string, string> = {};
    const lines: ForecastOrderLine[] = [];
    for (const row of selected.values()) {
      const quantity = parseWholeNumber(quantityText(row), 1, 1_000_000);
      if (quantity === null) errors[row.variantId] = t.quantityEmpty;
      else if (Number.isNaN(quantity)) errors[row.variantId] = t.quantityError;
      else lines.push({ variant: row, quantity });
    }
    setRowErrors(errors);
    const firstBad = Object.keys(errors)[0];
    if (firstBad) {
      toast.error(t.fixQuantities);
      // Show the row if another chip, the search or a later page hides it.
      if (!visible.some((row) => row.variantId === firstBad)) {
        const index = all?.variants.findIndex((row) => row.variantId === firstBad) ?? -1;
        if (index >= 0) {
          setFilter("all");
          setSearch("");
          setShown(Math.max(PAGE, index + 1));
        }
      }
      focusRow.current = firstBad;
      return;
    }
    setLastOrderLines(lines);
    setOrderLines(lines);
  }

  const chips: ChipItem<Filter>[] = (["all", ...FILTERS] as Filter[]).map((value) => ({
    value,
    label: value === "all" ? t.filterAll : t[FORECAST_FILTER_KEY[value]],
    count: countFor(value),
    tone: value === "out" || value === "reorder_now" ? ("danger" as const) : value === "soon" || value === "needs_order" ? ("attention" as const) : undefined,
  }));

  function quantityField(row: StockForecastVariant) {
    const error = rowErrors[row.variantId];
    return (
      <span className="flex flex-col items-end gap-1">
        <Input
          id={quantityInputId(row.variantId)}
          inputMode="numeric"
          dir="ltr"
          autoComplete="off"
          maxLength={7}
          placeholder="0"
          value={quantityText(row)}
          aria-label={fmt(t.quantityFor, { name: nameOf(row) })}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            const value = e.target.value;
            setTyped((prev) => ({ ...prev, [row.variantId]: value }));
            if (error) {
              setRowErrors((prev) => {
                const next = { ...prev };
                delete next[row.variantId];
                return next;
              });
            }
          }}
          className="relative z-10 h-11 w-24 text-center tabular-nums pointer-fine:h-9"
        />
        {error && <span className="max-w-48 text-end text-xs font-medium text-danger">{error}</span>}
      </span>
    );
  }

  const list = visible.map((row) => {
    const detail = variantDetail(row.optionValues, row.sku);
    const status = <StatusBadge value={row.status} tone={FORECAST_STATUS_TONE[row.status]} text={t[FORECAST_STATUS_KEY[row.status]]} />;
    const picked = selected.has(row.variantId);
    if (compact) {
      return (
        <li key={row.variantId}>
          <ListRowCard
            title={<bdi>{nameOf(row)}</bdi>}
            amount={<span title={t.colAvailable}>{fmt(u.availableShort, { n: row.available })}</span>}
            status={status}
            meta={row.daysLeft === null ? undefined : fmt(u.lastsFor, { days: countOf("day", row.daysLeft) })}
            action={canManage ? quantityField(row) : row.suggested > 0 ? <span className="text-sm font-semibold text-ink tabular-nums">{fmt(u.orderShort, { n: row.suggested })}</span> : undefined}
            selected={picked}
            onSelectedChange={canManage ? () => toggle(row) : undefined}
            selectLabel={fmt(t.selectRow, { name: nameOf(row) })}
            footer={
              <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs leading-5 text-ink-soft tabular-nums">
                {row.reorderBy && <span className="font-medium text-ink">{fmt(u.reorderBy, { date: formatDay(row.reorderBy, DAY) })}</span>}
                {row.runsOutOn && <span>{fmt(u.runsOut, { date: formatDay(row.runsOutOn, DAY) })}</span>}
                {row.incoming > 0 && <span>{fmt(u.incoming, { n: row.incoming })}</span>}
                {row.perDay > 0 && <span>{fmt(u.perDay, { n: row.perDay })}</span>}
              </p>
            }
          />
        </li>
      );
    }
    return (
      <DeskRow key={row.variantId} className={picked ? "bg-primary-soft/50" : undefined}>
        {canManage && (
          <label className="relative z-10 flex size-9 cursor-pointer items-center justify-center">
            <input type="checkbox" className={TICK} aria-label={fmt(t.selectRow, { name: nameOf(row) })} checked={picked} onChange={() => toggle(row)} />
          </label>
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-6 font-medium text-ink">
            <bdi>{row.productName}</bdi>
          </p>
          <p className="flex min-w-0 items-center gap-2 text-xs leading-5 text-ink-soft">
            {status}
            {detail && (
              <span className="min-w-0 truncate">
                <bdi>{detail}</bdi>
              </span>
            )}
          </p>
        </div>
        <div className="text-end text-sm tabular-nums">
          <p className="font-medium text-ink">{num(row.available)}</p>
          {row.incoming > 0 && <p className="text-xs text-ink-soft">{fmt(u.incoming, { n: row.incoming })}</p>}
        </div>
        <div className="text-end text-sm text-ink-soft tabular-nums">{row.perDay > 0 ? num(row.perDay) : "—"}</div>
        <div className="text-sm whitespace-nowrap tabular-nums">
          <p className="text-ink">{row.daysLeft === null ? "—" : countOf("day", row.daysLeft)}</p>
          {row.runsOutOn && <p className="text-xs text-ink-soft">{formatDay(row.runsOutOn, DAY)}</p>}
        </div>
        <div className="text-sm font-medium whitespace-nowrap text-ink">{formatDay(row.reorderBy, DAY) || "—"}</div>
        <div className="flex justify-end">
          {canManage ? quantityField(row) : <span className="text-sm font-medium text-ink tabular-nums">{row.suggested > 0 ? num(row.suggested) : "—"}</span>}
        </div>
      </DeskRow>
    );
  });

  const settings = all?.settings;
  const narrowing = narrowOnServer && narrowed.loading;
  const dataHead = [
    { label: t.colProduct },
    { label: t.colAvailable, end: true },
    { label: t.colPerDay, end: true },
    { label: t.colDaysLeft },
    { label: t.colReorderBy },
    { label: t.colSuggested, end: true },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-6 text-ink-soft max-md:hidden">{canManage ? t.hint : t.hintViewOnly}</p>
      <ListToolbar search={{ value: search, onChange: setSearch, placeholder: u.forecastSearchPlaceholder, label: u.forecastSearch }}>
        {canManage && settings && (
          <Button type="button" variant="outline" className="h-11 gap-2 rounded-full px-3.5 sm:px-4" aria-label={t.settings} onClick={() => setSettingsOpen(true)}>
            <IconSliders className="size-4" aria-hidden />
            <span className="max-sm:sr-only">{t.settings}</span>
          </Button>
        )}
      </ListToolbar>
      <BulkBar
        count={selected.size}
        label={pluralOf(t, "selected", selected.size)}
        onClear={clearSelection}
        actions={[{ id: "po", label: t.createPo, icon: IconClipboard, onSelect: startOrder }]}
      />
      {all && all.total > 0 && <ChipRow items={chips} value={filter} onChange={changeFilter} label={t.filterLabel} />}

      <DataState
        loading={(everything.loading && !all) || narrowing}
        error={all ? (narrowOnServer ? narrowed.error : null) : everything.error}
        onRetry={() => {
          void everything.refresh();
          if (narrowOnServer) void narrowed.refresh();
        }}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={6} />}
      >
        {all && all.total === 0 ? (
          <EmptyState icon={<IconTrendDown aria-hidden />} title={t.emptyTitle} description={t.emptyHint} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<IconSearch aria-hidden />}
            title={needle ? u.noMatch : t.noMatchTitle}
            action={
              <Button
                type="button"
                variant="outline"
                className="rounded-full px-5"
                onClick={() => {
                  setSearch("");
                  changeFilter("all");
                }}
              >
                {t.showAll}
              </Button>
            }
          />
        ) : (
          all && (
            <div className="flex flex-col gap-3">
              {compact ? (
                <>
                  {canManage && (
                    // A phone's cards have no header row to carry "select all".
                    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 px-1 text-sm text-ink-soft">
                      <input type="checkbox" className={TICK} checked={allVisibleSelected} onChange={toggleAllVisible} />
                      {t.selectAll}
                    </label>
                  )}
                  <ul aria-label={u.forecastList} className="flex flex-col gap-2.5">
                    {list}
                  </ul>
                </>
              ) : (
                <>
                  {canManage && (
                    <label className="flex min-h-9 cursor-pointer items-center gap-2.5 px-4 text-sm text-ink-soft">
                      <input type="checkbox" className={TICK} checked={allVisibleSelected} onChange={toggleAllVisible} />
                      {t.selectAll}
                    </label>
                  )}
                  <DeskList
                    columns={canManage ? FORECAST_COLUMNS : FORECAST_COLUMNS_VIEW}
                    label={u.forecastList}
                    head={canManage ? [{ label: "" }, ...dataHead] : dataHead}
                  >
                    {list}
                  </DeskList>
                </>
              )}
              <LoadMore hasMore={rows.length > visible.length} loading={false} onClick={() => setShown((n) => n + PAGE)} />
              <p className="px-1 text-xs leading-5 text-ink-soft">
                {fmt(t.basis, {
                  window: countOf("day", all.settings.windowDays),
                  lead: countOf("day", all.settings.leadTimeDays),
                  cover: countOf("day", all.settings.coverDays),
                  safety: countOf("day", all.settings.safetyDays),
                })}
              </p>
              {filter === "all" && !complete && <ViewOnlyNote>{fmt(t.firstRows, { n: all.variants.length, total: all.total })}</ViewOnlyNote>}
              {!canManage && <ViewOnlyNote>{t.viewOnly}</ViewOnlyNote>}
            </div>
          )
        )}
      </DataState>

      {settings && (
        <ForecastSettingsDialog
          open={settingsOpen}
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            toast.success(t.settingsSaved);
            // The suggestions are worked out again: what was typed over the old ones no longer stands for them.
            setTyped({});
            setRowErrors({});
            clearSelection();
            setVersion((n) => n + 1);
          }}
        />
      )}

      <ForecastOrderDialog
        open={orderLines !== null}
        lines={orderLines ?? lastOrderLines}
        onClose={() => setOrderLines(null)}
        onCreated={(po) => {
          setOrderLines(null);
          clearSelection();
          toast.success(fmt(t.poCreated, { number: po.number }));
          navigate(`/inventory/purchase-orders/${po.id}`);
        }}
      />
    </div>
  );
}
