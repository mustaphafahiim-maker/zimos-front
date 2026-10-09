import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { IconDelete } from "@/components/icons";
import { Alert, Input } from "@store-builder/ui";
import {
  isApiErrorCode,
  purchaseOrderCreate,
  purchaseOrderUpdate,
  type PurchaseOrder,
  type PurchaseOrderInput,
  type StockLocation,
  type Supplier,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { formatMoney, minorToMajorInput } from "@/lib/format";
import { parseWholeNumber } from "@/lib/wholeNumber";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { SaveBar } from "@/components/SaveBar";
import { Section } from "@/components/Section";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { PURCHASING_STRINGS } from "./purchasingStrings";
import { costToMinor, variantDetail, variantFullName } from "./inventoryText";
import { VariantCell } from "./InventoryParts";
import { VariantAddRow } from "./VariantAddRow";
import { useCatalogVariants } from "./useCatalogVariants";

interface Line {
  variantId: string;
  name: string;
  detail: string;
  quantity: string;
  /** Major units as typed, "12.50". */
  unitCost: string;
  quantityError?: string;
  costError?: string;
}

interface Draft {
  supplierId: string;
  /** "" = the default location. */
  locationId: string;
  expectedAt: string;
  note: string;
  lines: Line[];
}

function draftOf(po: PurchaseOrder | null, unknownProduct: string): Draft {
  return {
    supplierId: po?.supplier.id ?? "",
    locationId: po?.locationId ?? "",
    expectedAt: po?.expectedAt ?? "",
    note: po?.note ?? "",
    lines: (po?.lines ?? []).map((line) => ({
      variantId: line.variantId,
      name: line.productName ?? unknownProduct,
      detail: variantDetail(line.optionValues, line.sku),
      quantity: String(line.quantity),
      unitCost: minorToMajorInput(line.unitCost),
    })),
  };
}

/** What a save would send, as text: two drafts with the same text have nothing to save between them. */
const fingerprint = (draft: Draft) =>
  JSON.stringify([draft.supplierId, draft.locationId, draft.expectedAt, draft.note.trim(), draft.lines.map((l) => [l.variantId, l.quantity.trim(), l.unitCost.trim()])]);

const DATE_INPUT =
  "flex h-11 w-full max-w-[14rem] rounded-[var(--radius)] border border-line-strong bg-paper-raised px-3 text-sm text-ink focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none";

/**
 * A draft purchase order's form (POST / PUT /purchasing/purchase-orders): the
 * supplier, where it will be received, when it is expected, a note, and the
 * lines — a variant, a quantity and what one unit costs. A new order saves as
 * a draft; an existing draft shows the save bar once something changed.
 */
export function PurchaseOrderEditor({
  po,
  suppliers,
  locations,
  currency,
  onSaved,
  onDirtyChange,
  onLocked,
}: {
  /** The draft being edited; null for a new order. */
  po: PurchaseOrder | null;
  suppliers: Supplier[];
  locations: StockLocation[];
  currency: string;
  onSaved: (saved: PurchaseOrder, created: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** The order left the draft status meanwhile (409 PO_LOCKED). */
  onLocked?: () => void;
}) {
  const t = useT(PURCHASING_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const catalog = useCatalogVariants(workspaceId);
  const formId = useId();
  const supplierFieldId = useId();
  const locationFieldId = useId();

  const [draft, setDraft] = useState<Draft>(() => draftOf(po, t.unknownProduct));
  const [baseline, setBaseline] = useState(() => fingerprint(draftOf(po, t.unknownProduct)));
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [linesError, setLinesError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = fingerprint(draft) !== baseline;
  // Arms the browser's own "leave?" prompt while something is unsaved (the page wraps this form in the guard).
  useReportDirty(dirty);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const taken = useMemo(() => new Set(draft.lines.map((l) => l.variantId)), [draft.lines]);
  const defaultLocation = locations.find((l) => l.isDefault) ?? null;
  // Where it can be received: the default (sent as "none") and every other location that is on, plus the saved one.
  const otherLocations = locations.filter((l) => !l.isDefault && (l.isActive || l.id === draft.locationId));

  const patch = (change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change }));
  const patchLine = (variantId: string, change: Partial<Line>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.variantId === variantId ? { ...l, ...change } : l)) }));

  const total = draft.lines.reduce((sum, line) => {
    const quantity = parseWholeNumber(line.quantity, 1, 1_000_000);
    const cost = costToMinor(line.unitCost);
    return quantity !== null && !Number.isNaN(quantity) && !Number.isNaN(cost) ? sum + quantity * cost : sum;
  }, 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFailure(null);
    let bad = false;
    if (!draft.supplierId) {
      setSupplierError(t.supplierError);
      bad = true;
    }
    if (draft.lines.length === 0) {
      setLinesError(t.linesError);
      bad = true;
    }
    const payloadLines: PurchaseOrderInput["lines"] = [];
    const checked = draft.lines.map((line) => {
      const quantity = parseWholeNumber(line.quantity, 1, 1_000_000);
      const cost = costToMinor(line.unitCost);
      const quantityError = quantity === null || Number.isNaN(quantity) ? t.lineQtyError : undefined;
      const costError = Number.isNaN(cost) ? t.lineCostError : undefined;
      if (quantityError || costError || quantity === null) bad = true;
      else payloadLines.push({ variantId: line.variantId, quantity, unitCost: cost });
      return { ...line, quantityError, costError };
    });
    patch({ lines: checked });
    if (bad) {
      // The cursor goes to the first thing to fix: the supplier, the picker of an empty order, or a line's field.
      const first = !draft.supplierId ? `#${CSS.escape(supplierFieldId)}` : draft.lines.length === 0 ? '[data-field="picker"] select' : '[data-line] input[aria-invalid="true"]';
      window.requestAnimationFrame(() => {
        const target = document.getElementById(formId)?.querySelector<HTMLElement>(first);
        target?.scrollIntoView({ block: "center" });
        target?.focus({ preventScroll: true });
      });
      return;
    }

    const body: PurchaseOrderInput = {
      supplierId: draft.supplierId,
      locationId: draft.locationId || null,
      expectedAt: draft.expectedAt || null,
      note: draft.note.trim() || null,
      lines: payloadLines,
    };
    setSaving(true);
    try {
      const saved = po ? await purchaseOrderUpdate(apiClient, workspaceId, po.id, body) : await purchaseOrderCreate(apiClient, workspaceId, body);
      const next = draftOf(saved, t.unknownProduct);
      setDraft(next);
      setBaseline(fingerprint(next));
      onSaved(saved, !po);
    } catch (err) {
      if (isApiErrorCode(err, "PO_LOCKED")) {
        // The page reloads the order and says why; without a page to do it, the form says it.
        if (onLocked) onLocked();
        else setFailure(t.poLocked);
      } else {
        setFailure(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Section title={t.linesTitle} description={t.linesDescription} className="order-2 lg:order-1">
          <div className="space-y-4">
            {draft.lines.length === 0 ? (
              <p
                className={
                  linesError
                    ? "rounded-[var(--radius)] border border-dashed border-danger/50 px-4 py-5 text-center text-sm font-medium text-danger"
                    : "rounded-[var(--radius)] border border-dashed border-line px-4 py-5 text-center text-sm text-ink-soft"
                }
                role={linesError ? "alert" : undefined}
              >
                {linesError ?? t.linesEmpty}
              </p>
            ) : (
              <ul className="zimos-inv-lines divide-y divide-line rounded-2xl ring-1 ring-line">
                {draft.lines.map((line) => (
                  <LineRow
                    key={line.variantId}
                    line={line}
                    currency={currency}
                    disabled={saving}
                    onChange={(change) => patchLine(line.variantId, change)}
                    onRemove={() => patch({ lines: draft.lines.filter((l) => l.variantId !== line.variantId) })}
                  />
                ))}
              </ul>
            )}

            <div data-field="picker">
            <VariantAddRow
              legend={t.addProduct}
              variants={catalog.variants}
              loading={catalog.loading}
              failed={catalog.failed}
              taken={taken}
              disabled={saving}
              query={catalog.query}
              onQuery={catalog.searchable ? catalog.setQuery : undefined}
              onAdd={(picked) => {
                // A variant's saved cost is the starting point for what one unit costs now.
                const known = catalog.variants.find((v) => v.variantId === picked.variantId)?.variant.costAmount ?? null;
                setLinesError(null);
                patch({
                  lines: [
                    ...draft.lines,
                    {
                      variantId: picked.variantId,
                      name: picked.productName,
                      detail: picked.detail,
                      quantity: "1",
                      unitCost: known === null ? "" : minorToMajorInput(known),
                    },
                  ],
                });
              }}
            />
            </div>

            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
              <span className="text-sm font-medium text-ink">{t.total}</span>
              <span className="text-lg font-semibold tabular-nums text-ink">{formatMoney(total, currency)}</span>
            </div>
          </div>
        </Section>

        <Section title={t.detailsTitle} className="order-1 lg:order-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor={supplierFieldId} className="text-sm font-medium text-ink">
                {t.supplier}
                <span className="text-danger"> *</span>
              </label>
              <Select
                id={supplierFieldId}
                className="h-11"
                value={draft.supplierId}
                disabled={saving}
                aria-invalid={supplierError ? true : undefined}
                onChange={(e) => {
                  patch({ supplierId: e.target.value });
                  setSupplierError(null);
                }}
              >
                <option value="">{t.chooseSupplier}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              {supplierError && <p className="text-xs font-medium text-danger">{supplierError}</p>}
              {suppliers.length === 0 && (
                <p className="text-xs text-ink-soft">
                  {t.noSuppliers}{" "}
                  <Link to="/inventory/suppliers" className="font-medium text-primary underline underline-offset-2">
                    {t.addSupplierLink}
                  </Link>
                </p>
              )}
            </div>

            {defaultLocation && (
              <div className="space-y-1.5">
                <label htmlFor={locationFieldId} className="text-sm font-medium text-ink">
                  {t.receiveAt}
                </label>
                <Select
                  id={locationFieldId}
                  className="h-11"
                  value={draft.locationId}
                  disabled={saving}
                  onChange={(e) => patch({ locationId: e.target.value })}
                >
                  <option value="">{fmt(t.defaultLocation, { name: defaultLocation.name })}</option>
                  {otherLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-ink-soft">{t.receiveAtHint}</p>
              </div>
            )}

            <Field label={t.expectedAt}>
              {(props) => (
                <input
                  {...props}
                  type="date"
                  value={draft.expectedAt}
                  disabled={saving}
                  onChange={(e) => patch({ expectedAt: e.target.value })}
                  className={DATE_INPUT}
                />
              )}
            </Field>

            <Field label={t.poNote}>
              {(props) => (
                <Textarea
                  {...props}
                  rows={3}
                  dir="auto"
                  maxLength={500}
                  value={draft.note}
                  disabled={saving}
                  onChange={(e) => patch({ note: e.target.value })}
                />
              )}
            </Field>
          </div>
        </Section>
      </div>

      {failure && <Alert variant="danger">{failure}</Alert>}

      {/* A new order keeps its one button in reach from the first field; a saved draft shows the bar once something changed. */}
      <SaveBar
        dirty={dirty || !po}
        saving={saving}
        saveLabel={po ? undefined : t.saveDraft}
        message={po || dirty ? undefined : t.linesDescription}
        onDiscard={po ? () => setDraft(draftOf(po, t.unknownProduct)) : undefined}
      />
    </form>
  );
}

/** One line of the form: the variant, how many, what one costs, and what the line comes to. */
function LineRow({
  line,
  currency,
  disabled,
  onChange,
  onRemove,
}: {
  line: Line;
  currency: string;
  disabled: boolean;
  onChange: (change: Partial<Line>) => void;
  onRemove: () => void;
}) {
  const t = useT(PURCHASING_STRINGS);
  const quantityId = useId();
  const costId = useId();
  const name = variantFullName(line.name, line.detail);
  const quantity = parseWholeNumber(line.quantity, 1, 1_000_000);
  const cost = costToMinor(line.unitCost);
  const lineTotal = quantity !== null && !Number.isNaN(quantity) && !Number.isNaN(cost) ? quantity * cost : null;

  return (
    <li data-line="" className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_6rem_9rem_7rem_auto] sm:items-start">
      <div className="col-span-2 min-w-0 sm:col-span-1 sm:pt-6">
        <VariantCell name={line.name} detail={line.detail || undefined} />
      </div>
      <div className="space-y-1">
        <label htmlFor={quantityId} className="block text-xs text-ink-soft">
          {t.colQuantity}
          <span className="sr-only"> — {name}</span>
        </label>
        <Input
          id={quantityId}
          inputMode="numeric"
          dir="ltr"
          autoComplete="off"
          maxLength={7}
          value={line.quantity}
          disabled={disabled}
          aria-invalid={line.quantityError ? true : undefined}
          onChange={(e) => onChange({ quantity: e.target.value, quantityError: undefined })}
          className="h-11 text-center tabular-nums"
        />
        {line.quantityError && <p className="text-xs font-medium text-danger">{line.quantityError}</p>}
      </div>
      <div className="space-y-1">
        <label htmlFor={costId} className="block text-xs text-ink-soft">
          {t.colUnitCost}
          <span className="sr-only"> — {name}</span>
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-xs text-ink-soft">{currency}</span>
          <Input
            id={costId}
            inputMode="decimal"
            dir="ltr"
            autoComplete="off"
            maxLength={13}
            placeholder="0.00"
            value={line.unitCost}
            disabled={disabled}
            aria-invalid={line.costError ? true : undefined}
            onChange={(e) => onChange({ unitCost: e.target.value, costError: undefined })}
            className="h-11 ps-11 tabular-nums"
          />
        </div>
        {line.costError && <p className="text-xs font-medium text-danger">{line.costError}</p>}
      </div>
      <div className="space-y-1 sm:text-end">
        <p className="text-xs text-ink-soft">{t.colLineTotal}</p>
        <p className="flex min-h-11 items-center font-medium tabular-nums text-ink sm:justify-end">
          {lineTotal === null ? "—" : formatMoney(lineTotal, currency)}
        </p>
      </div>
      <div className="flex items-end justify-end sm:pt-5">
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          aria-label={fmt(t.removeLine, { name })}
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-50"
        >
          <IconDelete className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}
