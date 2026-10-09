import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { IconCancelled, IconCheck, IconRefresh, IconSearch } from "@/components/icons";
import { Alert, Button, Input, Spinner } from "@store-builder/ui";
import {
  isApiErrorCode,
  stockCountApply,
  stockCountCancel,
  stockCountEnter,
  stockCountGet,
  type StockCount,
  type StockCountLine,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { canManageInventory } from "@/lib/inventoryAccess";
import { formatDateTime } from "@/lib/format";
import { parseWholeNumber } from "@/lib/wholeNumber";
import { fmt, useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { EmptyState } from "@/components/EmptyState";
import { LoadMore } from "@/components/LoadMore";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { COUNT_STATUS_KEY, COUNT_STATUS_TONE, PURCHASING_STRINGS } from "./purchasingStrings";
import { num, signed, variantFullName } from "./inventoryText";
import { Meter, MoreMenu, ViewOnlyNote, useStockLocations } from "./kit";
import { INV_UI } from "./sweepStrings";
import { useCatalogVariants } from "./useCatalogVariants";

type Filter = "all" | "uncounted" | "different";
type SaveState = "idle" | "saving" | "saved" | "failed";

/** Rows drawn at a time: a count can hold 2000 lines. */
const PAGE = 100;
const COUNT_COLUMNS = "grid-cols-[minmax(0,1.6fr)_max-content_max-content_max-content]";
const COUNT_COLUMNS_APPLIED = "grid-cols-[minmax(0,1.6fr)_max-content_max-content_max-content_max-content]";
/** The most the API takes as a counted quantity. */
const MAX_COUNTED = 10_000_000;

/** Keyed by the count in the URL, so what was typed never carries over to another count. */
export function StockCountPage() {
  const { countId = "" } = useParams<{ countId: string }>();
  return <StockCountView key={countId} countId={countId} />;
}

/**
 * One stock count (handoff 207): each line with what the system expected, a
 * field for what was counted and the difference between them. What is typed
 * saves itself a moment later (PATCH, "save as you go"). «اعتمد الجرد» asks
 * first — «هيعدّل المخزون بالفرق» — then adjusts every counted line.
 */
function StockCountView({ countId }: { countId: string }) {
  const t = useT(PURCHASING_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageInventory(currentWorkspace?.role);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const u = useT(INV_UI);
  const compact = useIsCompact();

  const count = useAsync(() => stockCountGet(apiClient, workspaceId, countId), [workspaceId, countId]);
  const locations = useStockLocations(workspaceId);
  // The count's lines carry a name and a SKU only: the catalog tells one variant of a product from another.
  const catalog = useCatalogVariants(workspaceId);
  const detailById = useMemo(() => new Map(catalog.variants.map((v) => [v.variantId, v.detail])), [catalog.variants]);

  const data = count.data;
  const open = data?.status === "open";
  const editable = open && canManage;

  // What is in each field, as typed. Filled once from the saved counts.
  const [values, setValues] = useState<Record<string, string>>({});
  const filled = useRef(false);
  useEffect(() => {
    if (!data || filled.current) return;
    filled.current = true;
    setValues(Object.fromEntries(data.lines.map((line) => [line.variantId, line.counted === null ? "" : String(line.counted)])));
  }, [data]);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  /** What a field holds: a count, nothing (null), or something that is not a count (NaN). */
  const typed = useCallback((variantId: string) => parseWholeNumber(values[variantId] ?? "", 0, MAX_COUNTED), [values]);

  // --- save as you go ----------------------------------------------------
  const pending = useRef(new Map<string, number | null>());
  const timer = useRef<number | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const setData = count.setData;

  const closed = useCallback(() => {
    pending.current.clear();
    setSaveState("idle");
    setNotice(t.countClosed);
    void count.refresh({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.countClosed]);

  /** Sends what was typed since the last save. Resolves false when it could not be saved. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    // One save at a time: a second one waits, then sends whatever is still unsaved.
    if (inFlight.current) await inFlight.current;
    if (pending.current.size === 0) return true;
    const batch = [...pending.current.entries()].map(([variantId, counted]) => ({ variantId, counted }));
    pending.current = new Map();
    setSaveState("saving");
    const run = (async () => {
      try {
        setData(await stockCountEnter(apiClient, workspaceId, countId, batch));
        setSaveState("saved");
        return true;
      } catch (err) {
        if (isApiErrorCode(err, "COUNT_CLOSED")) {
          closed();
          return false;
        }
        // Keep it for the next try, unless the field was changed again meanwhile.
        for (const entry of batch) if (!pending.current.has(entry.variantId)) pending.current.set(entry.variantId, entry.counted);
        setSaveState("failed");
        return false;
      }
    })();
    inFlight.current = run;
    const ok = await run;
    inFlight.current = null;
    return ok;
  }, [workspaceId, countId, setData, closed]);

  // Leaving the page sends what is still waiting.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => void flushRef.current(), []);

  function change(variantId: string, raw: string) {
    setValues((prev) => ({ ...prev, [variantId]: raw }));
    const value = parseWholeNumber(raw, 0, MAX_COUNTED);
    if (value !== null && Number.isNaN(value)) {
      // Not a count: nothing to save for this field until it is one.
      pending.current.delete(variantId);
      return;
    }
    pending.current.set(variantId, value);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 800);
  }

  // --- what is shown -----------------------------------------------------
  const nameOf = (line: StockCountLine) => line.productName ?? t.unknownProduct;
  const detailOf = (line: StockCountLine) => detailById.get(line.variantId) || line.sku || "";
  /** The count a line shows: what is in its field while the count is open, the saved one after. */
  const countedOf = (line: StockCountLine): number | null => {
    if (!editable) return line.counted;
    const value = typed(line.variantId);
    return value === null || Number.isNaN(value) ? null : value;
  };

  const lines = useMemo(() => data?.lines ?? [], [data]);
  // Which lines a filter shows is decided when it is chosen, not on every keystroke: a line
  // being counted must not leave "Not counted" from under the cursor.
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const [filterPick, setFilterPick] = useState(0);
  const members = useMemo(() => {
    if (filter === "all") return null;
    const out = new Set<string>();
    for (const line of lines) {
      const value = editable ? parseWholeNumber(valuesRef.current[line.variantId] ?? "", 0, MAX_COUNTED) : line.counted;
      const counted = value === null || Number.isNaN(value) ? null : value;
      if (filter === "uncounted" ? counted === null : counted !== null && counted !== line.expected) out.add(line.variantId);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, filterPick, lines.length, editable]);
  const needle = search.trim().toLowerCase();
  const visible = lines.filter((line) => {
    if (needle && !`${nameOf(line)} ${detailOf(line)} ${line.sku ?? ""}`.toLowerCase().includes(needle)) return false;
    return members === null || members.has(line.variantId);
  });
  const countedLines = lines.filter((line) => countedOf(line) !== null).length;
  const invalid = editable && lines.some((line) => Number.isNaN(typed(line.variantId) ?? 0));
  const locationName = data?.locationId ? ((locations.data?.locations ?? []).find((l) => l.id === data.locationId)?.name ?? t.aLocation) : t.wholeStore;

  async function askApply() {
    if (invalid) {
      toast.error(t.countInvalid);
      return;
    }
    if (countedLines === 0) {
      toast.error(t.applyNeedOne);
      return;
    }
    // What was typed a moment ago has to be saved before it can be applied.
    if (await flush()) setApplying(true);
  }

  async function confirmApply() {
    let next: StockCount;
    try {
      next = await stockCountApply(apiClient, workspaceId, countId);
    } catch (err) {
      if (isApiErrorCode(err, "COUNT_CLOSED")) {
        setApplying(false);
        closed();
        return;
      }
      throw new Error(errorMessage(err, { INSUFFICIENT_STOCK: t.applyBelowZero }));
    }
    setData(next);
    setApplying(false);
    setNotice(null);
    toast.success(t.applied);
  }

  async function confirmCancel() {
    await flush();
    let next: StockCount;
    try {
      next = await stockCountCancel(apiClient, workspaceId, countId);
    } catch (err) {
      if (isApiErrorCode(err, "COUNT_CLOSED")) {
        setCancelling(false);
        closed();
        return;
      }
      throw new Error(errorMessage(err));
    }
    setData(next);
    setCancelling(false);
    setNotice(null);
    toast.success(t.countCancelled);
  }

  const difference = (line: StockCountLine) => {
    const counted = countedOf(line);
    if (counted === null) return <span className="text-ink-soft">{t.notCounted}</span>;
    const diff = counted - line.expected;
    if (diff === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-ink-soft">
          <IconCheck className="size-3.5" aria-hidden />
          {t.matches}
        </span>
      );
    }
    return (
      <bdi dir="ltr" className={diff > 0 ? "font-semibold tabular-nums text-success" : "font-semibold tabular-nums text-danger"}>
        {signed(diff)}
      </bdi>
    );
  };

  function countedField(line: StockCountLine) {
    const bad = Number.isNaN(typed(line.variantId) ?? 0);
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <Input
          inputMode="numeric"
          dir="ltr"
          autoComplete="off"
          maxLength={8}
          placeholder="—"
          value={values[line.variantId] ?? ""}
          aria-label={fmt(t.countedFor, { name: variantFullName(nameOf(line), detailOf(line)) })}
          aria-invalid={bad ? true : undefined}
          onChange={(e) => change(line.variantId, e.target.value)}
          onBlur={() => void flush()}
          className="h-11 w-24 text-center tabular-nums"
        />
        {bad && <span className="max-w-40 text-end text-xs font-medium text-danger">{t.countInvalid}</span>}
      </span>
    );
  }

  const isApplied = data?.status === "applied";
  const chips: ChipItem<Filter>[] = [
    { value: "all", label: t.filterAll, count: lines.length },
    { value: "uncounted", label: t.filterUncounted, count: lines.length - countedLines, tone: "attention" },
    { value: "different", label: t.filterDifferent },
  ];

  const rows = visible.slice(0, shown).map((line) => {
    const detail = detailOf(line);
    const counted = editable ? (
      countedField(line)
    ) : line.counted === null ? (
      <span className="text-sm text-ink-soft">{t.notCounted}</span>
    ) : (
      <span className="text-sm font-medium text-ink tabular-nums">{num(line.counted)}</span>
    );
    const applied =
      line.appliedDelta === null ? null : (
        <bdi dir="ltr" className="font-medium text-ink tabular-nums">
          {signed(line.appliedDelta)}
        </bdi>
      );
    if (compact) {
      return (
        <li key={line.variantId}>
          <ListRowCard
            title={<bdi>{nameOf(line)}</bdi>}
            amount={<span>{fmt(u.expectedShort, { n: line.expected })}</span>}
            status={<span className="text-[13px]">{difference(line)}</span>}
            meta={detail ? <bdi>{detail}</bdi> : undefined}
            action={counted}
            footer={isApplied && applied ? <span className="text-xs text-ink-soft">{t.colApplied} {applied}</span> : undefined}
          />
        </li>
      );
    }
    return (
      <DeskRow key={line.variantId}>
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-6 font-medium text-ink">
            <bdi>{nameOf(line)}</bdi>
          </p>
          {detail && (
            <p className="truncate text-xs leading-5 text-ink-soft">
              <bdi>{detail}</bdi>
            </p>
          )}
        </div>
        <div className="text-end text-sm text-ink-soft tabular-nums">{num(line.expected)}</div>
        <div className="flex justify-end">{counted}</div>
        <div className="text-end text-sm">{difference(line)}</div>
        {isApplied && <div className="text-end text-sm">{applied ?? "—"}</div>}
      </DeskRow>
    );
  });

  const more: ContextMenuItem[] = editable
    ? [{ id: "cancel", label: t.cancelCount, icon: IconCancelled, destructive: true, onSelect: () => setCancelling(true) }]
    : [];
  const progressText = fmt(t.progress, { counted: num(countedLines), total: num(lines.length) });
  const dataHead = [
    { label: t.colProduct },
    { label: t.colExpectedCount, end: true },
    { label: t.colCounted, end: true },
    { label: t.colDifference, end: true },
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader
        back={{ to: "/inventory/stock-counts", label: t.countsBack }}
        title={data ? fmt(t.countTitle, { date: formatDateTime(data.createdAt) }) : t.countFallbackTitle}
        titleBadge={data ? <StatusBadge value={data.status} tone={COUNT_STATUS_TONE[data.status]} text={t[COUNT_STATUS_KEY[data.status]]} /> : undefined}
        description={
          data
            ? [fmt(t.whereLine, { name: locationName }), data.appliedAt ? fmt(t.appliedOn, { date: formatDateTime(data.appliedAt) }) : null, data.note]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        actions={editable ? <MoreMenu items={more} label={u.countMenu} size="header" /> : undefined}
        primaryAction={
          editable ? (
            <Button type="button" className="h-11 gap-2 rounded-full px-4" onClick={() => void askApply()}>
              <IconCheck className="size-4" weight="bold" aria-hidden />
              {t.applyCount}
            </Button>
          ) : undefined
        }
      />

      <DataState
        loading={count.loading}
        error={count.error}
        onRetry={() => void count.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={6} />}
      >
        {data && (
          <div className="flex flex-col gap-3">
            {notice && <Alert>{notice}</Alert>}

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                <p className="font-medium text-ink tabular-nums">{progressText}</p>
                {editable && (
                  <p role="status" aria-live="polite" className="inline-flex min-h-6 items-center gap-2 text-xs text-ink-soft">
                    {saveState === "saving" && (
                      <>
                        <Spinner className="size-3.5" role="presentation" aria-hidden="true" aria-label={undefined} />
                        {t.savingNow}
                      </>
                    )}
                    {saveState === "saved" && (
                      <>
                        <IconCheck className="size-3.5 text-success" aria-hidden />
                        {t.savedNow}
                      </>
                    )}
                    {saveState === "failed" && (
                      <>
                        <span className="font-medium text-danger">{t.saveFailed}</span>
                        <button type="button" className="min-h-11 cursor-pointer font-semibold text-primary underline underline-offset-2" onClick={() => void flush()}>
                          {t.retrySave}
                        </button>
                      </>
                    )}
                  </p>
                )}
              </div>
              <Meter value={countedLines} max={lines.length} label={progressText} tone={open ? "primary" : "success"} />
            </div>

            <ListToolbar
              search={{
                value: search,
                onChange: (value) => {
                  setSearch(value);
                  setShown(PAGE);
                },
                placeholder: t.countSearchPlaceholder,
                label: t.countSearch,
              }}
            />
            <ChipRow
              items={chips}
              value={filter}
              onChange={(next) => {
                setFilter(next);
                setShown(PAGE);
              }}
              label={t.countFilterLabel}
              collapseEmpty={false}
            />
            {filter !== "all" && (
              // Which lines a chip holds is decided when it is chosen, so a line being counted never leaves from under the cursor.
              <button
                type="button"
                className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 self-start rounded-full px-3 text-[13px] font-semibold text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary"
                onClick={() => {
                  setFilterPick((n) => n + 1);
                  setShown(PAGE);
                }}
              >
                <IconRefresh className="size-4" aria-hidden />
                {u.refreshFilter}
              </button>
            )}

            {visible.length === 0 ? (
              <EmptyState
                icon={<IconSearch aria-hidden />}
                title={t.noLinesMatch}
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
                    {t.showAllLines}
                  </Button>
                }
              />
            ) : (
              <>
                {compact ? (
                  <ul aria-label={t.countSearch} className="flex flex-col gap-2.5">
                    {rows}
                  </ul>
                ) : (
                  <DeskList
                    columns={isApplied ? COUNT_COLUMNS_APPLIED : COUNT_COLUMNS}
                    label={t.countSearch}
                    head={isApplied ? [...dataHead, { label: t.colApplied, end: true }] : dataHead}
                  >
                    {rows}
                  </DeskList>
                )}
                <LoadMore hasMore={visible.length > shown} loading={false} onClick={() => setShown((n) => n + PAGE)} />
              </>
            )}

            {open && !canManage && <ViewOnlyNote>{t.viewOnly}</ViewOnlyNote>}
          </div>
        )}
      </DataState>

      <ConfirmDialog
        open={applying}
        title={t.applyTitle}
        description={t.applyBody}
        confirmLabel={t.applyConfirm}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        onCancel={() => setApplying(false)}
        onConfirm={confirmApply}
      >
        <p className="text-sm text-ink-soft">{t.applyDetail}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={cancelling}
        title={t.cancelCountTitle}
        description={t.cancelCountBody}
        confirmLabel={t.cancelCountConfirm}
        cancelLabel={t.keepCount}
        busyLabel={t.working}
        destructive
        onCancel={() => setCancelling(false)}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
