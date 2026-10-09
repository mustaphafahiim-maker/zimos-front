import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import {
  isApiErrorCode,
  priceScheduleGet,
  priceScheduleStop,
  type PriceSchedule,
  type PriceScheduleItem,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { canManageProducts } from "@/lib/productAccess";
import { formatMoney } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DataState, StateMessage } from "@/components/DataState";
import { IconLock } from "@/components/icons";
import { DataTable, type Column } from "@/components/DataTable";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { OfferPage } from "@/pages/offers/OfferKit";
import { variantDetail } from "@/pages/inventory/inventoryText";
import { TableCard, VariantCell } from "@/pages/inventory/InventoryParts";
import { ITEM_STATE_KEY, ITEM_STATE_TONE, PRICE_SCHEDULE_STRINGS, SCHEDULE_STATUS_KEY, SCHEDULE_STATUS_TONE } from "./priceScheduleStrings";
import { SalePreview } from "./SalePreview";
import { ScheduledSaleEditor } from "./ScheduledSaleEditor";
import { changeSummary, targetSummary } from "./scheduleText";
import { formatStoreDateTime } from "./storeTime";

/** Keyed by the sale in the URL, so going from "new" to the saved sale starts clean. */
export function ScheduledSalePage() {
  const { scheduleId } = useParams<{ scheduleId?: string }>();
  return <SaleView key={scheduleId ?? "new"} scheduleId={scheduleId ?? null} />;
}

/**
 * One scheduled sale (handoff 227). A new sale, or one that has not started,
 * is a form with its preview; «الغي التخفيض» calls it off. Once it runs the
 * page shows each variant's price before and during the sale and what became
 * of it, and «وقّف التخفيض» ends it now — the prices go back.
 *
 * /offers/scheduled-sales/new?product=<id> starts a new sale on that product.
 */
function SaleView({ scheduleId }: { scheduleId: string | null }) {
  const t = useT(PRICE_SCHEDULE_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageProducts(currentWorkspace?.role);
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const zone = currentWorkspace?.timezone ?? null;
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const sale = useAsync<PriceSchedule | null>(
    () => (scheduleId ? priceScheduleGet(apiClient, workspaceId, scheduleId) : Promise.resolve(null)),
    [workspaceId, scheduleId]
  );
  const collections = useAsync(() => apiClient.listCollections(workspaceId).catch(() => []), [workspaceId]);
  const collectionNames = useMemo(() => new Map((collections.data ?? []).map((c) => [c.id, c.name])), [collections.data]);

  const [dirty, setDirty] = useState(false);
  // Typed changes are guarded before the page is left (the shared "leave without saving?").
  useReportDirty(dirty);
  const [stopping, setStopping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const s = sale.data;
  const editable = !s || s.status === "scheduled";
  // ?product=<id>: a report's "Schedule a sale" starts the form on that product.
  const forProduct = !scheduleId ? searchParams.get("product") : null;

  /** The sale moved on meanwhile (it started, or it is over): say so and show it as it is now. */
  function stale(message: string) {
    setNotice(message);
    void sale.refresh({ silent: true });
  }

  async function confirmStop() {
    if (!s) return;
    const wasRunning = s.status === "active";
    try {
      sale.setData(await priceScheduleStop(apiClient, workspaceId, s.id));
    } catch (err) {
      if (isApiErrorCode(err, "PRICE_SCHEDULE_OVER")) {
        setStopping(false);
        stale(t.overNotice);
        return;
      }
      throw new Error(errorMessage(err));
    }
    setStopping(false);
    setNotice(null);
    toast.success(wasRunning ? t.stoppedToast : t.cancelledToast);
  }

  const stoppable = Boolean(s) && canManage && (s?.status === "scheduled" || s?.status === "active");
  const actions = stoppable ? (
    <Button
      type="button"
      variant="outline"
      className="min-h-11 rounded-full px-5 text-danger md:min-h-9"
      onClick={() => {
        // Unsaved edits would be lost with the sale they belong to.
        if (dirty) toast.error(t.saveFirst);
        else setStopping(true);
      }}
    >
      {s?.status === "active" ? t.stop : t.cancelSale}
    </Button>
  ) : undefined;

  return (
    <OfferPage
      back={{ to: "/offers/scheduled-sales", label: t.backToList }}
      title={s ? s.name : scheduleId ? t.fallbackTitle : t.newTitle}
      titleBadge={s ? <StatusBadge value={s.status} tone={SCHEDULE_STATUS_TONE[s.status]} text={t[SCHEDULE_STATUS_KEY[s.status]]} /> : undefined}
      actions={actions}
      width="wide"
    >

      <DataState loading={sale.loading} error={sale.error} onRetry={() => void sale.refresh()}>
        <div className="space-y-4">
          {notice && <Alert>{notice}</Alert>}
          {editable && canManage ? (
            <ScheduledSaleEditor
              sale={s}
              forProduct={forProduct}
              currency={currency}
              zone={zone}
              onDirtyChange={setDirty}
              // The form goes away with the reload, so the page says why.
              onLocked={() => stale(t.lockedNotice)}
              onSaved={(saved, created) => {
                toast.success(saved.status === "active" ? t.startedToast : created ? t.createdToast : t.savedToast);
                if (created) navigate(`/offers/scheduled-sales/${saved.id}`, { replace: true });
                else sale.setData(saved);
              }}
            />
          ) : s ? (
            <SaleDetails sale={s} currency={currency} zone={zone} collectionNames={collectionNames} viewOnly={!canManage} />
          ) : (
            // A new sale needs products.manage: say so instead of a form that would be refused.
            <StateMessage icon={<IconLock aria-hidden />} title={t.viewOnly} />
          )}
        </div>
      </DataState>

      {s && (
        <ConfirmDialog
          open={stopping}
          title={fmt(s.status === "active" ? t.stopTitle : t.cancelTitle, { name: s.name })}
          description={s.status === "active" ? t.stopBody : t.cancelBody}
          confirmLabel={s.status === "active" ? t.stop : t.cancelSale}
          cancelLabel={t.keep}
          busyLabel={t.working}
          destructive
          onCancel={() => setStopping(false)}
          onConfirm={confirmStop}
        />
      )}
    </OfferPage>
  );
}

/** A sale past its form: its facts, and each variant's price before and during it. */
function SaleDetails({
  sale,
  currency,
  zone,
  collectionNames,
  viewOnly,
}: {
  sale: PriceSchedule;
  currency: string;
  zone: string | null;
  collectionNames: ReadonlyMap<string, string>;
  viewOnly: boolean;
}) {
  const t = useT(PRICE_SCHEDULE_STRINGS);
  const items = sale.items ?? [];

  const columns: Column<PriceScheduleItem>[] = [
    {
      key: "product",
      header: t.colProduct,
      cell: (item) => <VariantCell name={item.productName ?? t.unknownProduct} detail={variantDetail(item.options, item.sku) || undefined} />,
    },
    {
      key: "before",
      header: t.colBefore,
      align: "end",
      cell: (item) => <span className="whitespace-nowrap tabular-nums text-ink-soft">{formatMoney(item.oldPrice, currency)}</span>,
    },
    {
      key: "during",
      header: t.colDuring,
      align: "end",
      cell: (item) => <span className="font-semibold whitespace-nowrap tabular-nums text-ink">{formatMoney(item.newPrice, currency)}</span>,
    },
    {
      key: "state",
      header: t.colState,
      cell: (item) => (
        <span className="flex flex-col items-start gap-0.5">
          <StatusBadge value={item.state} tone={ITEM_STATE_TONE[item.state]} text={t[ITEM_STATE_KEY[item.state]]} />
          {(item.state === "kept" || item.state === "skipped") && <span className="text-xs text-ink-soft">{t[`stateHint_${item.state}`]}</span>}
        </span>
      ),
    },
  ];

  const facts: Array<[string, string]> = [
    [t.factOnSale, targetSummary(t, sale.target, collectionNames)],
    [t.factDiscount, changeSummary(t, sale.change, currency)],
    [t.factStarts, formatStoreDateTime(sale.startsAt, zone)],
    [t.factEnds, sale.endsAt ? formatStoreDateTime(sale.endsAt, zone) : t.noEnd],
    [t.factWasPrice, sale.showWasPrice ? t.wasPriceShown : t.wasPriceHidden],
    ...(sale.appliedAt ? ([[t.factApplied, formatStoreDateTime(sale.appliedAt, zone)]] as Array<[string, string]>) : []),
    ...(sale.revertedAt ? ([[t.factReverted, formatStoreDateTime(sale.revertedAt, zone)]] as Array<[string, string]>) : []),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="order-2 min-w-0 space-y-3 lg:order-1">
        <div>
          <h2 className="text-sm font-semibold text-ink">{sale.status === "scheduled" ? t.previewTitle : t.pricesTitle}</h2>
          <p className="mt-0.5 text-xs text-ink-soft">{sale.status === "scheduled" ? t.previewHint : t.pricesHint}</p>
        </div>
        {sale.status === "scheduled" ? (
          // Not started: what it would do to today's prices.
          <SalePreview
            body={{ name: sale.name, startsAt: sale.startsAt, endsAt: null, target: sale.target, change: sale.change, showWasPrice: sale.showWasPrice }}
            currency={currency}
          />
        ) : items.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
            {sale.appliedAt ? t.noItems : t.neverStarted}
          </p>
        ) : (
          <TableCard>
            <DataTable columns={columns} rows={items} rowKey={(item) => item.variantId} minWidth="34rem" />
          </TableCard>
        )}
        {viewOnly && <p className="text-xs text-ink-soft">{t.viewOnly}</p>}
      </div>

      <Section title={t.factsTitle} className="order-1 lg:order-2">
        <dl className="space-y-3 text-sm">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink-soft">{label}</dt>
              <dd className="mt-0.5 text-ink">
                <bdi>{value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}
