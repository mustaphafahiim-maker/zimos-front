import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import {
  STOCK_LOTS_MAX_ROWS,
  STOCK_LOT_STATUSES,
  purchaseOrdersList,
  stockLotsList,
  type PurchaseOrderSummary,
  type StockLot,
  type StockLotList,
  type StockLotStatus,
} from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconBellRinging, IconClipboard, IconDelete, IconEdit, IconPlus, IconSchedule, IconSearch } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { PageActionBar } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { canManageInventory } from "@/lib/inventoryAccess";
import { countOf } from "@/lib/plural";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { num } from "../inventoryText";
import { FactChip, MoreMenu, TOOL_BUTTON, ViewOnlyNote, foldText, matchesText, useStockLocations } from "../kit";
import { INV_UI } from "../sweepStrings";
import { EditLotDialog, LotAlertDialog, WriteOffLotDialog } from "./LotDialogs";
import { LotExpiry } from "./LotParts";
import { ReceiveLotDialog } from "./ReceiveLotDialog";
import { LOT_EMPTY_HINT, LOT_EMPTY_TITLE, LOT_STATUS_KEY, LOT_STRINGS } from "./lotStrings";

const isStatus = (value: string | null): value is StockLotStatus => STOCK_LOT_STATUSES.includes(value as StockLotStatus);

const LOT_COLUMNS = "grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_max-content_max-content_minmax(0,0.8fr)_max-content]";
const LINK = "rounded-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * Inventory → «الدفعات والصلاحية» / Lots & expiry (handoff 230, GET /stock-lots):
 * the lots that still hold units, the ones about to expire, the expired ones
 * and the used-up ones — first expiring first. «استلام دفعة» records a new
 * one; a row is edited or written off from its «…» (or a right-click, a long
 * press); «تنبيه الصلاحية» sets how early the team is warned. `?status=` picks
 * the chip, so the expiry notification's link
 * (/inventory/lots?status=expiring) lands on it.
 */
export function StockLotsTab() {
  const t = useT(LOT_STRINGS);
  const u = useT(INV_UI);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const compact = useIsCompact();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageInventory(currentWorkspace?.role);
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const requested = params.get("status");
  const status: StockLotStatus = isStatus(requested) ? requested : "active";

  const list = useCachedAsync<StockLotList>(
    `inventory:lots:${workspaceId}:${status}`,
    () => stockLotsList(apiClient, workspaceId, { status, limit: STOCK_LOTS_MAX_ROWS }),
    [workspaceId, status]
  );
  // Names for the location column and the purchase order link; without them the lots still list.
  const locations = useStockLocations(workspaceId);
  const orders = useAsync(() => purchaseOrdersList(apiClient, workspaceId).catch(() => [] as PurchaseOrderSummary[]), [workspaceId]);

  const lots = list.loading ? [] : (list.data?.lots ?? []);
  const alertDays = list.data?.alertDays ?? 30;
  const allLocations = locations.data?.locations ?? [];
  const allOrders = orders.data ?? [];
  const manyLocations = allLocations.length >= 2;

  const [search, setSearch] = useState("");
  const [receiving, setReceiving] = useState(false);
  const [editing, setEditing] = useState<StockLot | null>(null);
  const [writingOff, setWritingOff] = useState<StockLot | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);

  const reload = () => list.refresh({ silent: true });
  const changeStatus = (next: StockLotStatus) => setParams(next === "active" ? {} : { status: next }, { replace: true });

  function locationName(lot: StockLot): string {
    const location = lot.locationId ? allLocations.find((l) => l.id === lot.locationId) : allLocations.find((l) => l.isDefault);
    if (location) return location.name;
    return lot.locationId ? t.deletedLocation : "—";
  }

  const needle = foldText(search.trim());
  const visible = lots.filter((lot) => matchesText(needle, [lot.productName, lot.sku, lot.lotCode, lot.note]));
  const chips: ChipItem<StockLotStatus>[] = STOCK_LOT_STATUSES.map((value) => ({ value, label: t[LOT_STATUS_KEY[value]] }));

  function menuOf(lot: StockLot): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    const poId = lot.purchaseOrderId;
    if (poId) items.push({ id: "po", label: t.purchaseOrderPlain, icon: IconClipboard, onSelect: () => navigate(`/inventory/purchase-orders/${poId}`) });
    if (canManage) {
      items.push({ id: "edit", label: t.edit, icon: IconEdit, separatorBefore: true, onSelect: () => setEditing(lot) });
      if (lot.quantityRemaining > 0) items.push({ id: "writeoff", label: t.writeOff, icon: IconDelete, destructive: true, onSelect: () => setWritingOff(lot) });
    }
    return items;
  }

  const receiveButton = (
    <Button type="button" className={TOOL_BUTTON} onClick={() => setReceiving(true)}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.receive}
    </Button>
  );
  const loaded = Boolean(list.data);
  // With nothing recorded yet, the empty state below carries the button.
  const showReceive = canManage && loaded && (lots.length > 0 || status !== "active");

  const rows = visible.map((lot) => {
    const menu = menuOf(lot);
    const name = lot.productName ?? t.unknownProduct;
    const menuLabel = fmt(u.actionsFor, { name: lot.lotCode });
    const number = lot.purchaseOrderId ? allOrders.find((po) => po.id === lot.purchaseOrderId)?.number : undefined;
    const remaining = fmt(t.remainingOf, { remaining: num(lot.quantityRemaining), received: num(lot.quantityReceived) });
    const poLink = lot.purchaseOrderId && (
      <ViewLink to={`/inventory/purchase-orders/${lot.purchaseOrderId}`} className={`${LINK} text-xs`}>
        {number ? fmt(t.purchaseOrder, { number }) : t.purchaseOrderPlain}
      </ViewLink>
    );
    if (compact) {
      return (
        <li key={lot.id}>
          <ContextMenu items={menu} label={menuLabel}>
            <ListRowCard
              title={<bdi>{name}</bdi>}
              amount={<span title={t.colRemaining}>{remaining}</span>}
              status={<LotExpiry lot={lot} alertDays={alertDays} />}
              action={menu.length > 0 ? <MoreMenu items={menu} label={menuLabel} /> : undefined}
              footer={
                <>
                  <FactChip>
                    <bdi>{lot.lotCode}</bdi>
                  </FactChip>
                  {lot.writtenOffAt && <StatusBadge value="written_off" tone="neutral" text={t.writtenOffBadge} />}
                  {manyLocations && (
                    <FactChip>
                      <bdi>{locationName(lot)}</bdi>
                    </FactChip>
                  )}
                  {poLink}
                  {lot.note && (
                    <span dir="auto" className="min-w-0 basis-full truncate text-xs text-ink-soft">
                      {lot.note}
                    </span>
                  )}
                </>
              }
            />
          </ContextMenu>
        </li>
      );
    }
    return (
      <DeskRow key={lot.id} menu={menu} menuLabel={menuLabel}>
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-6 font-medium text-ink">
            <bdi>{name}</bdi>
          </p>
          {lot.sku && (
            <p className="truncate text-xs leading-5 text-ink-soft">
              <bdi dir="ltr">{lot.sku}</bdi>
            </p>
          )}
        </div>
        <div className="min-w-0 text-sm leading-5">
          <p className="flex flex-wrap items-center gap-2">
            <bdi className="font-medium text-ink">{lot.lotCode}</bdi>
            {lot.writtenOffAt && <StatusBadge value="written_off" tone="neutral" text={t.writtenOffBadge} />}
          </p>
          {lot.note && (
            <p dir="auto" className="truncate text-xs text-ink-soft">
              {lot.note}
            </p>
          )}
          {poLink}
        </div>
        <div className="text-sm">
          <LotExpiry lot={lot} alertDays={alertDays} />
        </div>
        <div className="text-end text-sm whitespace-nowrap text-ink tabular-nums">{remaining}</div>
        <p className="min-w-0 truncate text-sm text-ink-soft">{manyLocations ? <bdi>{locationName(lot)}</bdi> : ""}</p>
        <div className="flex items-center justify-end">{menu.length > 0 && <MoreMenu items={menu} label={menuLabel} />}</div>
      </DeskRow>
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-6 text-ink-soft max-md:hidden">{t.hint}</p>
      <ListToolbar search={{ value: search, onChange: setSearch, placeholder: u.lotSearchPlaceholder, label: u.lotSearch }}>
        {canManage && loaded && (
          <Button type="button" variant="outline" className="h-11 gap-2 rounded-full px-3.5 sm:px-4" aria-label={t.alertSettings} onClick={() => setAlertOpen(true)}>
            <IconBellRinging className="size-4" aria-hidden />
            <span className="max-sm:sr-only">{t.alertSettings}</span>
          </Button>
        )}
        {showReceive && (
          <Button type="button" className="h-11 gap-2 rounded-full px-4 max-md:hidden" onClick={() => setReceiving(true)}>
            <IconPlus className="size-4" weight="bold" aria-hidden />
            {t.receive}
          </Button>
        )}
      </ListToolbar>
      <ChipRow items={chips} value={status} onChange={changeStatus} label={t.filterLabel} collapseEmpty={false} />

      <DataState
        loading={list.loading}
        error={list.error}
        onRetry={() => void list.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}
      >
        {lots.length === 0 ? (
          <EmptyState
            icon={<IconSchedule aria-hidden />}
            title={t[LOT_EMPTY_TITLE[status]]}
            description={status === "active" && !canManage ? t.viewOnly : fmt(t[LOT_EMPTY_HINT[status]], { days: countOf("day", alertDays) })}
            action={status === "active" && canManage ? receiveButton : undefined}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<IconSearch aria-hidden />}
            title={u.noMatch}
            action={
              <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => setSearch("")}>
                {u.clearSearch}
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {compact ? (
              <ul aria-label={u.lotList} className="flex flex-col gap-2.5">
                {rows}
              </ul>
            ) : (
              <DeskList
                columns={LOT_COLUMNS}
                label={u.lotList}
                head={[
                  { label: t.colProduct },
                  { label: t.colLot },
                  { label: t.colExpiry },
                  { label: t.colRemaining, end: true },
                  { label: manyLocations ? t.colLocation : "" },
                  { label: canManage ? t.colActions : "", end: true },
                ]}
              >
                {rows}
              </DeskList>
            )}
            {lots.length >= STOCK_LOTS_MAX_ROWS && <ViewOnlyNote>{fmt(t.firstRows, { n: lots.length })}</ViewOnlyNote>}
            {!canManage && <ViewOnlyNote>{t.viewOnly}</ViewOnlyNote>}
          </div>
        )}
      </DataState>

      {showReceive && <PageActionBar>{receiveButton}</PageActionBar>}

      <ReceiveLotDialog
        open={receiving}
        locations={allLocations}
        purchaseOrders={allOrders}
        onClose={() => setReceiving(false)}
        onReceived={(_lot, addedToStock) => {
          setReceiving(false);
          toast.success(addedToStock ? t.received : t.labelled);
          // A lot that was just received holds units: it is on the first chip.
          if (status === "active") void reload();
          else changeStatus("active");
        }}
      />

      <EditLotDialog
        lot={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          toast.success(t.saved);
          void reload();
        }}
      />

      <WriteOffLotDialog
        lot={writingOff}
        alertDays={alertDays}
        onClose={() => setWritingOff(null)}
        onStale={() => void reload()}
        onDone={(_next, writtenOff) => {
          setWritingOff(null);
          toast.success(fmt(t.writtenOff, { pieces: countOf("piece", writtenOff) }));
          void reload();
        }}
      />

      <LotAlertDialog
        open={alertOpen}
        alertDays={alertDays}
        onClose={() => setAlertOpen(false)}
        onSaved={() => {
          setAlertOpen(false);
          toast.success(t.alertSaved);
          void reload();
        }}
      />
    </div>
  );
}
