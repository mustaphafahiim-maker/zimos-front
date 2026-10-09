import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  apiErrorDetails,
  isApiErrorCode,
  purchaseOrderReceive,
  type PurchaseOrder,
  type PurchaseOrderOverReceived,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { parseWholeNumber } from "@/lib/wholeNumber";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { PURCHASING_STRINGS } from "./purchasingStrings";
import { variantDetail, variantFullName } from "./inventoryText";
import { VariantCell } from "./InventoryParts";

/**
 * «استلام» / Receive (POST /purchase-orders/:id/receive): a quantity per line
 * that still has units to come — it starts at what is left — and «حدّث
 * التكلفة», which sets each variant's cost to the weighted average of the
 * stock it had and what arrives. The units go to the order's location.
 */
export function ReceiveDialog({
  open,
  po,
  locationName,
  onClose,
  onReceived,
  onStale,
}: {
  open: boolean;
  po: PurchaseOrder;
  /** Where the units land, when the order names a location. */
  locationName: string | null;
  onClose: () => void;
  onReceived: (next: PurchaseOrder) => void;
  /** The order changed under the dialog (409 PO_STATUS, or a line with less left than shown). */
  onStale: () => void;
}) {
  const t = useT(PURCHASING_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const costHint = useId();
  const pending = po.lines.filter((line) => line.receivedQuantity < line.quantity);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [updateCost, setUpdateCost] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Each opening starts with everything that is left.
  useEffect(() => {
    if (!open) return;
    setQuantities(Object.fromEntries(po.lines.map((line) => [line.id, String(Math.max(0, line.quantity - line.receivedQuantity))])));
    setLineErrors({});
    setUpdateCost(true);
    setFailure(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFailure(null);
    const errors: Record<string, string> = {};
    const lines: Array<{ lineId: string; quantity: number }> = [];
    for (const line of pending) {
      const left = line.quantity - line.receivedQuantity;
      // An empty field is a line that did not arrive this time.
      const quantity = parseWholeNumber(quantities[line.id] ?? "", 0, left) ?? 0;
      if (Number.isNaN(quantity)) errors[line.id] = fmt(t.receiveQtyError, { n: left });
      else if (quantity > 0) lines.push({ lineId: line.id, quantity });
    }
    setLineErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (lines.length === 0) {
      setFailure(t.receiveNothing);
      return;
    }
    setSaving(true);
    try {
      onReceived(await purchaseOrderReceive(apiClient, workspaceId, po.id, { lines, updateCost }));
    } catch (err) {
      if (isApiErrorCode(err, "PO_OVER_RECEIVED")) {
        // Someone received part of it meanwhile: the answer names the line and what is left now.
        const over = apiErrorDetails<PurchaseOrderOverReceived[]>(err)?.[0];
        const left = Math.max(0, over?.left ?? 0);
        if (over?.lineId) setLineErrors({ [over.lineId]: fmt(t.receiveQtyError, { n: left }) });
        setFailure(fmt(t.overReceived, { n: left }));
        onStale();
      } else if (isApiErrorCode(err, "PO_STATUS")) {
        setFailure(t.poStatusChanged);
        onStale();
      } else {
        setFailure(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={fmt(t.receiveTitle, { number: po.number })}
      description={locationName ? fmt(t.receiveDescriptionAt, { name: locationName }) : t.receiveDescription}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={saving}>
            {saving ? t.receiving : t.receiveSubmit}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <ul className="divide-y divide-line rounded-[var(--radius)] ring-1 ring-line">
          {pending.map((line) => {
            const left = line.quantity - line.receivedQuantity;
            const productName = line.productName ?? t.unknownProduct;
            const detail = variantDetail(line.optionValues, line.sku);
            const error = lineErrors[line.id];
            return (
              <li key={line.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1 basis-40">
                  <VariantCell name={productName} detail={detail || undefined} />
                  <p className={error ? "text-xs font-medium text-danger" : "text-xs text-ink-soft"}>{error ?? fmt(t.leftToReceive, { n: left })}</p>
                </div>
                <Input
                  inputMode="numeric"
                  dir="ltr"
                  autoComplete="off"
                  maxLength={7}
                  value={quantities[line.id] ?? ""}
                  disabled={saving}
                  aria-label={fmt(t.receiveQtyFor, { name: variantFullName(productName, detail) })}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => {
                    setQuantities((prev) => ({ ...prev, [line.id]: e.target.value }));
                    if (error) {
                      setLineErrors((prev) => {
                        const next = { ...prev };
                        delete next[line.id];
                        return next;
                      });
                    }
                  }}
                  className="h-11 w-24 text-center tabular-nums"
                />
              </li>
            );
          })}
        </ul>

        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              className="size-5 shrink-0 cursor-pointer accent-primary"
              checked={updateCost}
              disabled={saving}
              aria-describedby={costHint}
              onChange={(e) => setUpdateCost(e.target.checked)}
            />
            {t.updateCost}
          </label>
          <p id={costHint} className="text-xs text-ink-soft">
            {t.updateCostHint}
          </p>
        </div>

        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
