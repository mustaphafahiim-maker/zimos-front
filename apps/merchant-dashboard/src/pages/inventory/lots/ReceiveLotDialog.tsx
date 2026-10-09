import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  STOCK_LOT_CODE_MAX,
  STOCK_LOT_NOTE_MAX,
  stockLotCreate,
  stockLotUnlabelledUnits,
  type Product,
  type PurchaseOrderSummary,
  type StockLocation,
  type StockLot,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { getFieldErrors } from "@/lib/errors";
import { parseWholeNumber } from "@/lib/wholeNumber";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { VariantAddRow, type PickVariant } from "../VariantAddRow";
import { useCatalogVariants } from "../useCatalogVariants";
import { LOT_STRINGS } from "./lotStrings";
import { LOT_DATE_INPUT, daysUntil } from "./lotText";

type Errors = Partial<Record<"product" | "lotCode" | "quantity" | "expiresOn", string>>;

const NOTHING_TAKEN: ReadonlySet<string> = new Set();

/**
 * «استلام دفعة» / Receive a lot (POST /stock-lots): the product, the lot's
 * code, its expiry date and how many units. «ضيفها للمخزون» on adds the units
 * to stock; off, the lot only labels units already on hand (the API refuses
 * more than the shelf holds without a lot). It can name the purchase order it
 * came on.
 */
export function ReceiveLotDialog({
  open,
  locations,
  purchaseOrders,
  onClose,
  onReceived,
}: {
  open: boolean;
  locations: StockLocation[];
  purchaseOrders: PurchaseOrderSummary[];
  onClose: () => void;
  onReceived: (lot: StockLot, addedToStock: boolean) => void;
}) {
  const t = useT(LOT_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const stockHint = useId();
  const [chosen, setChosen] = useState<PickVariant | null>(null);
  const [lotCode, setLotCode] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [quantity, setQuantity] = useState("");
  /** "" = the default location. */
  const [locationId, setLocationId] = useState("");
  const [addToStock, setAddToStock] = useState(true);
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChosen(null);
    setLotCode("");
    setExpiresOn("");
    setQuantity("");
    setLocationId("");
    setAddToStock(true);
    setPurchaseOrderId("");
    setNote("");
    setErrors({});
    setFailure(null);
  }, [open]);

  const clear = (key: keyof Errors) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const defaultLocation = locations.find((l) => l.isDefault) ?? null;
  const otherLocations = locations.filter((l) => !l.isDefault && l.isActive);
  // A lot arrives on an order that was placed: drafts and cancelled orders are not offered.
  const orders = purchaseOrders.filter((po) => po.status !== "draft" && po.status !== "cancelled");
  const past = expiresOn !== "" && daysUntil(expiresOn) < 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const count = parseWholeNumber(quantity, 1, 1_000_000);
    const found: Errors = {};
    if (!chosen) found.product = t.productError;
    if (!lotCode.trim()) found.lotCode = t.lotCodeError;
    if (count === null || Number.isNaN(count)) found.quantity = t.quantityError;
    setErrors(found);
    if (!chosen || found.lotCode || count === null || Number.isNaN(count)) {
      const first = (["product", "lotCode", "quantity"] as const).find((key) => found[key]);
      document.querySelector<HTMLElement>(`#${CSS.escape(formId)} [data-field="${first}"] :is(input, select)`)?.focus();
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      const lot = await stockLotCreate(apiClient, workspaceId, {
        variantId: chosen.variantId,
        lotCode: lotCode.trim(),
        expiresOn: expiresOn || null,
        quantity: count,
        addToStock,
        locationId: locationId || null,
        purchaseOrderId: purchaseOrderId || null,
        note: note.trim() || null,
      });
      onReceived(lot, addToStock);
    } catch (err) {
      // Labelling stock already on hand: the shelf holds fewer units without a lot than asked.
      const unlabelled = stockLotUnlabelledUnits(err);
      const fields = getFieldErrors(err);
      if (unlabelled !== null) setErrors({ quantity: fmt(t.onlyUnlabelled, { n: unlabelled }) });
      else if (fields.lotCode) setErrors({ lotCode: t.lotCodeError });
      else if (fields.quantity) setErrors({ quantity: t.quantityError });
      else setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={t.receiveTitle}
      description={t.receiveDescription}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={saving}>
            {saving ? t.saving : t.receiveSubmit}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <div data-field="product">
          {open && (
            <ProductPick
              error={errors.product}
              disabled={saving}
              onChoose={(variant) => {
                setChosen(variant);
                if (variant) clear("product");
              }}
            />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div data-field="lotCode">
            <TextField
              label={t.lotCode}
              required
              dir="auto"
              autoComplete="off"
              maxLength={STOCK_LOT_CODE_MAX}
              placeholder={t.lotCodePlaceholder}
              value={lotCode}
              disabled={saving}
              onChange={(e) => {
                setLotCode(e.target.value);
                clear("lotCode");
              }}
              error={errors.lotCode}
              className="[&_input]:h-11"
            />
          </div>
          <div data-field="quantity">
            <TextField
              label={t.quantity}
              required
              inputMode="numeric"
              dir="ltr"
              autoComplete="off"
              maxLength={7}
              value={quantity}
              disabled={saving}
              onChange={(e) => {
                setQuantity(e.target.value);
                clear("quantity");
              }}
              error={errors.quantity}
              className="[&_input]:h-11"
            />
          </div>
        </div>

        <Field label={t.expiresOn} hint={past ? t.expiresPast : t.expiresHint}>
          {(props) => (
            <input
              {...props}
              type="date"
              value={expiresOn}
              disabled={saving}
              onChange={(e) => setExpiresOn(e.target.value)}
              className={LOT_DATE_INPUT}
            />
          )}
        </Field>

        {/* A store with one place to keep stock has nothing to choose. */}
        {defaultLocation && otherLocations.length > 0 && (
          <Field label={t.location}>
            {(props) => (
              <Select {...props} className="h-11" value={locationId} disabled={saving} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">{fmt(t.defaultLocationShort, { name: defaultLocation.name })}</option>
                {otherLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              role="switch"
              className="size-5 shrink-0 cursor-pointer accent-primary"
              checked={addToStock}
              disabled={saving}
              aria-describedby={stockHint}
              onChange={(e) => setAddToStock(e.target.checked)}
            />
            {t.addToStock}
          </label>
          <p id={stockHint} className="text-xs text-ink-soft">
            {addToStock ? t.addToStockOn : t.addToStockOff}
          </p>
        </div>

        {orders.length > 0 && (
          <Field label={t.purchaseOrderField}>
            {(props) => (
              <Select {...props} className="h-11" value={purchaseOrderId} disabled={saving} onChange={(e) => setPurchaseOrderId(e.target.value)}>
                <option value="">{t.noPurchaseOrder}</option>
                {orders.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.supplier.name ? fmt(t.purchaseOrderOption, { number: po.number, supplier: po.supplier.name }) : po.number}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {purchaseOrderId && addToStock && <Alert>{t.countedTwice}</Alert>}

        <TextField
          label={t.note}
          dir="auto"
          autoComplete="off"
          maxLength={STOCK_LOT_NOTE_MAX}
          value={note}
          disabled={saving}
          onChange={(e) => setNote(e.target.value)}
          className="[&_input]:h-11"
        />

        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}

/** A product whose quantity is counted: digital products, services and untracked ones keep no lots. */
const keepsStock = (product: Product) =>
  product.productType === "physical" && (product as Product & { trackInventory?: boolean }).trackInventory !== false;

/**
 * The lot's product: the inventory's own picker as a one-variant field — the
 * product, then its variant. Its own component, so the catalog is read only
 * while the dialog is open.
 */
function ProductPick({ error, disabled, onChoose }: { error?: string; disabled: boolean; onChoose: (variant: PickVariant | null) => void }) {
  const t = useT(LOT_STRINGS);
  const workspaceId = useWorkspaceId();
  const catalog = useCatalogVariants(workspaceId);
  const variants = useMemo(() => {
    const tracked = new Set(catalog.products.filter(keepsStock).map((p) => p.id));
    return catalog.variants.filter((v) => tracked.has(v.productId));
  }, [catalog.products, catalog.variants]);

  return (
    <>
      <VariantAddRow
        legend={t.product}
        variants={variants}
        loading={catalog.loading}
        failed={catalog.failed}
        taken={NOTHING_TAKEN}
        disabled={disabled}
        query={catalog.query}
        onQuery={catalog.searchable ? catalog.setQuery : undefined}
        onAdd={onChoose}
        onSelect={onChoose}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </>
  );
}
