import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Card, CardContent, Input, Label } from "@store-builder/ui";
import { CUSTOM_FIELD_LIMITS, type CustomField, type CustomFieldType } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

/**
 * The fields a shopper fills in when ordering this product — a name to
 * engrave, a message for the card, their own photo to print. At most five,
 * shown on the storefront's product page in this order; the answers travel
 * with the order (and photos are shown on the order page through short-lived
 * links). Saved whole as the product's `customFields`.
 */

const TYPES: CustomFieldType[] = ["text", "textarea", "image"];

const STRINGS = {
  en: {
    title: "Custom fields",
    description:
      "Ask the customer for details when they order this product — a name to engrave, a message, or their own photo. Up to five, shown on the product page in this order.",
    empty: "No custom fields. Customers order this product as it is.",
    field: "Field {n}",
    type: "Type",
    type_text: "Short text",
    type_textarea: "Long text",
    type_image: "Photo",
    labelAr: "Label in Arabic",
    labelEn: "Label in English",
    placeholderAr: "Hint in Arabic (optional)",
    placeholderEn: "Hint in English (optional)",
    required: "Required",
    maxLength: "Maximum characters",
    maxLengthHint: "Up to {max}.",
    imageHint: "JPEG, PNG or WebP. The customer's photo is resized and stripped of its location data.",
    add: "Add a field",
    limit: "A product can have up to five custom fields.",
    moveUp: "Move field {n} up",
    moveDown: "Move field {n} down",
    remove: "Remove field {n}",
    labelMissing: "Give field {n} a label in Arabic or English.",
    save: "Save custom fields",
    saving: "Saving…",
    discard: "Discard changes",
    saved: "Custom fields saved.",
  },
  ar: {
    title: "حقول مخصصة",
    description:
      "اطلب من العميل بيانات عند طلب هذا المنتج — اسمًا للنقش، أو رسالة، أو صورته الخاصة. حتى خمسة حقول، تظهر في صفحة المنتج بهذا الترتيب.",
    empty: "لا توجد حقول مخصصة. يطلب العملاء هذا المنتج كما هو.",
    field: "الحقل {n}",
    type: "النوع",
    type_text: "نص قصير",
    type_textarea: "نص طويل",
    type_image: "صورة",
    labelAr: "العنوان بالعربية",
    labelEn: "العنوان بالإنجليزية",
    placeholderAr: "نص إرشادي بالعربية (اختياري)",
    placeholderEn: "نص إرشادي بالإنجليزية (اختياري)",
    required: "مطلوب",
    maxLength: "الحد الأقصى للأحرف",
    maxLengthHint: "حتى {max}.",
    imageHint: "JPEG أو PNG أو WebP. تُصغَّر صورة العميل وتُحذف منها بيانات الموقع.",
    add: "إضافة حقل",
    limit: "يمكن أن يكون للمنتج خمسة حقول مخصصة كحد أقصى.",
    moveUp: "تحريك الحقل {n} لأعلى",
    moveDown: "تحريك الحقل {n} لأسفل",
    remove: "حذف الحقل {n}",
    labelMissing: "أضف عنوانًا للحقل {n} بالعربية أو الإنجليزية.",
    save: "حفظ الحقول المخصصة",
    saving: "جارٍ الحفظ…",
    discard: "تجاهل التغييرات",
    saved: "تم حفظ الحقول المخصصة.",
  },
} satisfies Messages;

/** A new field's id: stable (answers are stored under it) and unique within the product. */
function newFieldId(fields: CustomField[]): string {
  let n = fields.length + 1;
  const taken = new Set(fields.map((f) => f.id));
  while (taken.has(`field-${n}`)) n += 1;
  return `field-${n}`;
}

/** The field as it is saved: empty hints dropped, length only where it applies. */
function clean(field: CustomField): CustomField {
  const label = { ar: (field.label.ar ?? "").trim(), en: (field.label.en ?? "").trim() };
  const placeholder = { ar: (field.placeholder?.ar ?? "").trim(), en: (field.placeholder?.en ?? "").trim() };
  const out: CustomField = { id: field.id, type: field.type, label, required: Boolean(field.required) };
  if (field.type !== "image") {
    if (placeholder.ar || placeholder.en) out.placeholder = placeholder;
    if (field.maxLength) out.maxLength = field.maxLength;
  }
  return out;
}

export function CustomFieldsSection({
  productId,
  fields: saved,
  onChanged,
}: {
  productId: string;
  fields: CustomField[];
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [fields, setFields] = useState<CustomField[]>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(fields.map(clean)) !== JSON.stringify(saved.map(clean));
  const full = fields.length >= CUSTOM_FIELD_LIMITS.maxFields;

  const update = (index: number, patch: Partial<CustomField>) =>
    setFields((current) => current.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  const move = (index: number, to: number) =>
    setFields((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(to, 0, row);
      return next;
    });

  async function save() {
    const unlabeled = fields.findIndex((f) => !(f.label.ar ?? "").trim() && !(f.label.en ?? "").trim());
    if (unlabeled >= 0) {
      setError(fmt(t.labelMissing, { n: unlabeled + 1 }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiClient.updateProduct(workspaceId, productId, { customFields: fields.map(clean) });
      toast.success(t.saved);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
        </div>

        {fields.length === 0 && <p className="text-sm text-ink-soft">{t.empty}</p>}

        <ol className="space-y-3">
          {fields.map((field, index) => (
            <FieldEditor
              key={field.id}
              field={field}
              index={index}
              count={fields.length}
              disabled={busy}
              onChange={(patch) => update(index, patch)}
              onMove={(to) => move(index, to)}
              onRemove={() => setFields((current) => current.filter((_, i) => i !== index))}
            />
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy || full}
            onClick={() =>
              setFields((current) => [
                ...current,
                { id: newFieldId(current), type: "text", label: { ar: "", en: "" }, required: false },
              ])
            }
          >
            <Plus className="size-4" aria-hidden />
            {t.add}
          </Button>
          {full && <p className="text-xs text-ink-soft">{t.limit}</p>}
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        {dirty && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => {
                setFields(saved);
                setError(null);
              }}
            >
              {t.discard}
            </Button>
            <Button type="button" className="min-h-11" disabled={busy} onClick={() => void save()}>
              {busy ? t.saving : t.save}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const iconButton =
  "inline-flex size-11 cursor-pointer items-center justify-center rounded-[0.5rem] text-ink-soft transition-colors hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40";

function FieldEditor({
  field,
  index,
  count,
  disabled,
  onChange,
  onMove,
  onRemove,
}: {
  field: CustomField;
  index: number;
  count: number;
  disabled: boolean;
  onChange: (patch: Partial<CustomField>) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const t = useT(STRINGS);
  const id = useId();
  const n = index + 1;
  const limits = field.type === "image" ? null : CUSTOM_FIELD_LIMITS[field.type];

  return (
    <li className="rounded-[0.5rem] border border-line">
      <fieldset disabled={disabled} className="space-y-3 p-4">
        <legend className="sr-only">{fmt(t.field, { n })}</legend>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink" aria-hidden>
            {fmt(t.field, { n })}
          </p>
          <div className="flex items-center">
            <button type="button" className={iconButton} aria-label={fmt(t.moveUp, { n })} disabled={index === 0} onClick={() => onMove(index - 1)}>
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button type="button" className={iconButton} aria-label={fmt(t.moveDown, { n })} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
              <ArrowDown className="size-4" aria-hidden />
            </button>
            <button type="button" className={`${iconButton} hover:bg-danger-soft hover:text-danger`} aria-label={fmt(t.remove, { n })} onClick={onRemove}>
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-type`}>{t.type}</Label>
            <Select
              id={`${id}-type`}
              value={field.type}
              className="h-11"
              onChange={(e) => {
                const type = e.target.value as CustomFieldType;
                onChange({ type, ...(type === "image" ? { maxLength: undefined, placeholder: undefined } : {}) });
              }}
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {t[`type_${type}`]}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end text-sm text-ink">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={Boolean(field.required)}
              onChange={(e) => onChange({ required: e.target.checked })}
            />
            {t.required}
          </label>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-label-ar`}>{t.labelAr}</Label>
            <Input
              id={`${id}-label-ar`}
              dir="rtl"
              maxLength={100}
              value={field.label.ar ?? ""}
              onChange={(e) => onChange({ label: { ...field.label, ar: e.target.value } })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-label-en`}>{t.labelEn}</Label>
            <Input
              id={`${id}-label-en`}
              dir="ltr"
              maxLength={100}
              value={field.label.en ?? ""}
              onChange={(e) => onChange({ label: { ...field.label, en: e.target.value } })}
            />
          </div>
          {limits ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-ph-ar`}>{t.placeholderAr}</Label>
                <Input
                  id={`${id}-ph-ar`}
                  dir="rtl"
                  maxLength={150}
                  value={field.placeholder?.ar ?? ""}
                  onChange={(e) => onChange({ placeholder: { ...field.placeholder, ar: e.target.value } })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-ph-en`}>{t.placeholderEn}</Label>
                <Input
                  id={`${id}-ph-en`}
                  dir="ltr"
                  maxLength={150}
                  value={field.placeholder?.en ?? ""}
                  onChange={(e) => onChange({ placeholder: { ...field.placeholder, en: e.target.value } })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-max`}>{t.maxLength}</Label>
                <Input
                  id={`${id}-max`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={limits.max}
                  placeholder={String(limits.default)}
                  value={field.maxLength ?? ""}
                  aria-describedby={`${id}-max-hint`}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    onChange({ maxLength: Number.isFinite(value) ? Math.min(limits.max, Math.max(1, value)) : undefined });
                  }}
                />
                <p id={`${id}-max-hint`} className="text-xs text-ink-soft">
                  {fmt(t.maxLengthHint, { max: limits.max })}
                </p>
              </div>
            </>
          ) : (
            <p className="text-xs text-ink-soft sm:col-span-2">{t.imageHint}</p>
          )}
        </div>
      </fieldset>
    </li>
  );
}
