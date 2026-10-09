import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Button, cn } from "@store-builder/ui";
import {
  ORDER_PICK_LIST_MAX,
  orderPackingNothingToPrint,
  orderPickList,
  orderPickListPdf,
  type OrderPickList,
  type OrderPickListLine,
  type OrderPickListLocation,
  type OrderPickListRequest,
} from "@store-builder/api-client";
import { AccordionGroup, AccordionSection } from "@/components/Accordion";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { CardSkeleton, DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconClipboard, IconCopy, IconInventory, IconOrders, IconPrint, IconRefresh, IconScan, IconSpinner } from "@/components/icons";
import { ListRowCard } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatDate } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useViewNavigate } from "@/lib/viewTransition";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { copyText } from "../list/orderRow";
import { useIsDesktop } from "../list/useIsDesktop";
import { useOrderErrorMessage } from "../orderErrors";
import { MeterBar, Pane, TickBox } from "./packingBits";
import { openPdf } from "./PackingSlipsDialog";
import { readPickListSelection, readPickListTicks, savePickListTicks, type PickListMode } from "./packingStorage";
import { PACKING_STRINGS } from "./packingStrings";

/** Order numbers shown under a line, and orders listed for packing, before "show all". */
const LINE_ORDERS_SHOWN = 10;
const ORDERS_SHOWN = 20;

/** The columns of the orders sheet from md up: the order, its pieces, the way into the packing station. */
const ORDER_COLUMNS = "grid-cols-[minmax(0,1fr)_max-content_max-content]";

/** The two faces of one pick list: what to take off the shelves, and the orders it is for. */
type View = "items" | "orders";

const locationKey = (location: OrderPickListLocation) => location.locationId ?? "main";

/** A line's tick is for this quantity: when orders come in and it grows, the line is to pick again. */
function lineKey(location: OrderPickListLocation, line: OrderPickListLine): string {
  const what = line.variantId ?? `${line.name}|${JSON.stringify(line.options ?? {})}`;
  return `${locationKey(location)}|${what}|${line.quantity}`;
}

const optionsText = (options: Record<string, string> | null | undefined) => Object.values(options ?? {}).filter(Boolean).join(" / ");

/**
 * Orders → Pick list (handoff 226, orders.view): what to take off the shelves
 * for a batch of orders — the pieces summed per product, grouped by the stock
 * location each order ships from, with the orders every line serves. For the
 * orders ticked in the list, or (`?ready=1`) every order ready to ship.
 *
 * Top to bottom: how far the picking is (one bar), a switch between the two
 * faces of the list — the items to pick, and the orders to pack — then the
 * list. A line is ticked off with a press anywhere on it; «اطبع» (above the
 * dock on a phone) opens the same list as an A4 PDF, and each order goes on
 * to "Scan to pack" (handoff 249).
 */
export function PickListPage() {
  const workspaceId = useWorkspaceId();
  const t = useT(PACKING_STRINGS);
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const navigate = useViewNavigate();
  const desktop = useIsDesktop();
  const [params] = useSearchParams();
  const location = useLocation();
  const ready = params.get("ready") === "1";
  const mode: PickListMode = ready ? "ready" : "selection";

  // The ticked orders: from the navigation that opened the page, else from the session (a reload).
  const selection = useMemo(() => {
    const nav = location.state as { workspaceId?: unknown; orderIds?: unknown } | null;
    const fromNav: unknown = nav && nav.workspaceId === workspaceId ? nav.orderIds : null;
    const ids = Array.isArray(fromNav)
      ? fromNav.filter((id): id is string => typeof id === "string")
      : readPickListSelection(workspaceId);
    return ids.slice(0, ORDER_PICK_LIST_MAX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, location.key]);

  const request: OrderPickListRequest | null = ready ? { readyToShip: true } : selection.length > 0 ? { orderIds: selection } : null;
  const list = useAsync<OrderPickList | null>(
    () => (request ? orderPickList(apiClient, workspaceId, request) : Promise.resolve(null)),
    [workspaceId, ready, selection]
  );
  const data = list.data;
  // 422 NO_ORDERS_SELECTED: every ticked order is cancelled, or nothing is ready to ship. Not a failure.
  const nothing = orderPackingNothingToPrint(list.error);

  const [ticks, setTicks] = useState<Set<string>>(() => new Set(readPickListTicks(mode)));
  useEffect(() => {
    setTicks(new Set(readPickListTicks(mode)));
  }, [mode, selection]);
  function toggle(key: string) {
    const next = new Set(ticks);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setTicks(next);
    savePickListTicks(mode, [...next]);
  }

  const [view, setView] = useState<View>("items");

  const [printing, setPrinting] = useState(false);
  async function print() {
    if (!request || printing) return;
    setPrinting(true);
    try {
      const { pdf } = await orderPickListPdf(apiClient, workspaceId, request);
      openPdf(pdf);
    } catch (err) {
      toast.error(orderPackingNothingToPrint(err) ? (ready ? t.emptyReadyTitle : t.emptyCancelledBody) : errorMessage(err));
    } finally {
      setPrinting(false);
    }
  }

  // Reading the list again keeps what is on screen in place; the button says it is working.
  const [refreshing, setRefreshing] = useState(false);
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await list.refresh({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }

  const lines = data ? data.locations.flatMap((loc) => loc.lines.map((line) => lineKey(loc, line))) : [];
  const picked = lines.filter((key) => ticks.has(key)).length;
  const allPicked = lines.length > 0 && picked === lines.length;

  // Every order of the list once, with its pieces, for "Scan to pack".
  const orders = useMemo(() => {
    const byId = new Map<string, { orderId: string; orderNumber: string; pieces: number }>();
    for (const loc of data?.locations ?? []) {
      for (const line of loc.lines) {
        for (const o of line.orders) {
          const row = byId.get(o.orderId) ?? { orderId: o.orderId, orderNumber: o.orderNumber, pieces: 0 };
          row.pieces += o.quantity;
          byId.set(o.orderId, row);
        }
      }
    }
    return [...byId.values()].sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
  }, [data]);
  const [allOrders, setAllOrders] = useState(false);
  const shownOrders = allOrders ? orders : orders.slice(0, ORDERS_SHOWN);

  const modeText = ready ? t.modeReady : t.modeSelection;
  const pickedText = fmt(t.pickedCount, { done: picked, total: lines.length });
  const pill = "min-h-11 rounded-full px-5";
  // Where a packer comes back to after an order: this list, as it is filtered now.
  const here = `${location.pathname}${location.search}`;

  const copy = async (value: string) => {
    if (await copyText(value)) toast.success(t.copiedOrder);
    else toast.error(t.copyFailed);
  };

  function orderMenu(order: { orderId: string; orderNumber: string }): ContextMenuItem[] {
    return [
      { id: "pack", label: t.scanToPack, icon: IconScan, onSelect: () => navigate(`/orders/${order.orderId}/pack`, { state: { pickList: here } }) },
      { id: "open", label: fmt(t.openOrder, { number: order.orderNumber }), icon: IconOrders, onSelect: () => navigate(`/orders/${order.orderId}`) },
      { id: "copy", label: t.copyOrder, icon: IconCopy, separatorBefore: true, onSelect: () => void copy(order.orderNumber) },
    ];
  }

  const packLink = (order: { orderId: string; orderNumber: string }) => (
    <Button
      asChild
      variant="outline"
      data-tone="quiet"
      className="zimos-row-action h-11 max-w-full gap-1.5 rounded-full px-4 text-[13px] pointer-fine:h-9 pointer-fine:px-3.5"
    >
      <ViewLink to={`/orders/${order.orderId}/pack`} state={{ pickList: here }} aria-label={fmt(t.packOrder, { number: order.orderNumber })}>
        <IconScan className="size-4" weight="bold" aria-hidden />
        {t.pack}
      </ViewLink>
    </Button>
  );

  const goOrders = (
    <Button asChild variant="outline" className={pill}>
      <Link to="/orders">{t.goOrders}</Link>
    </Button>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={t.pickList}
        back={{ to: ready ? "/orders?stage=ready_to_ship" : "/orders", label: t.back }}
        // A phone keeps the first screen for the list: the sentence is under the bar there.
        description={desktop && request && !nothing ? modeText : undefined}
        actions={
          data ? (
            <Button
              type="button"
              variant="outline"
              aria-label={t.refresh}
              title={t.refresh}
              aria-busy={refreshing || undefined}
              onClick={() => void refresh()}
              className="size-11 rounded-full p-0 md:w-auto md:gap-2 md:ps-3.5 md:pe-4"
            >
              {refreshing ? (
                <IconSpinner className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <IconRefresh className="size-5" aria-hidden />
              )}
              <span className="hidden md:inline">{t.refresh}</span>
            </Button>
          ) : undefined
        }
        primaryAction={
          data ? (
            <Button className={cn(pill, "gap-2")} onClick={() => void print()} disabled={printing} aria-busy={printing || undefined}>
              {printing ? (
                <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" weight="bold" aria-hidden />
              ) : (
                <IconPrint className="size-4" weight="bold" aria-hidden />
              )}
              {printing ? t.preparing : t.print}
            </Button>
          ) : undefined
        }
      />

      {!request ? (
        <EmptyState
          icon={<IconClipboard aria-hidden />}
          title={t.emptySelectionTitle}
          description={t.emptySelectionBody}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild className={pill}>
                <Link to="/orders/pick-list?ready=1">{t.pickReady}</Link>
              </Button>
              {goOrders}
            </div>
          }
        />
      ) : nothing ? (
        <EmptyState
          icon={<IconClipboard aria-hidden />}
          title={ready ? t.emptyReadyTitle : t.emptyCancelledTitle}
          description={ready ? t.emptyReadyBody : t.emptyCancelledBody}
          action={goOrders}
        />
      ) : (
        <DataState
          loading={list.loading}
          error={data ? null : list.error}
          onRetry={() => void list.refresh()}
          skeleton={
            <div className="flex flex-col gap-3">
              <CardSkeleton lines={1} />
              <CardSkeleton lines={6} />
            </div>
          }
        >
          {data && (
            <div className="flex flex-col gap-3">
              <Pane className="zimos-pick-summary p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p role="status" className="text-[15px] leading-6 font-semibold text-ink tabular-nums">
                    {pickedText}
                  </p>
                  <p className="text-sm text-ink-soft tabular-nums">
                    {fmt(t.summary, { orders: countOf("order", data.orderCount), pieces: countOf("piece", data.unitCount) })}
                  </p>
                </div>
                <MeterBar value={picked} max={lines.length} label={pickedText} done={allPicked} className="mt-3" />
                {!desktop && <p className="mt-2.5 text-xs leading-5 text-ink-soft">{modeText}</p>}
                {/* Everything is off the shelves: the next step is one press away. */}
                {allPicked && view === "items" && orders.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <p className="min-w-0 text-sm font-medium text-success">{t.allPicked}</p>
                    <Button type="button" className={cn(pill, "gap-2")} onClick={() => setView("orders")}>
                      <IconScan className="size-4" weight="bold" aria-hidden />
                      {t.goPack}
                    </Button>
                  </div>
                )}
              </Pane>

              <Segmented
                value={view}
                onChange={setView}
                label={t.viewLabel}
                options={[
                  { value: "items", label: t.viewItems, icon: IconClipboard, count: lines.length },
                  { value: "orders", label: t.viewOrders, icon: IconScan, count: orders.length },
                ]}
                className="w-full sm:w-auto sm:self-start"
              />

              {view === "items" ? (
                <AccordionGroup className="gap-3">
                  {data.locations.map((loc) => {
                    const keys = loc.lines.map((line) => lineKey(loc, line));
                    const done = keys.filter((key) => ticks.has(key)).length;
                    return (
                      <AccordionSection
                        key={locationKey(loc)}
                        title={loc.name || t.mainStock}
                        icon={IconInventory}
                        summary={fmt(t.pickedCount, { done, total: keys.length })}
                        badge={
                          <span className="text-xs font-medium text-ink-soft tabular-nums">
                            <bdi>{fmt(t.pickedOf, { done, total: keys.length })}</bdi>
                          </span>
                        }
                        defaultOpen
                        persistKey={`pick:${mode}:${locationKey(loc)}`}
                        flush
                      >
                        <ul>
                          {loc.lines.map((line) => {
                            const key = lineKey(loc, line);
                            const ticked = ticks.has(key);
                            const options = optionsText(line.options);
                            const shown = line.orders.slice(0, LINE_ORDERS_SHOWN);
                            const more = line.orders.length - shown.length;
                            return (
                              <li
                                key={key}
                                data-done={ticked ? "" : undefined}
                                className={cn(
                                  "zimos-pick-line border-b border-line px-4 py-1.5 transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] last:border-0 motion-reduce:transition-none",
                                  ticked && "bg-paper-sunken/60"
                                )}
                              >
                                <label className="flex min-h-14 cursor-pointer items-center gap-3">
                                  <TickBox checked={ticked} onChange={() => toggle(key)} />
                                  {line.imageUrl && (
                                    <img
                                      src={line.imageUrl}
                                      alt=""
                                      loading="lazy"
                                      className="size-11 shrink-0 rounded-[0.75rem] bg-paper-sunken object-cover ring-1 ring-line"
                                    />
                                  )}
                                  <span className={cn("shrink-0 text-lg leading-7 font-bold tabular-nums", ticked ? "text-ink-soft" : "text-ink")}>
                                    {fmt("{count} ×", { count: line.quantity })}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className={cn("block text-[15px] leading-6 font-medium", ticked ? "text-ink-soft line-through" : "text-ink")}>
                                      <bdi>{line.name}</bdi>
                                      {options && (
                                        <>
                                          {" — "}
                                          <bdi>{options}</bdi>
                                        </>
                                      )}
                                    </span>
                                    <span className="block text-xs leading-5 text-ink-soft">
                                      {line.sku ? (
                                        <bdi dir="ltr" className="font-mono">
                                          {line.sku}
                                        </bdi>
                                      ) : (
                                        t.noSku
                                      )}
                                    </span>
                                  </span>
                                </label>

                                <div className="ms-12 pb-2 text-xs leading-5 text-ink-soft">
                                  {/* Which lots to take it from, first expiring first (handoff 230). */}
                                  {(line.lots ?? []).map((lot) => (
                                    <p key={lot.lotId} className={cn("font-medium", lot.expired ? "text-danger" : "text-accent-dark")}>
                                      <bdi>{fmt(t.lot, { code: lot.lotCode })}</bdi>
                                      {lot.expiresOn && <> · {fmt(t.lotExpires, { date: formatDate(lot.expiresOn) })}</>}
                                      {lot.expired && <> · {t.lotExpired}</>}
                                      {" · "}
                                      {fmt(t.lotTake, { count: lot.take })}
                                    </p>
                                  ))}
                                  {/* Under a finger each number is a 44px target: the rows of chips keep that much apart. */}
                                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-4 pointer-fine:gap-y-1.5">
                                    <span className="sr-only">{t.forOrders}: </span>
                                    {shown.map((o) => (
                                      <ViewLink
                                        key={o.orderId}
                                        to={`/orders/${o.orderId}`}
                                        aria-label={fmt(t.openOrder, { number: o.orderNumber })}
                                        className="zimos-pick-order relative inline-flex h-7 items-center gap-1 rounded-full bg-paper-sunken px-2.5 text-xs font-medium text-ink tabular-nums transition-[color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] before:absolute before:-inset-x-1 before:-inset-y-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.97] motion-reduce:transition-none"
                                      >
                                        <bdi dir="ltr">{o.orderNumber}</bdi>
                                        {o.quantity > 1 && <span className="text-ink-soft">{fmt(t.timesCount, { count: o.quantity })}</span>}
                                      </ViewLink>
                                    ))}
                                    {more > 0 && (
                                      <span className="tabular-nums">
                                        <bdi dir="ltr">{fmt(t.moreOrders, { n: more })}</bdi>
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </AccordionSection>
                    );
                  })}
                </AccordionGroup>
              ) : (
                <section aria-label={t.ordersTitle} className="flex flex-col gap-3">
                  <p className="px-1 text-sm leading-6 text-ink-soft">{t.ordersHint}</p>
                  {desktop ? (
                    <DeskList
                      columns={ORDER_COLUMNS}
                      label={t.ordersTitle}
                      head={[{ label: t.colOrder }, { label: t.colPieces }, { label: t.colAction, end: true }]}
                    >
                      {shownOrders.map((o) => (
                        <DeskRow key={o.orderId} menu={orderMenu(o)} menuLabel={fmt(t.menuLabel, { number: o.orderNumber })}>
                          <div className="min-w-0">
                            <ViewLink
                              to={`/orders/${o.orderId}`}
                              aria-label={fmt(t.openOrder, { number: o.orderNumber })}
                              className="inline-flex min-h-9 max-w-full items-center rounded-sm text-[15px] font-medium text-ink tabular-nums hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              <bdi dir="ltr" className="truncate">
                                {o.orderNumber}
                              </bdi>
                            </ViewLink>
                          </div>
                          <div className="text-sm whitespace-nowrap text-ink-soft tabular-nums">{countOf("piece", o.pieces)}</div>
                          <div className="flex items-center justify-end">{packLink(o)}</div>
                        </DeskRow>
                      ))}
                    </DeskList>
                  ) : (
                    <ul aria-label={t.ordersTitle} className="flex flex-col gap-2.5">
                      {shownOrders.map((o) => (
                        <li key={o.orderId}>
                          <ContextMenu items={orderMenu(o)} label={fmt(t.menuLabel, { number: o.orderNumber })}>
                            <ListRowCard
                              title={<bdi dir="ltr">{o.orderNumber}</bdi>}
                              meta={<span className="tabular-nums">{countOf("piece", o.pieces)}</span>}
                              action={packLink(o)}
                              onOpen={() => navigate(`/orders/${o.orderId}`)}
                              openLabel={fmt(t.openOrder, { number: o.orderNumber })}
                            />
                          </ContextMenu>
                        </li>
                      ))}
                    </ul>
                  )}
                  {orders.length > shownOrders.length && (
                    <div className="flex justify-center pt-1">
                      <Button variant="outline" className={pill} onClick={() => setAllOrders(true)}>
                        {fmt(t.showAllOrders, { count: orders.length })}
                      </Button>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </DataState>
      )}
    </div>
  );
}
