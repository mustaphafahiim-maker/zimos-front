import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  stockLocationAdjust,
  type LocationStockVariant,
  type StockLocation,
  type VariantLocationCount,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { parseWholeNumber } from "@/lib/wholeNumber";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/Field";
import { Segmented } from "@/components/Segmented";
import { INVENTORY_STRINGS } from "./inventoryStrings";
import { num, variantDetail, variantFullName } from "./inventoryText";

export type AdjustMode = "receive" | "writeOff";
type Mode = AdjustMode;
type Errors = Partial<Record<"quantity" | "reason", string>>;

/**
 * «استلام / خصم» (POST /stock-locations/:id/adjust): units that arrived at a
 * location, or units written off there, with the reason that names the stock
 * movement. The store's total moves with it. A write-off can't take the
 * location below zero (422 INSUFFICIENT_STOCK).
 */
export function AdjustStockDialog({
  location,
  row,
  initialMode = "receive",
  onClose,
  onDone,
}: {
  location: StockLocation;
  /** What the sheet opens on: the row's menu can ask for a write-off straight away. */
  initialMode?: AdjustMode;
  /** The variant being adjusted; null closes the dialog. */
  row: LocationStockVariant | null;
  onClose: () => void;
  /** The variant's counts at this location after the change (null when the answer left it out). */
  onDone: (variantId: string, counts: VariantLocationCount | null) => void;
}) {
  const t = useT(INVENTORY_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const [mode, setMode] = useState<Mode>("receive");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // What the dialog was opened for, kept while it closes.
  const [shown, setShown] = useState<LocationStockVariant | null>(row);

  useEffect(() => {
    if (!row) return;
    setShown(row);
    setMode(initialMode);
    setQuantity("");
    setReason("");
    setErrors({});
    setFailure(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  const onHand = shown?.onHand ?? 0;
  const typed = parseWholeNumber(quantity, 1, 1_000_000);
  const valid = typed !== null && !Number.isNaN(typed);
  const after = valid ? onHand + (mode === "receive" ? typed : -typed) : null;
  const name = shown
    ? variantFullName(shown.productName ?? t.unknownProduct, variantDetail(shown.optionValues, shown.sku))
    : "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !shown) return;
    const found: Errors = {};
    if (typed === null || Number.isNaN(typed)) found.quantity = t.quantityError;
    else if (mode === "writeOff" && typed > onHand) found.quantity = fmt(t.writeOffTooMany, { n: Math.max(0, onHand) });
    if (!reason.trim()) found.reason = t.reasonError;
    setErrors(found);
    if (found.quantity || found.reason || typed === null) {
      const first = found.quantity ? "quantity" : "reason";
      document.querySelector<HTMLElement>(`#${CSS.escape(formId)} [data-field="${first}"] input`)?.focus();
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      const view = await stockLocationAdjust(apiClient, workspaceId, location.id, {
        variantId: shown.variantId,
        delta: mode === "receive" ? typed : -typed,
        reason: reason.trim(),
      });
      onDone(shown.variantId, view?.locations.find((l) => l.locationId === location.id) ?? null);
    } catch (err) {
      setFailure(errorMessage(err, { INSUFFICIENT_STOCK: t.insufficient }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={row !== null}
      onClose={onClose}
      title={t.adjustTitle}
      description={t.adjustDescription}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={saving}>
            {saving ? t.saving : mode === "receive" ? t.adjustSubmitReceive : t.adjustSubmitWriteOff}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <div className="rounded-[var(--radius)] bg-paper-sunken px-3 py-2">
          <p className="text-sm font-medium text-ink">
            <bdi>{name}</bdi>
          </p>
          <p className="text-xs text-ink-soft">
            <bdi>{location.name}</bdi>
          </p>
        </div>

        <Segmented<Mode>
          label={t.adjustModeLabel}
          value={mode}
          onChange={(next) => {
            setMode(next);
            setErrors({});
          }}
          options={[
            { value: "receive", label: t.modeReceive },
            { value: "writeOff", label: t.modeWriteOff },
          ]}
          className="w-full"
        />

        <div data-field="quantity">
          <TextField
            label={t.quantity}
            required
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            maxLength={7}
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              if (errors.quantity) setErrors((prev) => ({ ...prev, quantity: undefined }));
            }}
            error={errors.quantity}
          />
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-[var(--radius)] bg-paper-sunken px-3 py-2">
            <dt className="text-xs text-ink-soft">{t.onHandNow}</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-ink">{num(onHand)}</dd>
          </div>
          <div className="rounded-[var(--radius)] bg-paper-sunken px-3 py-2">
            <dt className="text-xs text-ink-soft">{t.onHandAfter}</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-ink">{after === null ? "—" : num(after)}</dd>
          </div>
        </dl>

        <div data-field="reason">
          <TextField
            label={t.reason}
            required
            dir="auto"
            autoComplete="off"
            maxLength={200}
            placeholder={mode === "receive" ? t.reasonReceivePlaceholder : t.reasonWriteOffPlaceholder}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (errors.reason) setErrors((prev) => ({ ...prev, reason: undefined }));
            }}
            error={errors.reason}
          />
        </div>

        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
