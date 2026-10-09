import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import {
  PICKUP_STATUSES,
  isPickupStale,
  pickupList,
  pickupMarkReady,
  pickupSettingsGet,
  stockLocationsList,
  type PickupListItem,
  type PickupStatus,
} from "@store-builder/api-client";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconPacked, IconSearch, IconSliders, IconStore } from "@/components/icons";
import { ChipRow, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { PageHeader } from "@/components/PageHeader";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { canManageOrderFulfilment } from "@/lib/fulfilmentAccess";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { DeskList } from "@/pages/returns/rowkit/DeskList";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { HandOverDialog, type HandOverOrder } from "./HandOverDialog";
import { PickupQuickLook } from "./PickupQuickLook";
import { PICKUP_COLUMNS, PICKUP_COLUMNS_ONE_PLACE, PickupRow } from "./PickupRow";
import { PICKUP_STRINGS } from "./pickupStrings";

type Filter = PickupStatus | "all";
const PAGE_SIZE = 50;
/** The chips, in the order the work goes: what to prepare first. */
const FILTERS: readonly Filter[] = ["pending", "ready", "collected", "cancelled", "all"];
/** The queue opens on the orders to prepare; the link carries any other chip. */
const DEFAULT_FILTER: Filter = "pending";

function isFilter(value: string | null): value is Filter {
  return value === "all" || (PICKUP_STATUSES as readonly string[]).includes(value ?? "");
}

/** Lower case, and Arabic-Indic digits as Latin ones: «١٠٢٤» finds #1024. */
function fold(text: string): string {
  return text.toLowerCase().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function handOverOf(item: PickupListItem): HandOverOrder {
  return {
    id: item.orderId,
    orderNumber: item.order.orderNumber,
    customerName: item.order.customerName,
    totalAmount: item.order.totalAmount,
    currency: item.order.currency,
    paid: item.order.financialState === "paid",
  };
}

/**
 * Orders → «أوردرات الاستلام» (handoff 225, read orders.view): the click-and-
 * collect work queue. It opens on the orders to prepare; «جاهز» marks one
 * ready (the shopper is emailed the place and the code), «تسليم» asks for the
 * shopper's 6-digit code and hands the order over.
 *
 * Top to bottom: the search (and the place, for a store with more than one),
 * the status chips with the two open counts, then the pickups — cards on a
 * phone, a sheet of rows on a wide screen. A row opens Quick Look; its ONE
 * button is the move its status allows. `?status=` keeps the chosen chip, so a
 * link opens a given one and coming back from an order lands where the
 * merchant left.
 */
export function PickupsPage() {
  const t = useT(PICKUP_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageOrderFulfilment(currentWorkspace?.role);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const compact = useIsCompact();
  const phone = useIsPhone();

  const [params, setParams] = useSearchParams();
  const asked = params.get("status");
  const filter: Filter = isFilter(asked) ? asked : DEFAULT_FILTER;
  function selectFilter(next: Filter) {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === DEFAULT_FILTER) out.delete("status");
        else out.set("status", next);
        return out;
      },
      { replace: true }
    );
  }
  const [locationId, setLocationId] = useState("");
  const [search, setSearch] = useState("");
  const status = filter === "all" ? undefined : filter;

  // The answer is tagged with what it is for: while another chip's list is on its way, the last one is not shown under it.
  const listTag = `${workspaceId}:${filter}:${locationId}`;
  const list = useCachedAsync(
    `pickups:${listTag}`,
    async () => ({ tag: listTag, ...(await pickupList(apiClient, workspaceId, { status, locationId: locationId || undefined, limit: PAGE_SIZE })) }),
    [workspaceId, filter, locationId]
  );
  const page = list.data && list.data.tag === listTag ? list.data : null;
  // Pages after the first, appended by "Load more"; a different list — or the same one read again — starts over.
  const [more, setMore] = useState<PickupListItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    setMore([]);
  }, [workspaceId, filter, locationId, list.data]);
  const pickups = [...(page?.pickups ?? []), ...more];
  const total = page?.total ?? 0;

  // The two open queues' sizes, whatever chip is shown — and whether the store ever had a pickup at all.
  const counts = useAsync(
    () =>
      Promise.all([
        pickupList(apiClient, workspaceId, { status: "pending", locationId: locationId || undefined, limit: 1 }),
        pickupList(apiClient, workspaceId, { status: "ready", locationId: locationId || undefined, limit: 1 }),
        pickupList(apiClient, workspaceId, { limit: 1 }),
      ]).then(([pending, ready, all]) => ({ pending: pending.total, ready: ready.total, all: all.total })),
    [workspaceId, locationId]
  );
  // Whether shoppers are offered pickup at all, for the empty page of a store that never used it.
  const settings = useAsync(() => pickupSettingsGet(apiClient, workspaceId).catch(() => null), [workspaceId]);
  // The places' names for the filter; a role that can't read locations gets the ones the list itself names.
  const places = useAsync(() => stockLocationsList(apiClient, workspaceId).then((r) => r.locations).catch(() => null), [workspaceId]);
  const placeOptions = (() => {
    const on = settings.data?.locations ?? {};
    const named = (places.data ?? []).filter((l) => on[l.id]).map((l) => ({ id: l.id, name: l.name }));
    const seen = new Map(named.map((p) => [p.id, p.name]));
    for (const p of pickups) if (p.location?.id && !seen.has(p.location.id)) seen.set(p.location.id, p.location.name);
    return [...seen].map(([id, name]) => ({ id, name }));
  })();
  // With one pickup place the column would say the same thing on every row.
  const showPlace = placeOptions.length > 1;

  const [marking, setMarking] = useState<string | null>(null);
  const [handingOver, setHandingOver] = useState<HandOverOrder | null>(null);
  // The pickup being looked at stays here while its panel closes, so the panel does not empty on its way out.
  const [peek, setPeek] = useState<{ orderId: string; open: boolean } | null>(null);
  const [peekKept, setPeekKept] = useState<PickupListItem | null>(null);

  function reload() {
    void list.refresh({ silent: true });
    void counts.refresh({ silent: true });
  }

  async function markReady(item: PickupListItem) {
    if (marking) return;
    setMarking(item.orderId);
    try {
      const { emailed } = await pickupMarkReady(apiClient, workspaceId, item.orderId);
      toast.success(fmt(emailed ? t.readyDone : t.readyDoneNoEmail, { number: item.order.orderNumber }));
      reload();
    } catch (err) {
      if (isPickupStale(err)) {
        toast.error(t.stale);
        reload();
      } else {
        toast.error(isPermissionError(err) ? t.noOrderManage : errorMessage(err));
      }
    } finally {
      setMarking(null);
    }
  }

  /** «تسليم» asks for the code in its own sheet. Quick Look steps aside for it: two sheets are never stacked. */
  function askHandOver(item: PickupListItem) {
    setPeek((current) => (current ? { ...current, open: false } : current));
    setHandingOver(handOverOf(item));
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await pickupList(apiClient, workspaceId, { status, locationId: locationId || undefined, limit: PAGE_SIZE, offset: pickups.length });
      const have = new Set(pickups.map((p) => p.orderId));
      setMore((prev) => [...prev, ...next.pickups.filter((p) => !have.has(p.orderId))]);
    } catch {
      toast.error(t.loadFailed);
    } finally {
      setLoadingMore(false);
    }
  }

  const query = fold(search.trim());
  const visible = query
    ? pickups.filter((p) => [p.order.orderNumber, p.order.customerName, p.order.phone].some((part) => part && fold(part).includes(query)))
    : pickups;
  const hasMore = pickups.length < total;

  // The row that was peeked at may leave the list (marked ready, handed over): its last look stays for the panel's way out.
  const peekedNow = peek ? (pickups.find((p) => p.orderId === peek.orderId) ?? null) : null;
  if (peekedNow && peekedNow !== peekKept) setPeekKept(peekedNow);
  const peeked = peekedNow ?? (peek && peekKept?.orderId === peek.orderId ? peekKept : null);

  const chips = FILTERS.map((value): ChipItem<Filter> => ({
    value,
    label: value === "pending" ? t.tabPending : value === "ready" ? t.tabReady : value === "collected" ? t.tabCollected : value === "cancelled" ? t.tabCancelled : t.tabAll,
    // The two open queues and the whole list are counted; a closed chip has no figure of its own.
    count: value === "pending" ? (counts.data?.pending ?? null) : value === "ready" ? (counts.data?.ready ?? null) : value === "all" ? (counts.data?.all ?? null) : undefined,
    tone: value === "pending" ? "attention" : undefined,
  }));

  // A store that does not offer pickup and never had one: say where to turn it on, instead of five empty chips.
  const neverUsed = settings.data?.enabled === false && counts.data?.all === 0;
  const loading = page === null && list.error == null;
  const pill = "min-h-11 rounded-full px-5";

  const rows = visible.map((item) => (
    <PickupRow
      key={item.orderId}
      item={item}
      compact={compact}
      showPlace={showPlace}
      canManage={canManage}
      marking={marking === item.orderId}
      locked={marking !== null}
      current={peek?.open === true && peek.orderId === item.orderId}
      onPeek={() => setPeek({ orderId: item.orderId, open: true })}
      onMarkReady={() => void markReady(item)}
      onHandOver={() => askHandOver(item)}
    />
  ));

  const empty = query ? (
    <EmptyState
      icon={<IconSearch aria-hidden />}
      title={t.emptySearchTitle}
      description={hasMore ? t.searchLoaded : undefined}
      action={
        <Button type="button" variant="outline" className={pill} onClick={() => setSearch("")}>
          {t.clearSearch}
        </Button>
      }
    />
  ) : filter === "pending" ? (
    <EmptyState tone="success" icon={<IconPacked aria-hidden />} title={t.emptyPendingTitle} description={t.emptyPendingBody} />
  ) : filter === "ready" ? (
    <EmptyState icon={<IconPacked aria-hidden />} title={t.emptyReadyTitle} description={t.emptyReadyBody} />
  ) : (
    <EmptyState
      icon={<IconSearch aria-hidden />}
      title={t.emptyOtherTitle}
      action={
        filter === "all" ? undefined : (
          <Button type="button" variant="outline" className={pill} onClick={() => selectFilter("all")}>
            {t.showAll}
          </Button>
        )
      }
    />
  );

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t.queueTitle}
        // A phone keeps the first screen for the queue: the sentence is for wider screens.
        description={phone ? undefined : t.queueDescription}
        back={{ to: "/orders", label: t.backToOrders }}
        actions={
          <Button asChild variant="outline" className="h-11 gap-2 rounded-full px-3 sm:px-4">
            <Link to="/shipping?tab=pickup" aria-label={t.settingsLink} title={t.settingsLink}>
              <IconSliders className="size-4" aria-hidden />
              <span className="max-sm:sr-only">{t.settingsLink}</span>
            </Link>
          </Button>
        }
      />

      {neverUsed ? (
        <EmptyState
          tone="attention"
          icon={<IconStore aria-hidden />}
          title={t.offTitle}
          description={t.offBody}
          action={
            <Button asChild className={pill}>
              <Link to="/shipping?tab=pickup">{t.offAction}</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }}>
            {/* One filter beside the chips: it sits in the toolbar itself, not behind a sheet. */}
            {showPlace && (
              <Select
                aria-label={t.placeFilter}
                className="h-11 w-auto max-w-[12rem] rounded-full ps-4 pe-8 text-sm pointer-coarse:text-base"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">{t.allPlaces}</option>
                {placeOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </ListToolbar>

          <ChipRow items={chips} value={filter} onChange={selectFilter} label={t.filterLabel} collapseEmpty={false} countsLoading={counts.loading && !counts.data} />

          <DataState
            loading={loading}
            // A refresh that failed behind rows already on screen leaves them there.
            error={page ? null : list.error}
            onRetry={() => void list.refresh()}
            skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}
          >
            {visible.length === 0 ? (
              empty
            ) : compact ? (
              <ul aria-label={t.listLabel} className="flex flex-col gap-2.5">
                {rows}
              </ul>
            ) : (
              <DeskList
                columns={showPlace ? PICKUP_COLUMNS : PICKUP_COLUMNS_ONE_PLACE}
                label={t.listLabel}
                head={[
                  { label: t.colCustomer },
                  { label: t.colStatus },
                  ...(showPlace ? [{ label: t.colPlace }] : []),
                  { label: t.colTotal },
                  { label: t.colAge },
                  { label: t.colAction, end: true },
                ]}
              >
                {rows}
              </DeskList>
            )}
            {query && hasMore && visible.length > 0 && <p className="px-1 pt-3 text-xs leading-5 text-ink-soft">{t.searchLoaded}</p>}
            <LoadMore hasMore={hasMore} loading={loadingMore} onClick={() => void loadMore()} />
          </DataState>
        </div>
      )}

      <PickupQuickLook
        item={peeked}
        open={Boolean(peek?.open)}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        canManage={canManage}
        marking={peeked ? marking === peeked.orderId : false}
        locked={marking !== null}
        onMarkReady={() => {
          if (peeked) void markReady(peeked);
        }}
        onHandOver={() => {
          if (peeked) askHandOver(peeked);
        }}
      />

      <HandOverDialog order={handingOver} onClose={() => setHandingOver(null)} onDone={reload} />
    </div>
  );
}
