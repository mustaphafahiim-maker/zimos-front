import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import type { CreateVariantPayload, UpdateVariantPayload, Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { majorToMinor, minorToMajorInput, formatOptions } from "@/lib/format";
import { TextField, Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { fmt, useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    price: "Price",
    cost: "Cost",
    optional: "Optional.",
    compareAt: "Compare-at price",
    compareAtHint: "Optional — shown struck-through on the storefront.",
    initialStock: "Initial stock",
    initialStockHint: "Set once here. Later changes go through Inventory.",
    optionValues: "Option values",
    optionValuesHint: "e.g. Size=M, Color=Red",
    stockSummary: "Stock: {onHand} on hand — managed in Inventory.",
    stockSummaryReserved: "Stock: {onHand} on hand, {reserved} reserved — managed in Inventory.",
    options: "Options:",
    allowOverselling: "Allow overselling (accept orders past available stock)",
    saveVariant: "Save variant",
    addVariant: "Add variant",
    errPrice: "Enter a valid price (0 or more).",
    errCost: "Enter a valid cost, or leave it blank.",
    errCompareAt: "Enter a valid amount, or leave it blank.",
  },
  ar: {
    price: "السعر",
    cost: "التكلفة",
    optional: "اختياري.",
    compareAt: "السعر قبل الخصم",
    compareAtHint: "اختياري — يظهر مشطوبًا في المتجر.",
    initialStock: "المخزون المبدئي",
    initialStockHint: "يُحدَّد مرة واحدة هنا. أي تعديل لاحق يتم من صفحة المخزون.",
    optionValues: "قيم الخيارات",
    optionValuesHint: "مثال: Size=M, Color=Red",
    stockSummary: "المخزون: {onHand} متاح — تتم إدارته من صفحة المخزون.",
    stockSummaryReserved: "المخزون: {onHand} متاح، و{reserved} محجوز — تتم إدارته من صفحة المخزون.",
    options: "الخيارات:",
    allowOverselling: "السماح بالبيع بدون مخزون (قبول طلبات تتجاوز المخزون المتاح)",
    saveVariant: "حفظ المتغيّر",
    addVariant: "إضافة متغيّر",
    errPrice: "أدخل سعرًا صحيحًا (0 أو أكثر).",
    errCost: "أدخل تكلفة صحيحة، أو اتركها فارغة.",
    errCompareAt: "أدخل مبلغًا صحيحًا، أو اتركه فارغًا.",
  },
} satisfies Messages;

const VARIANT_STATUS_LABELS: Record<Locale, Record<"active" | "archived", string>> = {
  en: { active: "Active", archived: "Archived" },
  ar: { active: "نشط", archived: "مؤرشف" },
};

interface Props {
  productId: string;
  variant?: Variant;
  onDone: () => void;
  onCancel: () => void;
}

/** Parse "Size=M, Color=Red" -> { Size: "M", Color: "Red" }. */
function parseOptionValues(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of input.split(",")) {
    const [k, ...rest] = pair.split("=");
    const key = k?.trim();
    const value = rest.join("=").trim();
    if (key && value) out[key] = value;
  }
  return out;
}

function stringifyOptionValues(values: Record<string, string> | undefined): string {
  if (!values) return "";
  return Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}

export function VariantForm({ productId, variant, onDone, onCancel }: Props) {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const isEdit = Boolean(variant);

  const [sku, setSku] = useState(variant?.sku ?? "");
  const [price, setPrice] = useState(minorToMajorInput(variant?.priceAmount));
  const [cost, setCost] = useState(minorToMajorInput(variant?.costAmount));
  const [compareAt, setCompareAt] = useState(minorToMajorInput(variant?.compareAtAmount));
  const [stock, setStock] = useState("0");
  const [options, setOptions] = useState(stringifyOptionValues(variant?.optionValues));
  const [allowOverselling, setAllowOverselling] = useState(variant?.allowOverselling ?? false);
  const [status, setStatus] = useState<"active" | "archived">(variant?.status ?? "active");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const priceMinor = majorToMinor(price);
    if (!Number.isFinite(priceMinor) || priceMinor < 0) {
      setFieldErrors({ priceAmount: t.errPrice });
      return;
    }
    const costMinor = cost.trim() ? majorToMinor(cost) : null;
    if (costMinor !== null && (!Number.isFinite(costMinor) || costMinor < 0)) {
      setFieldErrors({ costAmount: t.errCost });
      return;
    }
    const compareMinor = compareAt.trim() ? majorToMinor(compareAt) : null;
    if (compareMinor !== null && (!Number.isFinite(compareMinor) || compareMinor < 0)) {
      setFieldErrors({ compareAtAmount: t.errCompareAt });
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
          allowOverselling,
          status,
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
          allowOverselling,
          stockOnHand: Number.isFinite(stockValue) && stockValue > 0 ? Math.floor(stockValue) : 0,
        };
        await apiClient.createVariant(workspaceId, productId, payload);
      }
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const optionsText = formatOptions(variant?.optionValues);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <TextField
        label="SKU"
        dir="ltr"
        value={sku}
        onChange={(e) => setSku(e.target.value)}
        error={fieldErrors.sku}
        placeholder="TSHIRT-M"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyInput
          label={t.price}
          required
          value={price}
          onChange={setPrice}
          error={fieldErrors.priceAmount}
          currency={variant?.currency ?? "EGP"}
        />
        <MoneyInput
          label={t.cost}
          value={cost}
          onChange={setCost}
          error={fieldErrors.costAmount}
          hint={t.optional}
          currency={variant?.currency ?? "EGP"}
        />
      </div>

      <MoneyInput
        label={t.compareAt}
        value={compareAt}
        onChange={setCompareAt}
        error={fieldErrors.compareAtAmount}
        hint={t.compareAtHint}
        currency={variant?.currency ?? "EGP"}
      />

      {!isEdit && (
        <>
          <TextField
            label={t.initialStock}
            type="number"
            dir="ltr"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            error={fieldErrors.stockOnHand}
            hint={t.initialStockHint}
          />
          <TextField
            label={t.optionValues}
            dir="ltr"
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            error={fieldErrors.optionValues}
            hint={t.optionValuesHint}
          />
        </>
      )}

      {isEdit && (
        <>
          <div className="rounded-xl border border-line bg-zimos-ice px-3 py-2 text-sm text-ink-soft">
            {variant?.reservedStock
              ? fmt(t.stockSummaryReserved, { onHand: variant.stockOnHand, reserved: variant.reservedStock })
              : fmt(t.stockSummary, { onHand: variant?.stockOnHand ?? 0 })}
            {optionsText && (
              <div className="mt-0.5">
                {t.options} <bdi>{optionsText}</bdi>
              </div>
            )}
          </div>
          <Field label={c.status} error={fieldErrors.status}>
            {({ id }) => (
              <Select
                id={id}
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "archived")}
              >
                <option value="active">{VARIANT_STATUS_LABELS[locale].active}</option>
                <option value="archived">{VARIANT_STATUS_LABELS[locale].archived}</option>
              </Select>
            )}
          </Field>
        </>
      )}

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={allowOverselling}
          onChange={(e) => setAllowOverselling(e.target.checked)}
        />
        {t.allowOverselling}
      </label>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? c.saving : isEdit ? t.saveVariant : t.addVariant}
        </Button>
      </div>
    </form>
  );
}
