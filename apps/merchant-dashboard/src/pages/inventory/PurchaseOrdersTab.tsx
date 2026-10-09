import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import {
  PURCHASE_ORDER_STATUSES,
  purchaseOrderGet,
  purchaseOrdersList,
  type PurchaseOrderStatus,
  type PurchaseOrderSummary,
} from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState, SkeletonBar } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconClipboard, IconCopy, IconFactory, IconPacked, IconPlus, IconSearch } from "@/components/icons";
import { ChipRow, FilterChoice, FilterGroup, FilterSheet, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { PageActionBar } from "@/components/PageHeader";
import { QuickLook } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatMoney } from "@/lib/format";
import { canManageInventory } from "@/lib/inventoryAccess";
import { countOf, pluralOf } from "@/lib/plural";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatDay } from "@/lib/wholeNumber";
import { ActiveFilters, type ActiveFilter } from "@/pages/returns/rowkit/ActiveFilters";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction, rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { num, variantDetail, variantFullName } from "./inventoryText";
import { BlockLabel, Fact, Facts, Meter, TOOL_BUTTON, ViewOnlyNote, Well, foldText, matchesText } from "./kit";
import { PO_STATUS_KEY, PO_STATUS_TONE, PURCHASING_STRINGS } from "./purchasingStrings";
import { INV_UI } from "./sweepStrings";

type Filter = "all" | PurchaseOrderStatus;

/** Most purchase orders one read answers with (the API's cap): fewer than this, and the whole store is in hand. */
const PO_LIST_CAP = 200;

const PO_COLUMNS = "grid-cols-[minmax(0,1.4fr)_max-content_max-content_minmax(7rem,max-content)_max-content_max-content]";
const FOOTER_PILL = "pointer-fine:h-10 pointer-fine:px-4";
const NAME_LINK =
  "rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const isStatus = (value: string | null): value is PurchaseOrderStatus => PURCHASE_ORDER_STATUSES.includes(value as PurchaseOrderStatus);
const receivable = (po: PurchaseOrderSummary) => po.status === "ordered" || po.status === "partially_received";

/**
 * Inventory → «أوامر الشراء» / Purchase orders (handoff 207): each order with
 * its supplier, its status chip, when it is expected, how much of it arrived
 * and what it costs. Search, the status chips, and ONE Filters sheet (the
 * supplier); a row opens its preview, and «استلام» on a row that still has
 * units to come goes straight to receiving.
 *
 * `?status=` and `?supplier=` keep the chip and the supplier, so a link lands
 * on the same list. While the store has fewer orders than one read holds, the
 * chips narrow it here and say how many each holds; past that a chip asks the
 * server, as before.
 */
export function PurchaseOrdersTab() {
  const t = useT(PURCHASING_STRINGS);
  const u = useT(INV_UI);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const copy = useCopy();
  const compact = useIsCompact();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageInventory(currentWorkspace?.role);
  const [params, setParams] = useSearchParams();
  const rawStatus = params.get("status");
  const filter: Filter = isStatus(rawStatus) ? rawStatus : "all";
  const supplierId = params.get("supplier") ?? "";

  function setParam(key: "status" | "supplier", value: string | null) {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (value) out.set(key, value);
        else out.delete(key);
        return out;
      },
      { replace: true }
    );
  }

  const everything = useCachedAsync<PurchaseOrderSummary[]>(`inventory:po:${workspaceId}`, () => purchaseOrdersList(apiClient, workspaceId), [workspaceId]);
  const all = everything.data;
  const complete = all ? all.length < PO_LIST_CAP : true;
  const narrowOnServer = !complete && (filter !== "all" || supplierId !== "");
  const narrowed = useAsync(
    () =>
      narrowOnServer
        ? purchaseOrdersList(apiClient, workspaceId, { status: filter === "all" ? undefined : filter, supplierId: supplierId || undefined })
        : Promise.resolve(null),
    [workspaceId, filter, supplierId, narrowOnServer]
  );

  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);

  const inFilter = useMemo(() => {
    if (!all) return [];
    if (narrowOnServer) return narrowed.data ?? [];
    return all.filter((po) => (filter === "all" || po.status === filter) && (!supplierId || po.supplier.id === supplierId));
  }, [all, narrowOnServer, narrowed.data, filter, supplierId]);
  const needle = foldText(search.trim());
  const orders = inFilter.filter((po) => matchesText(needle, [po.number, po.supplier.name, po.note]));

  // The suppliers that have orders, for the filter: read from the list itself.
  const suppliers = useMemo(() => {
    const seen = new Map<string, string>();
    for (const po of all ?? []) if (!seen.has(po.supplier.id)) seen.set(po.supplier.id, po.supplier.name ?? t.unknownSupplier);
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [all, t.unknownSupplier]);
  const supplierName = suppliers.find((s) => s.value === supplierId)?.label ?? t.unknownSupplier;

  const countFor = (value: Filter): number | null => {
    if (!all || !complete) return null;
    const mine = supplierId ? all.filter((po) => po.supplier.id === supplierId) : all;
    return value === "all" ? mine.length : mine.filter((po) => po.status === value).length;
  };
  const chips: ChipItem<Filter>[] = [
    { value: "all", label: t.filterAll, count: countFor("all") },
    ...PURCHASE_ORDER_STATUSES.map((status) => ({ value: status, label: t[PO_STATUS_KEY[status]], count: countFor(status) })),
  ];
  const activeFilters: ActiveFilter[] = supplierId
    ? [{ id: "supplier", label: fmt(u.supplierChip, { name: supplierName }), onRemove: () => setParam("supplier", null) }]
    : [];
  const narrowedDown = filter !== "all" || supplierId !== "" || needle !== "";

  function clearAll() {
    setSearch("");
    setParams({}, { replace: true });
  }

  const pathOf = (po: PurchaseOrderSummary) => `/inventory/purchase-orders/${po.id}`;

  function menuOf(po: PurchaseOrderSummary): ContextMenuItem[] {
    const items: ContextMenuItem[] = [{ id: "open", label: u.openFully, icon: IconClipboard, onSelect: () => navigate(pathOf(po)) }];
    if (canManage && receivable(po)) {
      items.push({ id: "receive", label: t.receive, icon: IconPacked, onSelect: () => navigate(`${pathOf(po)}?receive=1`) });
    }
    items.push({ id: "copy", label: u.copyNumber, icon: IconCopy, separatorBefore: true, onSelect: () => copy(po.number, u.copiedNumber) });
    if (supplierId !== po.supplier.id) {
      items.push({ id: "supplier", label: u.supplierOrders, icon: IconFactory, onSelect: () => setParam("supplier", po.supplier.id) });
    }
    return items;
  }

  const newButton = (
    <Button asChild className={TOOL_BUTTON}>
      <ViewLink to="/inventory/purchase-orders/new">
        <IconPlus className="size-4" weight="bold" aria-hidden />
        {t.newPo}
      </ViewLink>
    </Button>
  );

  const peeked = peek ? ((all ?? []).find((po) => po.id === peek.id) ?? inFilter.find((po) => po.id === peek.id) ?? null) : null;
  const loadingRows = narrowOnServer && narrowed.loading;
  const rowsError = narrowOnServer ? narrowed.error : null;

  const rows = orders.map((po) => (
    <PurchaseOrderRow
      key={po.id}
      po={po}
      compact={compact}
      canManage={canManage}
      current={peek?.open === true && peek.id === po.id}
      menu={menuOf(po)}
      onPeek={() => setPeek({ id: po.id, open: true })}
      onOpenFully={() => navigate(pathOf(po))}
      onReceive={() => navigate(`${pathOf(po)}?receive=1`)}
    />
  ));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-6 text-ink-soft max-md:hidden">{t.poHint}</p>
      <ListToolbar
        search={{ value: search, onChange: setSearch, placeholder: u.poSearchPlaceholder, label: u.poSearch }}
        filters={suppliers.length > 1 ? { count: supplierId ? 1 : 0, onOpen: () => setFiltersOpen(true) } : undefined}
      >
        {canManage && (
          <Button asChild className="h-11 gap-2 rounded-full px-4 max-md:hidden">
            <ViewLink to="/inventory/purchase-orders/new">
              <IconPlus className="size-4" weight="bold" aria-hidden />
              {t.newPo}
            </ViewLink>
          </Button>
        )}
      </ListToolbar>
      <ChipRow items={chips} value={filter} onChange={(next) => setParam("status", next === "all" ? null : next)} label={t.poFilterLabel} collapseEmpty={false} countsLoading={everything.loading} />
      <ActiveFilters filters={activeFilters} onClearAll={() => setParam("supplier", null)} />

      <DataState
        loading={everything.loading || loadingRows}
        error={all ? rowsError : everything.error}
        onRetry={() => {
          void everything.refresh();
          if (narrowOnServer) void narrowed.refresh();
        }}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}
      >
        {orders.length === 0 ? (
          narrowedDown ? (
            <EmptyState
              icon={<IconSearch aria-hidden />}
              title={needle || supplierId ? u.noMatch : t.poNoMatchTitle}
              action={
                <Button type="button" variant="outline" className="rounded-full px-5" onClick={clearAll}>
                  {t.poShowAll}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<IconClipboard aria-hidden />}
              title={t.poEmptyTitle}
              description={canManage ? t.poEmptyHint : t.viewOnly}
              action={canManage ? newButton : undefined}
            />
          )
        ) : (
          <div className="flex flex-col gap-3">
            {compact ? (
              <ul aria-label={u.poList} className="flex flex-col gap-2.5">
                {rows}
              </ul>
            ) : (
              <DeskList
                columns={PO_COLUMNS}
                label={u.poList}
                head={[
                  { label: t.colNumber },
                  { label: t.colStatus },
                  { label: t.colExpected },
                  { label: t.colReceived },
                  { label: t.colTotal, end: true },
                  { label: canManage ? t.colActions : "", end: true },
                ]}
              >
                {rows}
              </DeskList>
            )}
            {!complete && !narrowOnServer && <ViewOnlyNote>{fmt(u.poFirstRows, { n: PO_LIST_CAP })}</ViewOnlyNote>}
            {!canManage && <ViewOnlyNote>{t.viewOnly}</ViewOnlyNote>}
          </div>
        )}
      </DataState>

      {canManage && (all?.length ?? 0) > 0 && <PageActionBar>{newButton}</PageActionBar>}

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        activeCount={supplierId ? 1 : 0}
        onReset={() => setParam("supplier", null)}
        applyLabel={pluralOf(u, "showPo", orders.length)}
      >
        <FilterGroup label={t.supplier}>
          <FilterChoice<string> label={t.supplier} allowClear value={supplierId || null} onChange={(next) => setParam("supplier", next)} options={suppliers} />
        </FilterGroup>
      </FilterSheet>

      <PurchaseOrderQuickLook
        po={peeked}
        open={Boolean(peek?.open)}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        onReceive={peeked && canManage && receivable(peeked) ? () => navigate(`${pathOf(peeked)}?receive=1`) : undefined}
      />
    </div>
  );
}

/** How much of an order arrived: «٣ من ١٠» over a thin bar. */
function ReceivedCell({ po }: { po: PurchaseOrderSummary }) {
  const t = useT(PURCHASING_STRINGS);
  const text = fmt(t.receivedOf, { received: num(po.unitsReceived), ordered: num(po.unitsOrdered) });
  return (
    <div className="min-w-0">
      <p className="text-sm whitespace-nowrap text-ink-soft tabular-nums">{text}</p>
      <Meter value={po.unitsReceived} max={po.unitsOrdered} label={`${t.colReceived}: ${text}`} tone={po.status === "received" ? "success" : "primary"} className="mt-1" />
    </div>
  );
}

function PurchaseOrderRow({
  po,
  compact,
  canManage,
  current,
  menu,
  onPeek,
  onOpenFully,
  onReceive,
}: {
  po: PurchaseOrderSummary;
  compact: boolean;
  canManage: boolean;
  current: boolean;
  menu: ContextMenuItem[];
  onPeek: () => void;
  onOpenFully: () => void;
  onReceive: () => void;
}) {
  const t = useT(PURCHASING_STRINGS);
  const u = useT(INV_UI);
  const supplier = po.supplier.name ?? t.unknownSupplier;
  const menuLabel = fmt(u.actionsFor, { name: po.number });
  const peekLabel = fmt(u.previewOf, { name: po.number });
  const keys = rowKeyProps(onPeek, onOpenFully);
  const status = <StatusBadge value={po.status} tone={PO_STATUS_TONE[po.status]} text={t[PO_STATUS_KEY[po.status]]} />;
  const total = (
    <bdi data-vt-part="amount" className="tabular-nums">
      {formatMoney(po.totalAmount, po.currency)}
    </bdi>
  );
  // The ONE action of a row: receive what is still to come.
  const action = canManage && receivable(po) ? <RowAction tone="quiet" label={t.receive} icon={compact ? undefined : IconPacked} onClick={onReceive} /> : null;
  const expected = formatDay(po.expectedAt) || t.noDate;

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={menuLabel}>
          <ListRowCard
            title={
              <bdi dir="ltr" data-vt-part="title">
                {po.number}
              </bdi>
            }
            amount={total}
            status={status}
            meta={<bdi>{supplier}</bdi>}
            action={action}
            footer={
              <p className="text-xs leading-5 text-ink-soft tabular-nums">
                {fmt(u.receivedLine, { received: num(po.unitsReceived), ordered: num(po.unitsOrdered) })}
                {po.expectedAt && (
                  <>
                    <span aria-hidden> · </span>
                    {fmt(u.expectedOn, { date: expected })}
                  </>
                )}
              </p>
            }
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
    <DeskRow onOpen={onPeek} openLabel={peekLabel} keyProps={keys} current={current} menu={menu} menuLabel={menuLabel}>
      <div className="min-w-0">
        <p className="truncate text-[15px] leading-6 font-medium text-ink">
          <ViewLink to={`/inventory/purchase-orders/${po.id}`} className={NAME_LINK}>
            <bdi dir="ltr" data-vt-part="title">
              {po.number}
            </bdi>
          </ViewLink>
        </p>
        <p className="truncate text-xs leading-5 text-ink-soft">
          <bdi>{supplier}</bdi>
        </p>
      </div>
      <div className="flex items-center">{status}</div>
      <div className="text-sm whitespace-nowrap text-ink-soft">{expected}</div>
      <ReceivedCell po={po} />
      <div className="text-end text-sm font-medium whitespace-nowrap text-ink">{total}</div>
      <div className="flex items-center justify-end">{action}</div>
    </DeskRow>
  );
}

/**
 * The preview of a purchase order: who it is from, when it is due, how much
 * arrived, and its lines — read when the preview opens, with bones of the
 * same height until they land.
 */
function PurchaseOrderQuickLook({
  po,
  open,
  onOpenChange,
  onReceive,
}: {
  po: PurchaseOrderSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReceive?: () => void;
}) {
  const t = useT(PURCHASING_STRINGS);
  const u = useT(INV_UI);
  const workspaceId = useWorkspaceId();
  const id = po?.id ?? "";
  const full = useAsync(() => (open && id ? purchaseOrderGet(apiClient, workspaceId, id).catch(() => null) : Promise.resolve(null)), [workspaceId, id, open]);
  if (!po) return null;
  const lines = full.data?.id === po.id ? full.data.lines : null;
  return (
    <QuickLook
      open={open}
      onOpenChange={onOpenChange}
      title={<bdi dir="ltr">{po.number}</bdi>}
      subtitle={<bdi>{po.supplier.name ?? t.unknownSupplier}</bdi>}
      status={<StatusBadge value={po.status} tone={PO_STATUS_TONE[po.status]} text={t[PO_STATUS_KEY[po.status]]} />}
      to={`/inventory/purchase-orders/${po.id}`}
      actions={onReceive ? <RowAction className={FOOTER_PILL} label={t.receive} icon={IconPacked} onClick={onReceive} /> : undefined}
    >
      <div className="space-y-4">
        <Facts>
          <Fact label={t.colTotal}>
            <bdi className="tabular-nums">{formatMoney(po.totalAmount, po.currency)}</bdi>
          </Fact>
          <Fact label={t.colExpected}>{formatDay(po.expectedAt) || t.noDate}</Fact>
          <Fact label={t.colReceived}>
            <span className="tabular-nums">{fmt(t.receivedOf, { received: num(po.unitsReceived), ordered: num(po.unitsOrdered) })}</span>
          </Fact>
        </Facts>
        <Meter
          value={po.unitsReceived}
          max={po.unitsOrdered}
          label={t.colReceived}
          tone={po.status === "received" ? "success" : "primary"}
        />

        <section>
          <BlockLabel>
            {t.linesTitle} · {countOf("item", po.lineCount)}
          </BlockLabel>
          {lines ? (
            <ul className="space-y-2">
              {lines.map((line) => (
                <li key={line.id} className="flex items-start justify-between gap-3 text-sm leading-5">
                  <span className="min-w-0 text-ink">
                    <bdi>{variantFullName(line.productName ?? t.unknownProduct, variantDetail(line.optionValues, line.sku))}</bdi>
                  </span>
                  <span className="shrink-0 text-ink-soft tabular-nums">{fmt(t.receivedOf, { received: num(line.receivedQuantity), ordered: num(line.quantity) })}</span>
                </li>
              ))}
            </ul>
          ) : full.loading ? (
            <div aria-hidden className="space-y-3">
              <SkeletonBar className="w-3/4" />
              <SkeletonBar className="w-1/2" />
            </div>
          ) : (
            <p className="text-sm text-ink-soft">{u.linesOnPage}</p>
          )}
        </section>

        {po.note && (
          <Well>
            <p className="text-xs leading-4 font-medium text-ink-soft">{t.colNote}</p>
            <p dir="auto" className="mt-1 text-sm leading-6 wrap-anywhere text-ink">
              {po.note}
            </p>
          </Well>
        )}
      </div>
    </QuickLook>
  );
}
