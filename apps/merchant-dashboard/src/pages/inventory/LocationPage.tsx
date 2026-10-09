import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { LOCATION_STOCK_MAX_ROWS, stockLocationStock, type LocationStockVariant } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconMinus, IconPackageOpen, IconPackageSearch, IconProduct, IconSearch, IconSwap, IconWarning } from "@/components/icons";
import { ListRowCard, ListSkeleton, ListToolbar } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { canManageInventory } from "@/lib/inventoryAccess";
import { pluralOf } from "@/lib/plural";
import { useAsync } from "@/lib/useAsync";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { AdjustStockDialog, type AdjustMode } from "./AdjustStockDialog";
import { INVENTORY_STRINGS } from "./inventoryStrings";
import { num, variantDetail, variantFullName } from "./inventoryText";
import { ViewOnlyNote } from "./kit";
import { INV_UI } from "./sweepStrings";

const STOCK_COLUMNS = "grid-cols-[minmax(0,1.6fr)_max-content_max-content_max-content_max-content]";

/**
 * One location's stock (handoff 206, GET /stock-locations/:id/stock): every
 * variant with what is on hand there, what its orders hold, and what is free.
 * Search by product name; a row (or its «استلام / خصم») opens the small sheet
 * that receives or writes off units, with the reason. A variant with more
 * reserved than on hand says «محتاج نقل مخزون».
 */
export function LocationPage() {
  const t = useT(INVENTORY_STRINGS);
  const u = useT(INV_UI);
  const { locationId = "" } = useParams<{ locationId: string }>();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageInventory(currentWorkspace?.role);
  const toast = useToast();
  const navigate = useViewNavigate();
  const compact = useIsCompact();
  const phone = useIsPhone();

  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  // The field never waits; the request does, once typing pauses.
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(draft.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const stock = useAsync(() => stockLocationStock(apiClient, workspaceId, locationId, { q: q || undefined }), [workspaceId, locationId, q]);
  const [adjusting, setAdjusting] = useState<LocationStockVariant | null>(null);
  const [mode, setMode] = useState<AdjustMode>("receive");

  const location = stock.data?.location ?? null;
  const rows = stock.data?.variants ?? [];
  const short = rows.filter((row) => row.available < 0).length;
  const nameOf = (row: LocationStockVariant) => row.productName ?? t.unknownProduct;
  const transferPath = canManage ? `/inventory/transfers?new=1&to=${locationId}` : "/inventory/transfers";

  function adjust(row: LocationStockVariant, next: AdjustMode = "receive") {
    setMode(next);
    setAdjusting(row);
  }

  const list = rows.map((row) => {
    const detail = variantDetail(row.optionValues, row.sku);
    const fullName = variantFullName(nameOf(row), detail);
    const needs = row.available < 0;
    const menu: ContextMenuItem[] = [];
    if (canManage) {
      menu.push({ id: "receive", label: t.modeReceive, icon: IconPackageOpen, onSelect: () => adjust(row, "receive") });
      menu.push({ id: "writeoff", label: t.modeWriteOff, icon: IconMinus, onSelect: () => adjust(row, "writeOff") });
    }
    menu.push({ id: "product", label: u.openProduct, icon: IconProduct, separatorBefore: canManage, onSelect: () => navigate(`/products/${row.productId}`) });
    const action = canManage ? (
      <RowAction tone="quiet" label={t.adjust} onClick={() => adjust(row)} className="max-sm:px-3" />
    ) : null;
    const open = canManage ? () => adjust(row) : undefined;
    const openLabel = fmt(t.adjustFor, { name: fullName });
    if (compact) {
      return (
        <li key={row.variantId}>
          <ContextMenu items={menu} label={fmt(u.actionsFor, { name: fullName })}>
            <ListRowCard
              title={<bdi>{nameOf(row)}</bdi>}
              amount={<span title={t.colOnHand}>{num(row.onHand)}</span>}
              status={needs ? <StatusBadge value="needs_transfer" tone="danger" text={t.needsTransfer} /> : undefined}
              meta={
                <>
                  {detail && <bdi>{detail}</bdi>}
                  {detail && " · "}
                  {fmt(u.stockLine, { reserved: num(row.reserved), available: num(row.available) })}
                </>
              }
              action={action}
              onOpen={open}
              openLabel={open ? openLabel : undefined}
              aria-haspopup={open ? "dialog" : undefined}
            />
          </ContextMenu>
        </li>
      );
    }
    return (
      <DeskRow key={row.variantId} onOpen={open} openLabel={openLabel} menu={menu} menuLabel={fmt(u.actionsFor, { name: fullName })}>
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-6 font-medium text-ink">
            <bdi>{nameOf(row)}</bdi>
          </p>
          {detail && (
            <p className="truncate text-xs leading-5 text-ink-soft">
              <bdi>{detail}</bdi>
            </p>
          )}
        </div>
        <div className="text-end text-sm font-medium text-ink tabular-nums">{num(row.onHand)}</div>
        <div className="text-end text-sm text-ink-soft tabular-nums">{num(row.reserved)}</div>
        <div className="flex items-center justify-end gap-2 text-sm">
          {needs && <StatusBadge value="needs_transfer" tone="danger" text={t.needsTransfer} />}
          <bdi dir="ltr" className={needs ? "font-medium text-danger tabular-nums" : "text-ink tabular-nums"}>
            {num(row.available)}
          </bdi>
        </div>
        <div className="flex items-center justify-end">{action}</div>
      </DeskRow>
    );
  });

  return (
    <div className="max-w-6xl">
      <PageHeader
        back={{ to: "/inventory/locations", label: t.back }}
        title={location?.name ?? t.locationFallback}
        titleBadge={
          location ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {location.isDefault && <StatusBadge value="default" tone="info" text={t.defaultBadge} />}
              {!location.isActive && <StatusBadge value="inactive" tone="neutral" text={t.inactiveBadge} />}
            </span>
          ) : undefined
        }
        description={
          location && !phone ? [location.address, fmt(t.priorityLine, { n: location.priority })].filter(Boolean).join(" · ") : undefined
        }
      />

      {/* The first load decides the page (found, refused, failed); a search after it only swaps the rows. */}
      <DataState
        loading={stock.loading && !stock.data}
        error={stock.data ? null : stock.error}
        onRetry={() => void stock.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={6} />}
      >
        {location && (
          <div className="flex flex-col gap-3">
            {short > 0 && !q && (
              <div role="status" data-slot="inv-alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger ring-1 ring-danger/25">
                <IconWarning className="size-5 shrink-0" weight="fill" aria-hidden />
                <p className="min-w-0 flex-1 basis-56">{pluralOf(t, "needsTransferBanner", short)}</p>
                <ViewLink to={transferPath} className="inline-flex min-h-11 items-center gap-1.5 rounded-full font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-current">
                  <IconSwap className="size-4" aria-hidden />
                  {t.transferStock}
                </ViewLink>
              </div>
            )}

            <ListToolbar search={{ value: draft, onChange: setDraft, placeholder: t.searchPlaceholder, label: t.searchLabel }}>
              <Button asChild variant="outline" className="h-11 gap-2 rounded-full px-3.5 sm:px-4">
                <ViewLink to={transferPath} aria-label={t.transferStock}>
                  <IconSwap className="size-4" aria-hidden />
                  <span className="max-sm:sr-only">{t.transferStock}</span>
                </ViewLink>
              </Button>
            </ListToolbar>

            <DataState
              loading={stock.loading}
              error={stock.error}
              onRetry={() => void stock.refresh()}
              skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={6} />}
            >
              {rows.length === 0 ? (
                q ? (
                  <EmptyState
                    icon={<IconSearch aria-hidden />}
                    title={t.noMatchTitle}
                    description={t.noMatchHint}
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full px-5"
                        onClick={() => {
                          setDraft("");
                          setQ("");
                        }}
                      >
                        {t.showAll}
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={<IconPackageSearch aria-hidden />}
                    title={t.stockEmptyTitle}
                    description={t.stockEmptyHint}
                    action={
                      <Button asChild className="rounded-full px-5">
                        <ViewLink to="/catalog">{u.goToProducts}</ViewLink>
                      </Button>
                    }
                  />
                )
              ) : (
                <div className="flex flex-col gap-3">
                  {compact ? (
                    <ul aria-label={t.searchLabel} className="flex flex-col gap-2.5">
                      {list}
                    </ul>
                  ) : (
                    <DeskList
                      columns={STOCK_COLUMNS}
                      label={t.searchLabel}
                      head={[
                        { label: t.colProduct },
                        { label: t.colOnHand, end: true },
                        { label: t.colReserved, end: true },
                        { label: t.colAvailable, end: true },
                        { label: canManage ? t.colActions : "", end: true },
                      ]}
                    >
                      {list}
                    </DeskList>
                  )}
                  {rows.length >= LOCATION_STOCK_MAX_ROWS && <ViewOnlyNote>{fmt(t.firstRows, { n: LOCATION_STOCK_MAX_ROWS })}</ViewOnlyNote>}
                  {!canManage && <ViewOnlyNote>{t.viewOnlyHint}</ViewOnlyNote>}
                </div>
              )}
            </DataState>

            <AdjustStockDialog
              location={location}
              row={adjusting}
              initialMode={mode}
              onClose={() => setAdjusting(null)}
              onDone={(variantId, counts) => {
                setAdjusting(null);
                toast.success(t.adjusted);
                if (counts) {
                  // The answer carries the variant's new counts here: the row changes without a reload.
                  stock.setData((prev) => ({
                    location,
                    variants: (prev?.variants ?? []).map((row) =>
                      row.variantId === variantId ? { ...row, onHand: counts.onHand, reserved: counts.reserved, available: counts.available } : row
                    ),
                  }));
                } else {
                  void stock.refresh({ silent: true });
                }
              }}
            />
          </div>
        )}
      </DataState>
    </div>
  );
}
