import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import {
  isApiErrorCode,
  purchaseOrderCancel,
  purchaseOrderGet,
  purchaseOrderMarkOrdered,
  suppliersList,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type StockLocation,
} from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { CardSkeleton, DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconCancelled, IconCheck, IconLock, IconPacked } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney } from "@/lib/format";
import { canManageInventory } from "@/lib/inventoryAccess";
import { useAsync } from "@/lib/useAsync";
import { UnsavedGuardProvider } from "@/lib/useUnsavedGuard";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatDay } from "@/lib/wholeNumber";
import { useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { num, variantDetail } from "./inventoryText";
import { Fact, Facts, Meter, MoreMenu, ViewOnlyNote, Well, useStockLocations } from "./kit";
import { PurchaseOrderEditor } from "./PurchaseOrderEditor";
import { PO_STATUS_KEY, PO_STATUS_TONE, PURCHASING_STRINGS } from "./purchasingStrings";
import { ReceiveDialog } from "./ReceiveDialog";
import { INV_UI } from "./sweepStrings";

/** An order number is read left to right wherever it stands; the title is plain text, so the marks do what <bdi> would. */
const isolate = (value: string) => `⁦${value}⁩`;

/** Keyed by the order in the URL, so going from "new" to the saved draft starts clean. */
export function PurchaseOrderPage() {
  const { poId } = useParams<{ poId?: string }>();
  return (
    // The form inside reports what is unsaved: the browser then asks before a reload or a close would lose it.
    <UnsavedGuardProvider key={poId ?? "new"}>
      <PurchaseOrderView poId={poId ?? null} />
    </UnsavedGuardProvider>
  );
}

/**
 * One purchase order (handoff 207). A new order or a draft is a form in two
 * sections with the save bar in reach; «اطلب» locks it (draft → ordered). An
 * ordered one shows its lines with what arrived, and «استلام» — the page's one
 * action — receives the rest in a sheet (`?receive=1` opens it on arrival).
 * Cancelling waits in the «…» menu until something was received.
 */
function PurchaseOrderView({ poId }: { poId: string | null }) {
  const t = useT(PURCHASING_STRINGS);
  const u = useT(INV_UI);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const phone = useIsPhone();
  const [params, setParams] = useSearchParams();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageInventory(currentWorkspace?.role);
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const order = useAsync<PurchaseOrder | null>(
    () => (poId ? purchaseOrderGet(apiClient, workspaceId, poId) : Promise.resolve(null)),
    [workspaceId, poId]
  );
  const suppliers = useAsync(() => suppliersList(apiClient, workspaceId), [workspaceId]);
  // Without the locations the order still works (it is received at the default).
  const locations = useStockLocations(workspaceId);

  const [dirty, setDirty] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const po = order.data;
  const isDraft = !po || po.status === "draft";
  const currency = po?.currency ?? currentWorkspace?.defaultCurrency ?? "EGP";
  const allLocations = locations.data?.locations ?? [];
  const location = po?.locationId ? (allLocations.find((l) => l.id === po.locationId) ?? null) : (allLocations.find((l) => l.isDefault) ?? null);
  const canCancel = Boolean(po) && canManage && (po?.status === "draft" || (po?.status === "ordered" && po.unitsReceived === 0));
  const canReceive = canManage && (po?.status === "ordered" || po?.status === "partially_received");

  // A list row's «استلام» lands here with `?receive=1`: the sheet opens once the order is in hand, and the address is left clean.
  const wantsReceive = params.get("receive") === "1";
  useEffect(() => {
    if (!wantsReceive || !po) return;
    if (canReceive) setReceiving(true);
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsReceive, po?.id, canReceive]);

  /** A status the server no longer accepts the action for: say so, and show the order as it is now. */
  function stale(message: string) {
    setNotice(message);
    void order.refresh({ silent: true });
  }

  async function confirmOrdered() {
    if (!po) return;
    try {
      order.setData(await purchaseOrderMarkOrdered(apiClient, workspaceId, po.id));
    } catch (err) {
      if (isApiErrorCode(err, "PO_STATUS")) {
        setOrdering(false);
        stale(t.poStatusChanged);
        return;
      }
      throw new Error(errorMessage(err));
    }
    setOrdering(false);
    setNotice(null);
    toast.success(t.markedOrdered);
  }

  async function confirmCancel() {
    if (!po) return;
    try {
      order.setData(await purchaseOrderCancel(apiClient, workspaceId, po.id));
    } catch (err) {
      if (isApiErrorCode(err, "PO_STATUS")) {
        setCancelling(false);
        stale(t.poStatusChanged);
        return;
      }
      throw new Error(errorMessage(err));
    }
    setCancelling(false);
    setNotice(null);
    toast.success(t.poCancelled);
  }

  // What is done to an order rarely waits behind «…».
  const more: ContextMenuItem[] = canCancel
    ? [{ id: "cancel", label: t.cancelPo, icon: IconCancelled, destructive: true, onSelect: () => setCancelling(true) }]
    : [];

  const meta = po
    ? [
        po.supplier.name ?? t.unknownSupplier,
        po.status === "received" && po.receivedAt
          ? fmt(t.receivedOn, { date: formatDate(po.receivedAt) })
          : po.orderedAt
            ? fmt(t.orderedOn, { date: formatDate(po.orderedAt) })
            : fmt(t.createdOn, { date: formatDate(po.createdAt) }),
      ].join(" · ")
    : undefined;

  const loading = order.loading || suppliers.loading || (locations.loading && !locations.data);

  return (
    <div className="max-w-6xl">
      <PageHeader
        back={{ to: "/inventory/purchase-orders", label: t.poBack }}
        title={po ? isolate(po.number) : poId ? t.poFallbackTitle : t.poNewTitle}
        titleBadge={po ? <StatusBadge value={po.status} tone={PO_STATUS_TONE[po.status]} text={t[PO_STATUS_KEY[po.status]]} /> : undefined}
        description={phone && !po ? undefined : meta}
        actions={
          po && canManage && (po.status === "draft" || more.length > 0) ? (
            <>
              {/* A draft's bar above the dock is the save bar, so its «اطلب» stays in the header at every width. */}
              {po.status === "draft" && (
                <Button
                  type="button"
                  className="h-11 gap-2 rounded-full px-4"
                  onClick={() => {
                    // Unsaved edits would be left out of what gets ordered.
                    if (dirty) toast.error(t.saveFirst);
                    else setOrdering(true);
                  }}
                >
                  <IconCheck className="size-4" weight="bold" aria-hidden />
                  {t.markOrdered}
                </Button>
              )}
              <MoreMenu items={more} label={fmt(u.actionsFor, { name: po.number })} size="header" />
            </>
          ) : undefined
        }
        primaryAction={
          po && canReceive ? (
            <Button type="button" className="h-11 gap-2 rounded-full px-4" onClick={() => setReceiving(true)}>
              <IconPacked className="size-4" weight="bold" aria-hidden />
              {t.receive}
            </Button>
          ) : undefined
        }
      />

      <DataState
        loading={loading}
        error={order.error ?? suppliers.error}
        onRetry={() => {
          void order.refresh();
          void suppliers.refresh();
        }}
        skeleton={
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <CardSkeleton lines={5} />
            <CardSkeleton lines={4} />
          </div>
        }
      >
        <div className="space-y-4">
          {notice && <Alert>{notice}</Alert>}
          {isDraft && canManage ? (
            <PurchaseOrderEditor
              po={po}
              suppliers={suppliers.data ?? []}
              locations={allLocations}
              currency={currency}
              onDirtyChange={setDirty}
              // The form goes away with the reload, so the page says why.
              onLocked={() => stale(t.poLocked)}
              onSaved={(saved, created) => {
                toast.success(created ? t.poCreated : t.poSaved);
                if (created) navigate(`/inventory/purchase-orders/${saved.id}`, { replace: true });
                else order.setData(saved);
              }}
            />
          ) : po ? (
            <PurchaseOrderDetails po={po} location={location} viewOnly={!canManage} />
          ) : (
            // A new order needs inventory.manage: say so, and who can grant it, instead of a form that would be refused.
            <EmptyState icon={<IconLock aria-hidden />} tone="attention" title={t.viewOnly} description={u.askOwner} />
          )}
        </div>
      </DataState>

      {po && (
        <>
          <ConfirmDialog
            open={ordering}
            title={fmt(t.markOrderedTitle, { number: po.number })}
            description={t.markOrderedBody}
            confirmLabel={t.markOrdered}
            cancelLabel={t.cancel}
            busyLabel={t.working}
            onCancel={() => setOrdering(false)}
            onConfirm={confirmOrdered}
          />
          <ConfirmDialog
            open={cancelling}
            title={fmt(t.cancelPoTitle, { number: po.number })}
            description={t.cancelPoBody}
            confirmLabel={t.cancelPoConfirm}
            cancelLabel={t.keepPo}
            busyLabel={t.working}
            destructive
            onCancel={() => setCancelling(false)}
            onConfirm={confirmCancel}
          />
          <ReceiveDialog
            open={receiving}
            po={po}
            locationName={location?.name ?? null}
            onClose={() => setReceiving(false)}
            onStale={() => void order.refresh({ silent: true })}
            onReceived={(next) => {
              order.setData(next);
              setReceiving(false);
              setNotice(null);
              toast.success(next.status === "received" ? t.receivedAllToast : t.receivedToast);
            }}
          />
        </>
      )}
    </div>
  );
}

/** An order past the draft: how much arrived, its lines, and where and when. Read only. */
function PurchaseOrderDetails({ po, location, viewOnly }: { po: PurchaseOrder; location: StockLocation | null; viewOnly: boolean }) {
  const t = useT(PURCHASING_STRINGS);
  const left = (line: PurchaseOrderLine) => Math.max(0, line.quantity - line.receivedQuantity);
  const received = fmt(t.receivedOf, { received: num(po.unitsReceived), ordered: num(po.unitsOrdered) });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="min-w-0 space-y-4">
        <Section title={t.linesTitle} flush>
          <ul className="divide-y divide-line border-t border-line">
            {po.lines.map((line) => {
              const detail = variantDetail(line.optionValues, line.sku);
              return (
                <li key={line.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-medium text-ink">
                      <bdi>{line.productName ?? t.unknownProduct}</bdi>
                    </p>
                    {detail && (
                      <p className="text-xs text-ink-soft">
                        <bdi>{detail}</bdi>
                      </p>
                    )}
                    <p className="mt-1 text-xs text-ink-soft tabular-nums">
                      {t.colReceived}: {fmt(t.receivedOf, { received: num(line.receivedQuantity), ordered: num(line.quantity) })}
                      {left(line) > 0 && (
                        <span className="font-medium text-ink">
                          {" · "}
                          {fmt(t.leftToReceive, { n: left(line) })}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-end tabular-nums">
                    <p className="font-medium whitespace-nowrap text-ink">
                      <bdi>{formatMoney(line.lineTotal, po.currency)}</bdi>
                    </p>
                    <p className="text-xs whitespace-nowrap text-ink-soft">
                      {t.colUnitCost}: <bdi>{formatMoney(line.unitCost, po.currency)}</bdi>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-baseline justify-between gap-3 border-t border-line px-4 py-3">
            <span className="text-sm font-medium text-ink">{t.total}</span>
            <bdi className="text-lg font-semibold text-ink tabular-nums">{formatMoney(po.totalAmount, po.currency)}</bdi>
          </div>
        </Section>
        {viewOnly && <ViewOnlyNote>{t.viewOnly}</ViewOnlyNote>}
      </div>

      <Section title={t.detailsTitle}>
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm text-ink tabular-nums">
              {t.colReceived}: {received}
            </p>
            <Meter value={po.unitsReceived} max={po.unitsOrdered} label={`${t.colReceived}: ${received}`} tone={po.status === "received" ? "success" : "primary"} />
          </div>
          <Facts>
            <Fact label={t.supplier}>
              <bdi>{po.supplier.name ?? t.unknownSupplier}</bdi>
            </Fact>
            {location && (
              <Fact label={t.receiveAt}>
                <bdi>{location.name}</bdi>
              </Fact>
            )}
            <Fact label={t.colExpected}>{formatDay(po.expectedAt) || t.noDate}</Fact>
          </Facts>
          {po.note && (
            <Well>
              <p className="text-xs leading-4 font-medium text-ink-soft">{t.colNote}</p>
              <p dir="auto" className="mt-1 text-sm leading-6 whitespace-pre-wrap wrap-anywhere text-ink">
                {po.note}
              </p>
            </Well>
          )}
        </div>
      </Section>
    </div>
  );
}
