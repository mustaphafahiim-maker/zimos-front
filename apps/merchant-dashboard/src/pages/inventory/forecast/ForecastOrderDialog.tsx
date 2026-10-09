import { useEffect, useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import {
  stockForecastCreatePurchaseOrder,
  stockForecastLineProblems,
  stockLocationsList,
  suppliersList,
  type PurchaseOrder,
  type StockForecastVariant,
  type StockLocation,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { SkeletonBar } from "@/components/DataState";
import { variantDetail, variantFullName } from "../inventoryText";
import { VariantCell } from "../InventoryParts";
import { FORECAST_STRINGS } from "./forecastStrings";

export interface ForecastOrderLine {
  variant: StockForecastVariant;
  quantity: number;
}

/**
 * «اعمل أمر شراء» / Create purchase order (POST /stock-forecast/purchase-order):
 * the supplier, where it will be received, and the lines ticked in the
 * forecast with their quantities. The answer is a draft purchase order; the
 * page that opened the dialog goes to it.
 */
export function ForecastOrderDialog({
  open,
  lines,
  onClose,
  onCreated,
}: {
  open: boolean;
  lines: ForecastOrderLine[];
  onClose: () => void;
  onCreated: (po: PurchaseOrder) => void;
}) {
  const t = useT(FORECAST_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const supplierFieldId = useId();
  const locationFieldId = useId();

  // Read when the dialog opens, so a supplier added a minute ago is in the list.
  const suppliers = useAsync(() => (open ? suppliersList(apiClient, workspaceId) : Promise.resolve(null)), [workspaceId, open]);
  // Without the locations the order still works (it is received at the default).
  const locations = useAsync(
    () =>
      open
        ? stockLocationsList(apiClient, workspaceId)
            .then((r) => r.locations)
            .catch(() => [] as StockLocation[])
        : Promise.resolve(null),
    [workspaceId, open]
  );

  const [supplierId, setSupplierId] = useState("");
  /** "" = the default location. */
  const [locationId, setLocationId] = useState("");
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSupplierId("");
    setLocationId("");
    setSupplierError(null);
    setFailures([]);
  }, [open]);

  const supplierList = suppliers.data ?? [];
  // One supplier: nothing to choose between.
  useEffect(() => {
    if (open && supplierList.length === 1) setSupplierId((current) => current || supplierList[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, suppliers.data]);

  const allLocations = locations.data ?? [];
  const defaultLocation = allLocations.find((l) => l.isDefault) ?? null;
  const otherLocations = allLocations.filter((l) => !l.isDefault && l.isActive);
  const lineName = (line: ForecastOrderLine) =>
    variantFullName(line.variant.productName, variantDetail(line.variant.optionValues, line.variant.sku));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || lines.length === 0) return;
    if (!supplierId) {
      setSupplierError(t.supplierError);
      document.getElementById(supplierFieldId)?.focus();
      return;
    }
    setSaving(true);
    setFailures([]);
    try {
      onCreated(
        await stockForecastCreatePurchaseOrder(apiClient, workspaceId, {
          supplierId,
          locationId: locationId || null,
          lines: lines.map((line) => ({ variantId: line.variant.variantId, quantity: line.quantity })),
        })
      );
    } catch (err) {
      // A refused line is named, with what is wrong with it.
      const named = stockForecastLineProblems(err)
        .map((problem) => {
          const line = lines[problem.index];
          return line ? fmt(problem.field === "quantity" ? t.lineNothing : t.lineNotTracked, { name: lineName(line) }) : null;
        })
        .filter((message): message is string => message !== null);
      setFailures(named.length > 0 ? named : [errorMessage(err)]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={t.poTitle}
      description={t.poDescription}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={saving || suppliers.loading || supplierList.length === 0}>
            {saving ? t.poCreating : t.poSubmit}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={supplierFieldId} className="text-sm font-medium text-ink">
            {t.supplier}
            <span className="text-danger"> *</span>
          </label>
          {suppliers.loading ? (
            <SkeletonBar className="h-11 w-full rounded-[var(--radius)]" />
          ) : suppliers.error ? (
            <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-danger">
              {t.suppliersFailed}
              <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void suppliers.refresh()}>
                {t.retry}
              </Button>
            </p>
          ) : supplierList.length === 0 ? (
            <p className="text-sm text-ink-soft">
              {t.noSuppliers}{" "}
              <Link to="/inventory/suppliers" className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-2 sm:min-h-0">
                {t.addSupplierLink}
              </Link>
            </p>
          ) : (
            <>
              <Select
                id={supplierFieldId}
                className="h-11"
                value={supplierId}
                disabled={saving}
                aria-invalid={supplierError ? true : undefined}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  setSupplierError(null);
                }}
              >
                <option value="">{t.chooseSupplier}</option>
                {supplierList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              {supplierError && <p className="text-xs font-medium text-danger">{supplierError}</p>}
            </>
          )}
        </div>

        {/* A store with one place to receive at has nothing to choose. */}
        {defaultLocation && otherLocations.length > 0 && (
          <div className="space-y-1.5">
            <label htmlFor={locationFieldId} className="text-sm font-medium text-ink">
              {t.receiveAt}
            </label>
            <Select id={locationFieldId} className="h-11" value={locationId} disabled={saving} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">{fmt(t.defaultLocation, { name: defaultLocation.name })}</option>
              {otherLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">{t.linesTitle}</p>
          <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-[var(--radius)] ring-1 ring-line">
            {lines.map((line) => (
              <li key={line.variant.variantId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <VariantCell name={line.variant.productName} detail={variantDetail(line.variant.optionValues, line.variant.sku) || undefined} />
                <bdi dir="ltr" className="shrink-0 font-semibold tabular-nums text-ink">
                  {fmt(t.lineQuantity, { n: line.quantity })}
                </bdi>
              </li>
            ))}
          </ul>
        </div>

        {failures.length > 0 && (
          <Alert variant="danger">
            {failures.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </Alert>
        )}
      </form>
    </Modal>
  );
}
