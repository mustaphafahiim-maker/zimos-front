import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  isApiErrorCode,
  type CreateVariantPayload,
  type UpdateVariantPayload,
  type Variant,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { majorToMinor, minorToMajorInput } from "@/lib/format";
import { TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Segmented } from "@/components/Segmented";
import { WeightInput } from "@/components/WeightInput";
import { gramsToKgInput, kgInputToGrams } from "@/lib/weight";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useCatalogLabels } from "../catalogLabels";
import { ImageField } from "@/pages/website/editor/ImageField";
import { OptionChipsInput } from "../variants/OptionChipsInput";
import { optionPairs, parseOptionValues, stringifyOptionValues } from "../variants/optionValues";

const STRINGS = {
  en: {
    sku: "SKU",
    price: "Price",
    cost: "Cost",
    optional: "Optional.",
    compareAt: "Price before discount",
    compareAtHint: "Optional — shown struck-through in the store.",
    stock: "Stock on hand",
    stockHint: "How many you have now. You can change it later from the variants grid or from Inventory.",
    options: "Options",
    stockLine: "Stock: {onHand} on hand",
    reserved: ", {reserved} reserved",
    managedInInventory: " — change it from the variants grid or from Inventory.",
    optionsLine: "Options",
    optionsLocked: "Options can't be changed after the variant is added.",
    status: "Status",
    allowOverselling: "Keep selling after it runs out (accept orders past the available stock)",
    priceInvalid: "Enter a valid price (0 or more).",
    costInvalid: "Enter a valid cost, or leave it blank.",
    compareAtInvalid: "Enter a valid amount, or leave it blank.",
    weight: "Weight",
    weightUnit: "kg",
    weightHint: "Used for the shipping price and the courier's package. Leave blank if unknown.",
    image: "Variant image",
    imageHint: "Optional. Shown on the product page when this variant is chosen, and in the cart.",
    weightInvalid: "Enter a weight between 0 and 1000 kg, or leave it blank.",
    skuTaken: "That SKU is already used by another variant.",
    cancel: "Cancel",
    saving: "Saving…",
    save: "Save variant",
    add: "Add variant",
  },
  ar: {
    sku: "SKU",
    price: "السعر",
    cost: "التكلفة",
    optional: "اختياري.",
    compareAt: "السعر قبل الخصم",
    compareAtHint: "اختياري — بيظهر مشطوب في المتجر.",
    stock: "المخزون دلوقتي",
    stockHint: "عندك كام قطعة دلوقتي. تقدر تغيّره بعد كده من جدول المتغيرات أو من المخزون.",
    options: "الخيارات",
    stockLine: "المخزون: {onHand} متاح",
    reserved: "، {reserved} محجوز",
    managedInInventory: " — بيتغيّر من جدول المتغيرات أو من المخزون.",
    optionsLine: "الخيارات",
    optionsLocked: "الخيارات مش بتتعدّل بعد ما المتغير يتضاف.",
    status: "الحالة",
    allowOverselling: "كمّل بيع بعد ما المخزون يخلص (اقبل أوردرات أكتر من المتاح)",
    priceInvalid: "اكتب سعر صحيح (صفر أو أكتر).",
    costInvalid: "اكتب تكلفة صحيحة، أو سيبها فاضية.",
    compareAtInvalid: "اكتب مبلغ صحيح، أو سيبه فاضي.",
    weight: "الوزن",
    weightUnit: "كجم",
    weightHint: "بيتحسب بيه سعر الشحن ونوع الشحنة عند شركة الشحن. سيبه فاضي لو مش عارفه.",
    image: "صورة المتغير",
    imageHint: "اختياري. بتظهر في صفحة المنتج لما العميل يختار المتغير ده، وفي السلة.",
    weightInvalid: "اكتب وزن بين 0 و1000 كجم، أو سيبه فاضي.",
    skuTaken: "الـ SKU ده مستخدم لمتغير تاني.",
    cancel: "إلغاء",
    saving: "بنحفظ…",
    save: "احفظ المتغير",
    add: "ضيف المتغير",
  },
} satisfies Messages;

interface Props {
  productId: string;
  variant?: Variant;
  onDone: () => void;
  onCancel: () => void;
  /** False for a product whose quantity is not tracked: no stock and no overselling choice. */
  tracked?: boolean;
  /** Shown under the SKU (a product linked to the merchant's other store: its SKUs are that store's ids). */
  skuNote?: ReactNode;
  /**
   * The form's element id. A sheet that keeps the actions in its own pinned
   * footer gives one and points its save button at it (`<button form={formId}>`).
   */
  formId?: string;
  /** Without the Cancel / Save row: whoever holds the form draws the actions (a sheet's footer). */
  hideActions?: boolean;
  /** Told when a save starts and when it ends, so actions drawn outside the form can wait with it. */
  onSavingChange?: (saving: boolean) => void;
}

/**
 * Everything about one variant. Adding: its options as chips («المقاس: M» —
 * free text, as the API has always taken them: `{ Size: "M" }`), price, stock,
 * SKU, cost, weight, picture. Editing: the same without the options and the
 * stock (options are fixed once the variant exists; stock is changed from the
 * grid or from Inventory), plus its status.
 *
 * The calls and what they send did not change: `createVariant` /
 * `updateVariant` with the same fields as before.
 */
export function VariantForm({ productId, variant, onDone, onCancel, tracked = true, skuNote, formId, hideActions = false, onSavingChange }: Props) {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const isEdit = Boolean(variant);
  // A new variant is priced in the store's own currency (backend currencies/baseCurrency.js).
  const storeCurrency = useWorkspace().currentWorkspace?.defaultCurrency ?? "EGP";
  const currency = variant?.currency ?? storeCurrency;

  const [sku, setSku] = useState(variant?.sku ?? "");
  const [price, setPrice] = useState(minorToMajorInput(variant?.priceAmount));
  const [cost, setCost] = useState(minorToMajorInput(variant?.costAmount));
  const [compareAt, setCompareAt] = useState(minorToMajorInput(variant?.compareAtAmount));
  const [weight, setWeight] = useState(gramsToKgInput(variant?.weightGrams));
  const [stock, setStock] = useState("0");
  const [options, setOptions] = useState(stringifyOptionValues(variant?.optionValues));
  const [allowOverselling, setAllowOverselling] = useState(variant?.allowOverselling ?? false);
  const [status, setStatus] = useState<"active" | "archived">(variant?.status ?? "active");
  // The variant's own picture (SPEC §7.2); the Variant type does not name it yet.
  const [imageUrl, setImageUrl] = useState((variant as { imageUrl?: string | null } | undefined)?.imageUrl ?? "");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    onSavingChange?.(saving);
    // Only a change of `saving` is news; the callback itself may be new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    setFieldErrors({});

    const priceMinor = majorToMinor(price);
    if (!Number.isFinite(priceMinor) || priceMinor < 0) {
      setFieldErrors({ priceAmount: t.priceInvalid });
      return;
    }
    const costMinor = cost.trim() ? majorToMinor(cost) : null;
    if (costMinor !== null && (!Number.isFinite(costMinor) || costMinor < 0)) {
      setFieldErrors({ costAmount: t.costInvalid });
      return;
    }
    const compareMinor = compareAt.trim() ? majorToMinor(compareAt) : null;
    if (compareMinor !== null && (!Number.isFinite(compareMinor) || compareMinor < 0)) {
      setFieldErrors({ compareAtAmount: t.compareAtInvalid });
      return;
    }
    const weightGrams = kgInputToGrams(weight);
    if (weightGrams !== null && Number.isNaN(weightGrams)) {
      setFieldErrors({ weightGrams: t.weightInvalid });
      return;
    }

    setSaving(true);
    try {
      if (isEdit && variant) {
        const payload: UpdateVariantPayload = {
          sku: sku.trim() || null,
          priceAmount: priceMinor,
          costAmount: costMinor,
          compareAtAmount: compareMinor,
          weightGrams,
          allowOverselling,
          status,
          ...{ imageUrl: imageUrl || null },
        };
        await apiClient.updateVariant(workspaceId, variant.id, payload);
      } else {
        const stockValue = Number(stock);
        const payload: CreateVariantPayload = {
          sku: sku.trim() || null,
          priceAmount: priceMinor,
          costAmount: costMinor,
          compareAtAmount: compareMinor,
          optionValues: parseOptionValues(options),
          weightGrams,
          allowOverselling,
          ...{ imageUrl: imageUrl || null },
          stockOnHand: Number.isFinite(stockValue) && stockValue > 0 ? Math.floor(stockValue) : 0,
        };
        await apiClient.createVariant(workspaceId, productId, payload);
      }
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      if (isApiErrorCode(err, "DUPLICATE_RESOURCE")) fields.sku = t.skuTaken;
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const savedOptions = isEdit ? optionPairs(stringifyOptionValues(variant?.optionValues)) : [];

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      {/* What the variant is comes first: adding, it is typed as chips; after that it is only read. */}
      {!isEdit && <OptionChipsInput label={t.options} value={options} onChange={setOptions} error={fieldErrors.optionValues} disabled={saving} />}
      {isEdit && savedOptions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">{t.optionsLine}</p>
          <ul className="flex flex-wrap gap-2">
            {savedOptions.map(([name, value]) => (
              <li key={name} className="zimos-option-chip inline-flex h-9 max-w-full items-center rounded-full bg-primary-soft px-3 text-sm font-medium text-primary-dark dark:text-primary">
                <bdi className="min-w-0 truncate">
                  {name}: {value}
                </bdi>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-5 text-ink-soft">{t.optionsLocked}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyInput label={t.price} required value={price} onChange={setPrice} error={fieldErrors.priceAmount} currency={currency} />
        <MoneyInput
          label={t.compareAt}
          value={compareAt}
          onChange={setCompareAt}
          error={fieldErrors.compareAtAmount}
          hint={t.compareAtHint}
          currency={currency}
        />
      </div>

      {!isEdit && tracked && (
        <TextField
          label={t.stock}
          type="number"
          inputMode="numeric"
          min={0}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          error={fieldErrors.stockOnHand}
          hint={t.stockHint}
        />
      )}

      {isEdit && (
        <p className="rounded-[0.875rem] bg-paper-sunken px-3 py-2.5 text-sm leading-6 text-ink-soft">
          {fmt(t.stockLine, { onHand: variant?.stockOnHand ?? 0 })}
          {variant?.reservedStock ? fmt(t.reserved, { reserved: variant.reservedStock }) : ""}
          {t.managedInInventory}
        </p>
      )}

      <TextField
        label={t.sku}
        dir="ltr"
        value={sku}
        onChange={(e) => setSku(e.target.value)}
        error={fieldErrors.sku}
        placeholder="TSHIRT-M"
      />
      {skuNote}

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyInput label={t.cost} value={cost} onChange={setCost} error={fieldErrors.costAmount} hint={t.optional} currency={currency} />
        <WeightInput label={t.weight} unit={t.weightUnit} value={weight} onChange={setWeight} error={fieldErrors.weightGrams} hint={t.weightHint} />
      </div>

      <ImageField label={t.image} hint={t.imageHint} value={imageUrl} onChange={setImageUrl} />

      {isEdit && (
        <div className="space-y-1.5">
          <p aria-hidden className="text-sm font-medium text-ink">
            {t.status}
          </p>
          <Segmented
            label={t.status}
            value={status}
            onChange={setStatus}
            options={[
              { value: "active", label: labels.status("active") },
              { value: "archived", label: labels.status("archived") },
            ]}
          />
          {fieldErrors.status && <p className="text-xs font-medium text-danger">{fieldErrors.status}</p>}
        </div>
      )}

      {tracked && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
          <input
            type="checkbox"
            className="size-5 shrink-0 cursor-pointer accent-primary"
            checked={allowOverselling}
            onChange={(e) => setAllowOverselling(e.target.checked)}
          />
          {t.allowOverselling}
        </label>
      )}

      {!hideActions && (
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? t.saving : isEdit ? t.save : t.add}
          </Button>
        </div>
      )}
    </form>
  );
}
