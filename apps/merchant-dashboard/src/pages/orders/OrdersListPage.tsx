import { RiskBadge, RiskFilter, useRiskParam } from "@/pages/fraud/RiskBadge";
import { NetworkScoresProvider, OrderNetworkRate } from "@/pages/fraud/NetworkRate";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, Ellipsis, Plus, Search, ShoppingBag, X } from "lucide-react";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import {
  ORDER_SORTS,
  ORDER_STAGES,
  isInvalidCursorError,
  type Order,
  type OrderPipeline,
  type OrderSort,
  type OrderStage,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney } from "@/lib/format";
import { useListSort } from "@/lib/listSort";
import { providerName } from "@/lib/providers";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadMore } from "@/components/LoadMore";
import { Select } from "@/components/Select";
import { ContactActions } from "@/components/ContactActions";
import { useWorkspace } from "@/context/WorkspaceContext";
import { storeUrl } from "@/lib/storeAddress";
import { EmptyState } from "@/components/EmptyState";
import { useNow } from "@/pages/confirmation/confirmationRoles";
import { STAGE_TONE, useOrderLabels } from "./orderLabels";
import { OrderTimelineLines } from "./components/OrderTimelineLines";
import { ExportOrders } from "./components/ExportOrders";
import { rememberOrdersListQuery } from "./orderListQuery";
import { OrderBulkBar } from "./components/OrderBulkBar";
import { SelectAllMatching } from "./components/SelectAllMatching";
import { OrderListDocuments } from "./components/OrderDocuments";
import { OrderColumnCell } from "./components/OrderColumnCell";
import { orderRiskCountsOf, ordersMeta, type OrderSearchParams } from "@store-builder/api-client";
import {
  OrderFilterBar,
  useColumnLabel,
  useOrderExtraFilters,
  useOrderListPrefs,
  type OrderColumn,
} from "./components/OrderListFilters";
import { OrdersHeaderTools } from "./components/OrdersHeaderTools";

const STRINGS = {
  en: {
    title: "Orders",
    description: "Every order, grouped by where it stands right now.",
    tabsLabel: "Filter orders by stage",
    tabAll: "All",
    searchLabel: "Search orders",
    searchPlaceholder: "Order #, name, phone or its last 4 digits, waybill",
    searchHint: "Matches the order number, customer name or email, the phone (or just its last 4+ digits), or a courier waybill number.",
    today: "Today",
    last7: "Last 7 days",
    last30: "Last 30 days",
    searchTooShort: "Type at least 2 characters to search.",
    clearSearch: "Clear search",
    from: "From",
    to: "To",
    datesHint: "Days follow this device's clock.",
    dates: "Date",
    tools: "More tools",
    emptyAllTitle: "No orders yet",
    emptyAllBody: "The moment a customer orders from your store, the order shows up here — and on your home screen.",
    emptyShare: "Open your store",
    emptyTest: "Create an order by hand",
    rangeInvalid: "The start date is after the end date, so the dates aren't applied.",
    clearFilters: "Clear filters",
    countsFailed: "Couldn't load the tab counts.",
    retry: "Try again",
    colOrder: "Order",
    colCustomer: "Customer",
    colTotal: "Total",
    colStage: "Stage",
    colPayment: "Payment",
    colTimeline: "Placed / confirmed",
    sortLabel: "Sort",
    sort_newest: "Newest first",
    sort_oldest: "Oldest first",
    sort_total_desc: "Total: high to low",
    sort_total_asc: "Total: low to high",
    emptyAll: "No orders yet. Orders from your store will appear here.",
    emptyStage: "No orders under “{stage}” right now.",
    emptyFiltered: "No orders match this search and dates.",
    loadMoreFailed: "Couldn't load more orders.",
    phoneLabel: "Phone",
    unseen: "Not seen yet",
    createOrder: "New order",
    selectAll: "Select all orders shown",
    selectOrder: "Select order {number}",
    test: "Test",
  },
  ar: {
    title: "الأوردرات",
    description: "كل الأوردرات، متقسّمة حسب هي فين دلوقتي.",
    tabsLabel: "فلترة الأوردرات حسب المرحلة",
    tabAll: "الكل",
    searchLabel: "البحث في الأوردرات",
    searchPlaceholder: "رقم الأوردر، الاسم، الموبايل أو آخر ٤ أرقام، البوليصة",
    searchHint: "بيدوّر في رقم الأوردر، اسم العميل أو إيميله، الموبايل (أو آخر ٤ أرقام منه)، أو رقم البوليصة.",
    today: "النهارده",
    last7: "آخر 7 أيام",
    last30: "آخر 30 يوم",
    searchTooShort: "اكتب حرفين على الأقل عشان ندوّر.",
    clearSearch: "امسح البحث",
    from: "من",
    to: "لحد",
    datesHint: "الأيام بتوقيت الجهاز ده.",
    dates: "التاريخ",
    tools: "أدوات تانية",
    emptyAllTitle: "لسه مفيش أوردرات",
    emptyAllBody: "أول ما عميل يطلب من متجرك، الأوردر هيظهر هنا وفي الصفحة الرئيسية.",
    emptyShare: "افتح متجرك",
    emptyTest: "اعمل أوردر بإيدك",
    rangeInvalid: "تاريخ البداية بعد تاريخ النهاية، فمطبّقناش التواريخ.",
    clearFilters: "امسح الفلاتر",
    countsFailed: "معرفناش نجيب الأعداد.",
    retry: "جرّب تاني",
    colOrder: "الأوردر",
    colCustomer: "العميل",
    colTotal: "الإجمالي",
    colStage: "المرحلة",
    colPayment: "الدفع",
    colTimeline: "الطلب / التأكيد",
    sortLabel: "الترتيب",
    sort_newest: "الأحدث الأول",
    sort_oldest: "الأقدم الأول",
    sort_total_desc: "الأغلى الأول",
    sort_total_asc: "الأرخص الأول",
    emptyAll: "لسه مفيش أوردرات. أوردرات متجرك هتظهر هنا.",
    emptyStage: "مفيش أوردرات في «{stage}» دلوقتي.",
    emptyFiltered: "مفيش أوردرات بالبحث والتواريخ دي.",
    loadMoreFailed: "معرفناش نجيب أوردرات أكتر.",
    phoneLabel: "الموبايل",
    unseen: "محدش فتحه لسه",
    createOrder: "أوردر جديد",
    selectAll: "اختار كل الأوردرات اللي ظاهرة",
    selectOrder: "اختار الأوردر {number}",
    test: "تجريبي",
  },
} satisfies Messages;

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN = 2;
const SEARCH_MAX = 100;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-06" for a moment, on this device's calendar (Cairo for an Egyptian merchant), not UTC's. */
function localDay(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The device's time zone (Africa/Cairo for an Egyptian merchant). Sent with
 * the dates so the API reads "6 Oct" as that whole day there, not in UTC.
 */
function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** `value`, once it has stopped changing for `delayMs`. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

function isStage(value: string | null): value is OrderStage {
  return value !== null && (ORDER_STAGES as readonly string[]).includes(value);
}

/**
 * The list's filters live in the URL (?stage=&q=&from=&to=) so a view can be
 * shared and survives a refresh. Anything malformed in a hand-edited URL is
 * ignored rather than sent.
 */
function useOrderFilters() {
  const [params, setParams] = useSearchParams();
  const rawStage = params.get("stage");
  const stage = isStage(rawStage) ? rawStage : null;
  const rawQ = (params.get("q") ?? "").trim();
  const q = rawQ.length >= SEARCH_MIN ? rawQ.slice(0, SEARCH_MAX) : "";
  const rawFrom = params.get("from") ?? "";
  const rawTo = params.get("to") ?? "";
  const from = DATE_RE.test(rawFrom) ? rawFrom : "";
  const to = DATE_RE.test(rawTo) ? rawTo : "";
  const rangeInvalid = Boolean(from && to && from > to);

  function update(patch: Partial<Record<"stage" | "q" | "from" | "to", string | null>>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true }
    );
  }

  return {
    stage,
    q,
    from,
    to,
    rangeInvalid,
    // Dates only reach the API as a valid range.
    query: {
      q: q || undefined,
      from: rangeInvalid ? undefined : from || undefined,
      to: rangeInvalid ? undefined : to || undefined,
      tz: !rangeInvalid && (from || to) ? deviceTimeZone() : undefined,
    },
    hasSearchFilters: Boolean(q || from || to),
    update,
  };
}

export function OrdersListPage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const errorMessage = useErrorMessage();
  const filters = useOrderFilters();
  const { stage, query } = filters;
  // Lane 2: the risk tabs (`?risk=`), sent to the list and the tab counts alike.
  const risk = useRiskParam();
  // Sorted on the server; the default is the list's order as it always was.
  const [sort, setSort] = useListSort<OrderSort>("zimos.orders.sort", ORDER_SORTS, "newest");

  // SPEC §4.3 filters (tag, source, payment, governorate, courier, seen, test,
  // archive), the column chooser and the page size.
  const extra = useOrderExtraFilters();
  const prefs = useOrderListPrefs();
  // The API accepts them on the list, the counts and the export alike.
  const fullQuery = { ...query, ...extra.query, ...risk.query } as OrderSearchParams;

  const pipeline = useAsync<OrderPipeline>(
    () => apiClient.getOrderPipeline(workspaceId, fullQuery),
    [workspaceId, query.q, query.from, query.to, extra.key, risk.risk]
  );

  const list = useCursorList<Order>(
    (cursor) =>
      apiClient
        .listOrders(workspaceId, { cursor, limit: prefs.pageSize, stage: stage ?? undefined, sort, ...fullQuery })
        .then((r) => ({ items: r.orders, nextCursor: r.nextCursor })),
    [workspaceId, stage, sort, query.q, query.from, query.to, extra.key, prefs.pageSize, risk.risk],
    { isStaleCursor: (err) => isInvalidCursorError(err, "cursor") }
  );

  // The order page's previous / next arrows follow this list.
  useEffect(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ stage, sort, ...fullQuery })) {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
    rememberOrdersListQuery(params.toString());
  }, [stage, sort, query.q, query.from, query.to, extra.key, risk.risk]); // eslint-disable-line react-hooks/exhaustive-deps

  // Orders ticked for a bulk action; a different list starts a fresh selection.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelected(new Set());
  }, [workspaceId, stage, sort, query.q, query.from, query.to, extra.key, risk.risk]);
  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = list.items.length > 0 && list.items.every((o) => selected.has(o.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(list.items.map((o) => o.id)));

  const [toolsOpen, setToolsOpen] = useState(false);
  const { currentWorkspace } = useWorkspace();
  const storeLink = currentWorkspace?.slug ? storeUrl(currentWorkspace.slug) : null;
  // A store with no orders at all (not a filter that matched none): guide, don't just say "empty".
  const noOrdersAtAll =
    !list.loading && !list.error && list.items.length === 0 && pipeline.data?.total === 0 &&
    !stage && !filters.hasSearchFilters && extra.active.length === 0 && !risk.risk;
  // The date range opens by itself when the link already carries one.
  const [datesOpen, setDatesOpen] = useState(() => Boolean(filters.from || filters.to));

  const emptyMessage = filters.hasSearchFilters || extra.active.length > 0
    ? t.emptyFiltered
    : stage
      ? fmt(t.emptyStage, { stage: labels.stage(stage) })
      : t.emptyAll;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* On a phone the secondary tools fold behind one button; New order stays in reach. */}
            <Button
              variant="outline"
              className="min-h-11 md:hidden"
              aria-expanded={toolsOpen}
              onClick={() => setToolsOpen((v) => !v)}
            >
              <Ellipsis className="size-4" aria-hidden />
              {t.tools}
            </Button>
            <div className={cn("flex-wrap items-center justify-end gap-2 md:flex", toolsOpen ? "flex basis-full md:basis-auto" : "hidden")}>
            <OrdersHeaderTools
              onRefresh={() => {
                list.reload();
                pipeline.refresh({ silent: true });
              }}
            />
            <OrderListDocuments
              onImported={() => {
                list.reload();
                pipeline.refresh({ silent: true });
              }}
            />
            <ExportOrders filters={{ ...fullQuery, stage: stage ?? undefined, sort }} />
            </div>
            <Link
              to="/orders/new"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Plus className="size-4" aria-hidden />
              {t.createOrder}
            </Link>
          </div>
        }
      />

      <SearchAndDates filters={filters} showDates={datesOpen} />

      {/* The stage first: it is what a merchant switches most. */}
      <StageTabs
        value={stage}
        onChange={(next) => filters.update({ stage: next })}
        pipeline={pipeline.data}
        countsLoading={pipeline.loading}
      />

      <OrderFilterBar
        filters={extra}
        prefs={prefs}
        leading={
          <>
            <Button
              variant={datesOpen || filters.from || filters.to ? "secondary" : "outline"}
              size="sm"
              className="min-h-11 gap-1.5"
              aria-expanded={datesOpen}
              onClick={() => setDatesOpen((v) => !v)}
            >
              <CalendarDays className="size-4" aria-hidden />
              {filters.from || filters.to ? `${filters.from || "…"} → ${filters.to || "…"}` : t.dates}
            </Button>
            <SortPicker value={sort} onChange={setSort} />
          </>
        }
      />

      {/* Risk tabs: always on a wide screen; on a phone only while one is picked. */}
      <div className={cn(risk.risk ? "block" : "hidden md:block")}>
        <RiskFilter counts={orderRiskCountsOf(pipeline.data)} />
      </div>
      {pipeline.error != null && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-danger" role="alert">
          {t.countsFailed}
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => pipeline.refresh()}>
            {t.retry}
          </Button>
        </p>
      )}

      {/* Outside DataState: its result dialog must survive the list reloading. */}
      <OrderBulkBar
        selectedIds={[...selected]}
        onClear={() => setSelected(new Set())}
        onDone={() => {
          setSelected(new Set());
          list.reload();
          pipeline.refresh({ silent: true });
        }}
      />
      <SelectAllMatching
        params={{ stage: stage ?? undefined, sort, ...fullQuery }}
        pageCount={list.items.length}
        selectedCount={selected.size}
        allPageSelected={allSelected}
        hasMore={list.hasMore}
        total={pipeline.data ? (stage ? pipeline.data.stages[stage] : pipeline.data.total) : undefined}
        onSelect={(ids) => setSelected(new Set(ids))}
        onClear={() => setSelected(new Set())}
      />

      {noOrdersAtAll ? (
        <EmptyState
          icon={<ShoppingBag aria-hidden />}
          title={t.emptyAllTitle}
          description={t.emptyAllBody}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild className="min-h-11">
                <Link to="/orders/new">{t.emptyTest}</Link>
              </Button>
              {storeLink && (
                <Button variant="outline" asChild className="min-h-11">
                  <a href={storeLink} target="_blank" rel="noreferrer">
                    {t.emptyShare}
                  </a>
                </Button>
              )}
            </div>
          }
        />
      ) : (
      <DataState
        loading={list.loading}
        error={list.items.length ? null : list.error}
        empty={list.items.length === 0}
        emptyMessage={emptyMessage}
        onRetry={list.reload}
      >
        <NetworkScoresProvider orders={list.items}>
          <OrdersTable
            orders={list.items}
            columns={prefs.columns}
            selected={selected}
            onToggle={toggleSelected}
            allSelected={allSelected}
            onToggleAll={toggleAll}
          />
        </NetworkScoresProvider>
        {list.error != null && list.items.length > 0 && (
          <Alert variant="danger" className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span>
              {t.loadMoreFailed} {errorMessage(list.error)}
            </span>
            <Button size="sm" variant="outline" className="min-h-11" onClick={list.loadMore}>
              {t.retry}
            </Button>
          </Alert>
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>
      )}

      {filters.hasSearchFilters && list.items.length === 0 && !list.loading && !list.error && (
        <div className="mt-3 flex justify-center">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => filters.update({ q: null, from: null, to: null })}
          >
            {t.clearFilters}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SearchAndDates({ filters, showDates }: { filters: ReturnType<typeof useOrderFilters>; showDates: boolean }) {
  const t = useT(STRINGS);
  const searchId = useId();
  const hintId = useId();
  const fromId = useId();
  const toId = useId();
  const datesHintId = useId();

  // What's typed, ahead of the debounce. The URL only ever holds a query the
  // API accepts (2+ characters), so a single character stays local.
  const [draft, setDraft] = useState(filters.q);
  // Back/forward or a shared link changed the query under us: adopt it,
  // unless it's just what the draft already says.
  const [syncedQ, setSyncedQ] = useState(filters.q);
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    if (draft.trim() !== filters.q) setDraft(filters.q);
  }

  const { update } = filters;
  const debounced = useDebouncedValue(draft.trim(), SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    const next = debounced.length >= SEARCH_MIN ? debounced : "";
    if (next !== filters.q) update({ q: next || null });
    // Only a settled draft should write the URL — not every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const tooShort = draft.trim().length > 0 && draft.trim().length < SEARCH_MIN;

  return (
    <div className="mb-3 grid gap-3">
      <div>
        <label htmlFor={searchId} className="sr-only">
          {t.searchLabel}
        </label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
          />
          <Input
            id={searchId}
            type="search"
            value={draft}
            maxLength={SEARCH_MAX}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-describedby={hintId}
            className="h-11 ps-9 pe-11"
          />
          {draft && (
            <button
              type="button"
              onClick={() => {
                setDraft("");
                update({ q: null });
              }}
              aria-label={t.clearSearch}
              className="absolute end-0 top-0 flex size-11 cursor-pointer items-center justify-center rounded-md text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <p id={hintId} className={cn("mt-1 text-xs", tooShort ? "text-accent-dark" : "hidden text-ink-soft sm:block")} aria-live="polite">
          {tooShort ? t.searchTooShort : t.searchHint}
        </p>
      </div>

      {showDates && (
      <fieldset className="min-w-0 rounded-[var(--radius-card)] bg-paper-raised p-3 ring-1 ring-line">
        <legend className="sr-only">
          {t.from} / {t.to}
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={fromId} className="text-sm text-ink-soft">
            {t.from}
          </label>
          <Input
            id={fromId}
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => update({ from: e.target.value || null })}
            aria-describedby={datesHintId}
            className="h-11 w-auto"
          />
          <label htmlFor={toId} className="text-sm text-ink-soft">
            {t.to}
          </label>
          <Input
            id={toId}
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => update({ to: e.target.value || null })}
            aria-describedby={datesHintId}
            className="h-11 w-auto"
          />
          {/* Shortcuts, on this device's calendar like the dates themselves. */}
          {([
            ["today", 0],
            ["last7", 6],
            ["last30", 29],
          ] as const).map(([key, back]) => {
            const day = (offset: number) => localDay(Date.now() - offset * 86_400_000);
            const from = day(back);
            const to = day(0);
            const active = filters.from === from && filters.to === to;
            return (
              <Button
                key={key}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className="min-h-11"
                aria-pressed={active}
                onClick={() => update({ from, to })}
              >
                {t[key]}
              </Button>
            );
          })}
          {(filters.from || filters.to) && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={() => update({ from: null, to: null })}
            >
              {t.clearFilters}
            </Button>
          )}
        </div>
        <p id={datesHintId} className="mt-1 text-xs text-ink-soft">
          {t.datesHint}
        </p>
        {filters.rangeInvalid && (
          <p className="mt-1 text-xs font-medium text-danger" role="alert">
            {t.rangeInvalid}
          </p>
        )}
      </fieldset>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SortPicker({ value, onChange }: { value: OrderSort; onChange: (next: OrderSort) => void }) {
  const t = useT(STRINGS);
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {t.sortLabel}
      </label>
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as OrderSort)}
        className="h-11 w-auto"
      >
        {ORDER_SORTS.map((key) => (
          <option key={key} value={key}>
            {t[`sort_${key}`]}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** "Cash on delivery", or "Card · Paymob" for an online order. */
function usePaymentLabel() {
  const labels = useOrderLabels();
  return (order: Order) => {
    const method = labels.paymentMethod(order.paymentMethod);
    return order.paymentProvider ? `${method} · ${providerName(order.paymentProvider)}` : method;
  };
}

// ---------------------------------------------------------------------------

function StageTabs({
  value,
  onChange,
  pipeline,
  countsLoading,
}: {
  value: OrderStage | null;
  onChange: (next: OrderStage | null) => void;
  pipeline: OrderPipeline | null;
  countsLoading: boolean;
}) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  // A shared link may open on a tab that's scrolled out of view on a phone.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  const tabs: Array<{ key: OrderStage | null; label: string; count: number | undefined }> = [
    { key: null, label: t.tabAll, count: pipeline?.total },
    ...ORDER_STAGES.map((stage) => ({
      key: stage,
      label: labels.stage(stage),
      count: pipeline?.stages[stage],
    })),
  ];

  return (
    <div
      role="group"
      aria-label={t.tabsLabel}
      aria-busy={countsLoading || undefined}
      className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {tabs.map((tab) => {
        const selected = tab.key === value;
        return (
          <button
            key={tab.key ?? "all"}
            ref={selected ? selectedRef : undefined}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(tab.key)}
            className={cn(
              "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-[0.5rem] border px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              selected
                ? "border-primary/40 bg-primary-soft text-primary-dark dark:text-primary"
                : "border-line bg-paper-raised text-ink-soft hover:text-ink"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums",
                selected ? "bg-paper-raised text-ink" : "bg-paper text-ink-soft",
                countsLoading && "opacity-50"
              )}
            >
              {tab.count ?? "–"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

function OrdersTable({
  orders,
  columns,
  selected,
  onToggle,
  allSelected,
  onToggleAll,
}: {
  orders: Order[];
  columns: OrderColumn[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  allSelected: boolean;
  onToggleAll: () => void;
}) {
  const t = useT(STRINGS);
  const columnLabel = useColumnLabel();
  const labels = useOrderLabels();
  const paymentLabel = usePaymentLabel();
  // One clock for the whole list, so every row's "3 hours ago" moves together.
  const now = useNow(60_000);

  const rows = useMemo(
    () =>
      orders.map((order) => ({
        order,
        stageLabel: order.stage ? labels.stage(order.stage) : null,
        flagged: order.riskFlags.length > 0,
        meta: ordersMeta(order),
      })),
    [orders, labels]
  );

  return (
    <>
      <label className="mb-2 flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm text-ink-soft md:hidden">
        <input type="checkbox" className="size-5 cursor-pointer accent-primary" checked={allSelected} onChange={onToggleAll} />
        {t.selectAll}
      </label>
      {/* Phones and small tablets: one card per order. The whole card opens the
          order (a stretched link); the checkbox and the call / WhatsApp buttons
          sit above it, so they work on their own. */}
      <ul className="space-y-[var(--bento-gap)] md:hidden">
        {rows.map(({ order, stageLabel, flagged, meta }) => {
          const isSelected = selected.has(order.id);
          return (
            <li
              key={order.id}
              className={cn(
                "relative rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 transition-colors",
                isSelected ? "ring-2 ring-primary" : "ring-line"
              )}
            >
              <div className="flex items-start gap-3">
                <label className="relative z-10 -m-2 flex size-11 shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    className="size-5 cursor-pointer accent-primary"
                    checked={isSelected}
                    onChange={() => onToggle(order.id)}
                    aria-label={fmt(t.selectOrder, { number: order.orderNumber })}
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/orders/${order.id}`}
                      className={cn(
                        "min-w-0 truncate text-[15px] text-ink after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-primary",
                        meta.isSeen ? "font-medium" : "font-bold"
                      )}
                    >
                      {!meta.isSeen && <UnseenDot label={t.unseen} />}
                      <bdi>{order.contactSnapshot?.fullName || "—"}</bdi>
                    </Link>
                    <span className="shrink-0 text-[15px] font-semibold text-ink tabular-nums">
                      <bdi dir="ltr">{formatMoney(order.totalAmount, order.currency)}</bdi>
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-soft">
                    <bdi dir="ltr">{order.orderNumber}</bdi> · {paymentLabel(order)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {order.stage && stageLabel && (
                      <StatusBadge value={order.stage} tone={STAGE_TONE[order.stage]} text={stageLabel} />
                    )}
                    {flagged && <StatusBadge value="flagged" tone="danger" text={labels.flagged} />}
                    <RiskBadge order={order} />
                    <OrderNetworkRate order={order} />
                    {meta.isTest && <StatusBadge value="test" tone="warning" text={t.test} />}
                    {meta.tags.map((tag) => (
                      <StatusBadge key={tag} value={tag} tone="info" text={tag} />
                    ))}
                  </div>
                  <OrderTimelineLines order={order} now={now} className="mt-2" />
                  <ContactActions
                    phone={order.contactSnapshot?.phone}
                    name={order.contactSnapshot?.fullName}
                    className="relative z-10 mt-3"
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Tablet landscape and up: the table. */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper-sunken/60 text-start text-xs text-ink-soft">
              <th scope="col" className="w-10 ps-4 py-3">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-primary"
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label={t.selectAll}
                />
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                {t.colOrder}
              </th>
              {columns.map((column) => (
                <th key={column} scope="col" className="px-4 py-3 text-start font-medium">
                  {columnLabel(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ order, stageLabel, flagged, meta }) => (
              <tr
                key={order.id}
                className={cn(
                  "border-b border-line last:border-0 hover:bg-paper-raised",
                  selected.has(order.id) && "bg-primary-soft/50"
                )}
              >
                <td className="w-10 ps-4 py-3">
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer accent-primary"
                    checked={selected.has(order.id)}
                    onChange={() => onToggle(order.id)}
                    aria-label={fmt(t.selectOrder, { number: order.orderNumber })}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/orders/${order.id}`}
                    className={cn(
                      "inline-flex min-h-11 items-center text-ink hover:text-primary focus-visible:outline-2 focus-visible:outline-primary",
                      meta.isSeen ? "font-medium" : "font-bold"
                    )}
                  >
                    {!meta.isSeen && <UnseenDot label={t.unseen} />}
                    <bdi dir="ltr">{order.orderNumber}</bdi>
                  </Link>
                  {meta.isTest && <StatusBadge value="test" tone="warning" text={t.test} className="ms-2" />}
                </td>
                {columns.map((column) => (
                  <OrderColumnCell
                    key={column}
                    column={column}
                    row={{ order, stageLabel, flagged, meta }}
                    paymentLabel={paymentLabel(order)}
                    now={now}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** The dot in front of an order nobody has opened yet. */
function UnseenDot({ label }: { label: string }) {
  return (
    <span className="me-2 inline-block size-2 shrink-0 rounded-full bg-primary" role="img" aria-label={label} title={label} />
  );
}
