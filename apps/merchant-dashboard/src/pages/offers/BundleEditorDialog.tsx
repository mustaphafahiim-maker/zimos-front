import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import {
  BUNDLE_DISCOUNT_TYPES,
  BUNDLE_DISPLAY_STYLES,
  BUNDLE_MAX_TIERS,
  bundlesCreate,
  bundleIsMixAndMatch,
  bundlesPreview,
  bundlesUpdate,
  type BundleDiscountType,
  type BundleDisplayStyle,
  type BundleDto,
  type BundlePreviewTier,
  type BundleTierInput,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { MixAndMatchToggle } from "./MixAndMatchParts";

/**
 * Creating or editing a quantity bundle (SPEC §10.1): the name, a starting
 * template, the tiers, and beside them a live preview of what each tier costs
 * for a sample unit price — priced by the server, the same way an order is.
 */

const STRINGS = {
  en: {
    createTitle: "New bundle",
    editTitle: "Edit bundle",
    description: "Customers pay less per piece when they buy more. One bundle can be used on many products.",
    name: "Bundle name",
    namePlaceholder: "Buy more, save more",
    display: "Shown in the store as",
    display_cards: "Cards",
    display_radio: "List",
    display_dropdown: "Dropdown",
    active: "Active",
    templates: "Start from a template",
    template_percentage: "Percentage discount",
    template_fixed: "Fixed price",
    template_bxgy: "Buy X get Y",
    template_custom: "Custom",
    tiers: "Tiers",
    tier: "Tier {n}",
    quantity: "Quantity",
    type: "Discount",
    type_percentage: "Percent off",
    type_fixed_price: "Fixed price for the tier",
    type_fixed_amount_off: "Amount off the tier",
    type_buy_x_get_y: "Free pieces",
    value: "Value",
    title: "Title in the store",
    titlePlaceholder: "Buy 2 and save 5%",
    label: "Highlight",
    labelPlaceholder: "Best seller",
    freeShipping: "Free shipping",
    isDefault: "Selected by default",
    remove: "Remove tier {n}",
    addTier: "Add tier",
    preview: "Live preview",
    previewPrice: "Sample piece price",
    previewQty: "Pieces",
    previewTotal: "Customer pays",
    previewEach: "Per piece",
    previewSave: "Saves",
    previewFree: "Free shipping",
    previewFailed: "Fix the tiers to see the preview.",
    nameRequired: "Enter a name for the bundle.",
    valueInvalid: "Tier {n}: enter a valid value.",
    cancel: "Cancel",
    save: "Save bundle",
    saving: "Saving…",
    created: "Bundle created.",
    saved: "Bundle saved.",
  },
  ar: {
    createTitle: "باقة جديدة",
    editTitle: "تعديل الباقة",
    description: "العميل يدفع أقل للقطعة كلما اشترى أكثر. الباقة الواحدة تُستخدم على منتجات كثيرة.",
    name: "اسم الباقة",
    namePlaceholder: "اشترِ أكثر ووفّر أكثر",
    display: "شكلها في المتجر",
    display_cards: "بطاقات",
    display_radio: "قائمة",
    display_dropdown: "قائمة منسدلة",
    active: "مفعّلة",
    templates: "ابدأ من قالب",
    template_percentage: "خصم بنسبة",
    template_fixed: "سعر ثابت",
    template_bxgy: "اشترِ X واحصل على Y",
    template_custom: "مخصص",
    tiers: "الشرائح",
    tier: "شريحة {n}",
    quantity: "الكمية",
    type: "الخصم",
    type_percentage: "نسبة خصم",
    type_fixed_price: "سعر ثابت للشريحة",
    type_fixed_amount_off: "مبلغ خصم على الشريحة",
    type_buy_x_get_y: "قطع مجانية",
    value: "القيمة",
    title: "العنوان في المتجر",
    titlePlaceholder: "اشترِ 2 ووفّر 5%",
    label: "تمييز",
    labelPlaceholder: "الأكثر مبيعًا",
    freeShipping: "شحن مجاني",
    isDefault: "محددة افتراضيًا",
    remove: "حذف شريحة {n}",
    addTier: "إضافة شريحة",
    preview: "معاينة حية",
    previewPrice: "سعر تجريبي للقطعة",
    previewQty: "القطع",
    previewTotal: "يدفع العميل",
    previewEach: "للقطعة",
    previewSave: "يوفّر",
    previewFree: "شحن مجاني",
    previewFailed: "صحّح الشرائح لعرض المعاينة.",
    nameRequired: "اكتب اسمًا للباقة.",
    valueInvalid: "شريحة {n}: اكتب قيمة صحيحة.",
    cancel: "إلغاء",
    save: "حفظ الباقة",
    saving: "بنحفظ…",
    created: "تم إنشاء الباقة.",
    saved: "تم حفظ الباقة.",
  },
} satisfies Messages;

/** A tier as the form holds it: the value as typed (percent, money in major units, or pieces). */
interface TierDraft {
  quantity: string;
  discountType: BundleDiscountType;
  value: string;
  title: string;
  label: string;
  freeShipping: boolean;
  isDefault: boolean;
}

type Template = "percentage" | "fixed" | "bxgy" | "custom";

const blank = (quantity: number, discountType: BundleDiscountType = "percentage", value = "0"): TierDraft => ({
  quantity: String(quantity),
  discountType,
  value,
  title: "",
  label: "",
  freeShipping: false,
  isDefault: false,
});

const TEMPLATES: Record<Template, () => TierDraft[]> = {
  percentage: () => [
    { ...blank(1, "percentage", "0"), isDefault: true },
    blank(2, "percentage", "5"),
    blank(3, "percentage", "10"),
    blank(4, "percentage", "15"),
  ],
  fixed: () => [{ ...blank(1, "percentage", "0"), isDefault: true }, blank(2, "fixed_price", ""), blank(3, "fixed_price", "")],
  bxgy: () => [{ ...blank(1, "percentage", "0"), isDefault: true }, blank(3, "buy_x_get_y", "1")],
  custom: () => [{ ...blank(1, "percentage", "0"), isDefault: true }],
};

function draftOf(tier: BundleTierInput): TierDraft {
  const value =
    tier.discountType === "percentage"
      ? String(tier.discountValue / 100)
      : tier.discountType === "buy_x_get_y"
        ? String(tier.discountValue)
        : minorToMajorInput(tier.discountValue);
  return {
    quantity: String(tier.quantity),
    discountType: tier.discountType,
    value,
    title: tier.title ?? "",
    label: tier.label ?? "",
    freeShipping: Boolean(tier.freeShipping),
    isDefault: Boolean(tier.isDefault),
  };
}

/** The API shape of a draft tier, or null when a number in it cannot be read. */
function toInput(tier: TierDraft): BundleTierInput | null {
  const quantity = Number(tier.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return null;
  let discountValue: number;
  if (tier.discountType === "percentage") {
    const pct = Number(tier.value || "0");
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
    discountValue = Math.round(pct * 100);
  } else if (tier.discountType === "buy_x_get_y") {
    discountValue = Number(tier.value);
    if (!Number.isInteger(discountValue) || discountValue < 0 || discountValue >= quantity) return null;
  } else {
    discountValue = majorToMinor(tier.value);
    if (!Number.isFinite(discountValue) || discountValue < 0) return null;
  }
  return {
    quantity,
    discountType: tier.discountType,
    discountValue,
    title: tier.title.trim() || null,
    label: tier.label.trim() || null,
    freeShipping: tier.freeShipping,
    isDefault: tier.isDefault,
  };
}

export function BundleEditorDialog({
  bundle,
  onClose,
  onSaved,
}: {
  bundle?: BundleDto;
  onClose: () => void;
  onSaved: (bundle: BundleDto) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState(bundle?.name ?? "");
  const [displayStyle, setDisplayStyle] = useState<BundleDisplayStyle>(bundle?.displayStyle ?? "cards");
  const [isActive, setIsActive] = useState(bundle?.isActive ?? true);
  // All its products priced together, "any 3 of these" (handoff 215).
  const [mixAndMatch, setMixAndMatch] = useState(() => bundleIsMixAndMatch(bundle));
  const [tiers, setTiers] = useState<TierDraft[]>(() => (bundle ? bundle.tiers.map(draftOf) : TEMPLATES.percentage()));
  const [samplePrice, setSamplePrice] = useState("250");
  const [preview, setPreview] = useState<BundlePreviewTier[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputs = tiers.map(toInput);
  const valid = inputs.every((tier): tier is BundleTierInput => tier !== null);
  const previewKey = valid ? JSON.stringify([inputs, samplePrice]) : "";

  // The live preview: the server prices the draft's tiers for the sample price.
  useEffect(() => {
    if (!previewKey) {
      setPreview(null);
      return;
    }
    const unit = majorToMinor(samplePrice);
    if (!Number.isFinite(unit) || unit < 0) {
      setPreview(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      bundlesPreview(apiClient, workspaceId, JSON.parse(previewKey)[0] as BundleTierInput[], unit, controller.signal)
        .then(setPreview)
        .catch(() => {
          if (!controller.signal.aborted) setPreview(null);
        });
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [previewKey, samplePrice, workspaceId]);

  const patch = (index: number, change: Partial<TierDraft>) =>
    setTiers((current) => current.map((tier, i) => (i === index ? { ...tier, ...change } : tier)));

  async function save() {
    if (!name.trim()) {
      setError(t.nameRequired);
      return;
    }
    const bad = inputs.findIndex((tier) => tier === null);
    if (bad >= 0) {
      setError(fmt(t.valueInvalid, { n: bad + 1 }));
      return;
    }
    setBusy(true);
    setError(null);
    const payload = { name: name.trim(), displayStyle, isActive, mixAndMatch, tiers: inputs as BundleTierInput[] };
    try {
      const saved = bundle
        ? await bundlesUpdate(apiClient, workspaceId, bundle.id, payload)
        : await bundlesCreate(apiClient, workspaceId, payload);
      toast.success(bundle ? t.saved : t.created);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={bundle ? t.editTitle : t.createTitle}
      description={t.description}
      className="max-w-5xl"
      footer={
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bundle-name">{t.name}</Label>
              <Input
                id="bundle-name"
                maxLength={200}
                placeholder={t.namePlaceholder}
                value={name}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bundle-display">{t.display}</Label>
              <Select
                id="bundle-display"
                value={displayStyle}
                disabled={busy}
                onChange={(e) => setDisplayStyle(e.target.value as BundleDisplayStyle)}
              >
                {BUNDLE_DISPLAY_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {t[`display_${style}`]}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end text-sm text-ink">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={isActive}
                disabled={busy}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              {t.active}
            </label>
            <MixAndMatchToggle checked={mixAndMatch} onChange={setMixAndMatch} disabled={busy} />
          </div>

          {!bundle && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink">{t.templates}</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TEMPLATES) as Template[]).map((template) => (
                  <Button
                    key={template}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setTiers(TEMPLATES[template]())}
                  >
                    {t[`template_${template}`]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">{t.tiers}</p>
            {tiers.map((tier, index) => (
              <fieldset
                key={index}
                disabled={busy}
                className={`space-y-3 rounded-[0.5rem] border p-3 ${inputs[index] === null ? "border-danger" : "border-line"}`}
              >
                <legend className="sr-only">{fmt(t.tier, { n: index + 1 })}</legend>
                <div className="grid items-end gap-2 sm:grid-cols-[5rem_1fr_7rem_auto]">
                  <div className="space-y-1">
                    <Label htmlFor={`tier-q-${index}`}>{t.quantity}</Label>
                    <Input
                      id={`tier-q-${index}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      dir="ltr"
                      value={tier.quantity}
                      onChange={(e) => patch(index, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`tier-t-${index}`}>{t.type}</Label>
                    <Select
                      id={`tier-t-${index}`}
                      value={tier.discountType}
                      onChange={(e) => patch(index, { discountType: e.target.value as BundleDiscountType, value: "" })}
                    >
                      {BUNDLE_DISCOUNT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t[`type_${type}`]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`tier-v-${index}`}>{t.value}</Label>
                    <Input
                      id={`tier-v-${index}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={tier.discountType === "buy_x_get_y" ? 1 : "0.01"}
                      dir="ltr"
                      value={tier.value}
                      onChange={(e) => patch(index, { value: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={fmt(t.remove, { n: index + 1 })}
                    disabled={tiers.length <= 1}
                    onClick={() => setTiers((current) => current.filter((_, i) => i !== index))}
                    className="inline-flex size-10 cursor-pointer items-center justify-center rounded-[0.5rem] text-ink-soft hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    aria-label={t.title}
                    placeholder={t.titlePlaceholder}
                    maxLength={200}
                    value={tier.title}
                    onChange={(e) => patch(index, { title: e.target.value })}
                  />
                  <Input
                    aria-label={t.label}
                    placeholder={t.labelPlaceholder}
                    maxLength={100}
                    value={tier.label}
                    onChange={(e) => patch(index, { label: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={tier.freeShipping}
                      onChange={(e) => patch(index, { freeShipping: e.target.checked })}
                    />
                    {t.freeShipping}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="bundle-default-tier"
                      className="size-4 accent-primary"
                      checked={tier.isDefault}
                      onChange={() => setTiers((current) => current.map((x, i) => ({ ...x, isDefault: i === index })))}
                    />
                    {t.isDefault}
                  </label>
                </div>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              disabled={busy || tiers.length >= BUNDLE_MAX_TIERS}
              onClick={() =>
                setTiers((current) => [
                  ...current,
                  blank(Math.max(0, ...current.map((x) => Number(x.quantity) || 0)) + 1, "percentage", "0"),
                ])
              }
            >
              <Plus className="size-4" aria-hidden />
              {t.addTier}
            </Button>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}
        </div>

        <aside className="space-y-3 rounded-[0.5rem] bg-paper p-4 lg:self-start">
          <p className="text-sm font-semibold text-ink">{t.preview}</p>
          <div className="space-y-1">
            <Label htmlFor="bundle-sample">{t.previewPrice}</Label>
            <Input
              id="bundle-sample"
              type="number"
              inputMode="decimal"
              min={0}
              dir="ltr"
              value={samplePrice}
              onChange={(e) => setSamplePrice(e.target.value)}
            />
          </div>
          {preview ? (
            <ul className="space-y-2">
              {preview.map((row) => (
                <li key={row.quantity} className="rounded-[0.5rem] border border-line bg-paper-raised p-3 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink">
                      {row.quantity} × {t.previewQty}
                    </span>
                    <span className="font-bold text-ink">{formatMoney(row.total)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-xs text-ink-soft">
                    <span>
                      {t.previewEach}: {formatMoney(row.perUnit)}
                    </span>
                    {row.discount > 0 && (
                      <span className="text-success">
                        {t.previewSave} {formatMoney(row.discount)}
                      </span>
                    )}
                  </div>
                  {row.freeShipping && <p className="mt-1 text-xs font-medium text-primary">{t.previewFree}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-soft">{t.previewFailed}</p>
          )}
        </aside>
      </div>
    </Modal>
  );
}
