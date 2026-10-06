import { useState, type FormEvent } from "react";
import { Alert, Button, Card, CardContent } from "@store-builder/ui";
import {
  isApiErrorCode,
  type CreateProductPayload,
  type Product,
  type ProductMedia,
  type ProductShippingMode,
  type ProductStatus,
  type ProductType,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { majorToMinor, minorToMajorInput } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { Field, TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { WeightInput } from "@/components/WeightInput";
import { kgInputToGrams } from "@/lib/weight";
import { RichDescriptionField } from "./RichDescriptionField";
import { Select } from "@/components/Select";
import { useCatalogLabels } from "../catalogLabels";
import { ProductImagesSection } from "./ProductImagesSection";
import { AiDescriptionButton } from "./AiDescriptionButton";
import { TrackQuantityField } from "./TrackQuantityField";

const STATUSES: ProductStatus[] = ["draft", "active", "archived"];
const TYPES: ProductType[] = ["physical", "digital", "service"];
const SHIPPING_MODES: ProductShippingMode[] = ["standard", "free", "extra_fee"];

const STRINGS = {
  en: {
    basics: "Basics",
    name: "Name",
    namePlaceholder: "Product name",
    description: "Description",
    descriptionPlaceholder: "Describe your product: material, size, what's included",
    status: "Status",
    type: "Type",
    tags: "Tags",
    tagsHint: "Comma-separated.",
    tagsPlaceholder: "apparel, summer",
    pricing: "Price and stock",
    pricingHint: "The product's first variant. Add sizes, colours and more variants after it's created.",
    price: "Price",
    compareAt: "Compare-at price",
    compareAtHint: "Optional — shown struck-through on the storefront.",
    sku: "SKU",
    skuHint: "Optional.",
    skuPlaceholder: "TSHIRT-01",
    stock: "Initial stock",
    stockHint: "Set once here. Later changes go through Inventory.",
    allowOverselling: "Allow overselling (accept orders past available stock)",
    nameRequired: "Enter a product name.",
    descriptionRequired: "Add a description.",
    imageRequired: "Add at least one product image.",
    priceInvalid: "Enter a valid price (0 or more).",
    compareAtInvalid: "Enter a valid amount, or leave it blank.",
    stockInvalid: "Enter a whole number, 0 or more.",
    weight: "Weight",
    weightUnit: "kg",
    weightHint: "Used for shipping price and the courier's package. Leave blank if unknown.",
    weightInvalid: "Enter a weight between 0 and 1000 kg, or leave it blank.",
    skuTaken: "That SKU is already used by another variant.",
    saving: "Saving…",
    uploading: "Uploading images…",
    create: "Create product",
    saveBasics: "Save basics",
    createdToast: "“{name}” created.",
    savedToast: "Product details saved.",
    shippingMode: "Shipping",
    mode_standard: "Store's shipping prices",
    mode_free: "Free shipping",
    mode_extra_fee: "Store's price plus an extra fee",
    shippingModeHint:
      "An order ships free when every product in it ships free. Mixed with other products, the store's price applies.",
    extraFee: "Extra shipping fee per unit",
    extraFeeHint: "Added to the store's shipping price for every unit of this product in the order.",
    extraFeeInvalid: "Enter an amount greater than 0.",
  },
  ar: {
    basics: "البيانات الأساسية",
    name: "الاسم",
    namePlaceholder: "اسم المنتج",
    description: "الوصف",
    descriptionPlaceholder: "صف منتجك: الخامة، المقاس، محتويات العلبة",
    status: "الحالة",
    type: "النوع",
    tags: "الوسوم",
    tagsHint: "افصل بينها بفاصلة.",
    tagsPlaceholder: "ملابس، صيفي",
    pricing: "السعر والمخزون",
    pricingHint: "أول متغير للمنتج. أضف المقاسات والألوان والمتغيرات الأخرى بعد إنشائه.",
    price: "السعر",
    compareAt: "السعر قبل الخصم",
    compareAtHint: "اختياري — يظهر مشطوبًا في المتجر.",
    sku: "SKU",
    skuHint: "اختياري.",
    skuPlaceholder: "TSHIRT-01",
    stock: "المخزون المبدئي",
    stockHint: "يُحدد مرة واحدة هنا. أي تغيير لاحق يتم من المخزون.",
    allowOverselling: "السماح بالبيع بعد نفاد المخزون (قبول أوردرات تتجاوز المتاح)",
    nameRequired: "أدخل اسم المنتج.",
    descriptionRequired: "أضف وصفًا.",
    imageRequired: "أضف صورة واحدة على الأقل للمنتج.",
    priceInvalid: "أدخل سعرًا صحيحًا (صفر أو أكثر).",
    compareAtInvalid: "أدخل مبلغًا صحيحًا، أو اتركه فارغًا.",
    stockInvalid: "أدخل رقمًا صحيحًا، صفر أو أكثر.",
    weight: "الوزن",
    weightUnit: "كجم",
    weightHint: "يُستخدم لحساب سعر الشحن ونوع الشحنة عند شركة الشحن. اتركه فارغًا لو غير معروف.",
    weightInvalid: "أدخل وزنًا بين 0 و1000 كجم، أو اتركه فارغًا.",
    skuTaken: "رمز SKU هذا مستخدم لمتغير آخر.",
    saving: "جارٍ الحفظ…",
    uploading: "جارٍ رفع الصور…",
    create: "إنشاء المنتج",
    saveBasics: "حفظ البيانات الأساسية",
    createdToast: "تم إنشاء “{name}”.",
    savedToast: "تم حفظ بيانات المنتج.",
    shippingMode: "الشحن",
    mode_standard: "أسعار الشحن في المتجر",
    mode_free: "شحن مجاني",
    mode_extra_fee: "سعر المتجر مع رسوم إضافية",
    shippingModeHint:
      "يُشحن الطلب مجانًا عندما تكون كل منتجاته مجانية الشحن. وإذا ضم منتجات أخرى يُحتسب سعر الشحن في المتجر.",
    extraFee: "رسوم شحن إضافية لكل قطعة",
    extraFeeHint: "تُضاف إلى سعر الشحن في المتجر عن كل قطعة من هذا المنتج في الطلب.",
    extraFeeInvalid: "أدخل مبلغًا أكبر من 0.",
  },
} satisfies Messages;

/** Server field paths for the create payload's `variant` → this form's fields. */
const VARIANT_FIELD: Record<string, string> = {
  "variant.priceAmount": "price",
  "variant.compareAtAmount": "compareAt",
  "variant.sku": "sku",
  "variant.stockOnHand": "stock",
  "variant.weightGrams": "weight",
};

interface Props {
  mode: "create" | "edit";
  product?: Product;
  onCreated?: (product: Product) => void;
  onSaved?: () => void;
}

export function ProductDetailsForm({ mode, product, onCreated, onSaved }: Props) {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const isCreate = mode === "create";
  // Prices are entered in the store's own currency (the backend prices a new variant in it).
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "draft");
  const [productType, setProductType] = useState<ProductType>(product?.productType ?? "physical");
  const [tags, setTags] = useState((product?.tags ?? []).join(", "));
  const [shippingMode, setShippingMode] = useState<ProductShippingMode>(product?.shippingMode ?? "standard");
  const [extraFee, setExtraFee] = useState(minorToMajorInput(product?.shippingExtraAmount ?? null));
  // New-product flow: images and the first variant are collected here and
  // sent in the one create payload. Edit mode manages variants in VariantsSection.
  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [imagesUploading, setImagesUploading] = useState(0);
  const [price, setPrice] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [sku, setSku] = useState("");
  const [stock, setStock] = useState("0");
  const [weight, setWeight] = useState("");
  const [allowOverselling, setAllowOverselling] = useState(false);
  // "Track quantity" (backend catalog/stockTracking.js); physical products only.
  const [trackInventory, setTrackInventory] = useState((product as { trackInventory?: boolean } | undefined)?.trackInventory !== false);
  const tracked = productType !== "physical" || trackInventory;

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [mediaError, setMediaError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    // Client-side required-field checks. For a new product: name, description,
    // at least one image and a price. For edits: just name.
    const errs: Record<string, string> = {};
    if (name.trim() === "") errs.name = t.nameRequired;
    if (isCreate && description.trim() === "") errs.description = t.descriptionRequired;
    const missingImage = isCreate && media.length === 0;

    const priceMinor = majorToMinor(price);
    const compareMinor = compareAt.trim() ? majorToMinor(compareAt) : null;
    const stockValue = stock.trim() === "" ? 0 : Number(stock);
    if (isCreate) {
      if (!Number.isFinite(priceMinor) || priceMinor < 0) errs.price = t.priceInvalid;
      if (compareMinor !== null && (!Number.isFinite(compareMinor) || compareMinor < 0))
        errs.compareAt = t.compareAtInvalid;
      if (!Number.isInteger(stockValue) || stockValue < 0) errs.stock = t.stockInvalid;
      if (Number.isNaN(kgInputToGrams(weight))) errs.weight = t.weightInvalid;
    }
    const weightGrams = kgInputToGrams(weight);
    const extraFeeMinor = shippingMode === "extra_fee" ? majorToMinor(extraFee) : null;
    if (extraFeeMinor !== null && (!Number.isFinite(extraFeeMinor) || extraFeeMinor < 1)) {
      errs.shippingExtraAmount = t.extraFeeInvalid;
    }

    if (Object.keys(errs).length > 0 || missingImage) {
      setFieldErrors(errs);
      setMediaError(missingImage ? t.imageRequired : null);
      setFormError(null);
      return;
    }

    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    setMediaError(null);

    const basics = {
      name: name.trim(),
      description: description.trim(),
      status,
      productType,
      tags: tags
        .split(/[,،]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      // The fee goes with "extra_fee" only; any other mode clears it server-side.
      shippingMode,
      shippingExtraAmount: extraFeeMinor,
      ...(productType === "physical" ? { trackInventory } : {}),
    };

    try {
      if (isCreate) {
        const payload: CreateProductPayload = {
          ...basics,
          media,
          variant: {
            priceAmount: priceMinor,
            ...(compareMinor !== null ? { compareAtAmount: compareMinor } : {}),
            ...(sku.trim() ? { sku: sku.trim() } : {}),
            stockOnHand: tracked ? stockValue : 0,
            ...(weightGrams !== null && productType === "physical" ? { weightGrams } : {}),
            allowOverselling: tracked ? allowOverselling : true,
          },
        };
        const created = await apiClient.createProduct(workspaceId, payload);
        toast.success(fmt(t.createdToast, { name: created.product.name }));
        onCreated?.(created.product);
      } else if (product) {
        await apiClient.updateProduct(workspaceId, product.id, basics);
        toast.success(t.savedToast);
        onSaved?.();
      }
    } catch (err) {
      const fields: Record<string, string> = {};
      for (const [field, message] of Object.entries(getFieldErrors(err))) {
        fields[VARIANT_FIELD[field] ?? field] = message;
      }
      if (isApiErrorCode(err, "DUPLICATE_RESOURCE")) fields.sku = t.skuTaken;
      setFieldErrors(fields);
      setFormError(Object.keys(fields).length === 0 ? errorMessage(err) : null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <h2 className="font-display text-lg font-medium text-ink">{t.basics}</h2>
            {formError && <Alert variant="danger">{formError}</Alert>}

            <TextField
              label={t.name}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
              placeholder={t.namePlaceholder}
            />

            <Field
              label={t.description}
              required={isCreate}
              error={fieldErrors.description}
            >
              {({ id }) => (
                <RichDescriptionField id={id} value={description} onChange={setDescription} placeholder={t.descriptionPlaceholder} />
              )}
            </Field>
            <AiDescriptionButton name={name} onWritten={(output) => setDescription(output.description)} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.status} error={fieldErrors.status}>
                {({ id }) => (
                  <Select
                    id={id}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProductStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {labels.status(s)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label={t.type} error={fieldErrors.productType}>
                {({ id }) => (
                  <Select
                    id={id}
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as ProductType)}
                  >
                    {TYPES.map((type) => (
                      <option key={type} value={type}>
                        {labels.type(type)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            {productType === "physical" && <TrackQuantityField value={trackInventory} onChange={setTrackInventory} disabled={saving} />}

            <TextField
              label={t.tags}
              hint={t.tagsHint}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              error={fieldErrors.tags}
              placeholder={t.tagsPlaceholder}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.shippingMode} hint={t.shippingModeHint} error={fieldErrors.shippingMode}>
                {({ id, ...aria }) => (
                  <Select
                    id={id}
                    {...aria}
                    value={shippingMode}
                    onChange={(e) => setShippingMode(e.target.value as ProductShippingMode)}
                  >
                    {SHIPPING_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {t[`mode_${mode}`]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {shippingMode === "extra_fee" && (
                <MoneyInput
                  currency={currency}
                  label={t.extraFee}
                  required
                  value={extraFee}
                  onChange={setExtraFee}
                  error={fieldErrors.shippingExtraAmount}
                  hint={t.extraFeeHint}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {isCreate && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-medium text-ink">{t.pricing}</h2>
                <p className="text-sm text-ink-soft">{t.pricingHint}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyInput
                  currency={currency}
                  label={t.price}
                  required
                  value={price}
                  onChange={setPrice}
                  error={fieldErrors.price}
                />
                <MoneyInput
                  currency={currency}
                  label={t.compareAt}
                  value={compareAt}
                  onChange={setCompareAt}
                  error={fieldErrors.compareAt}
                  hint={t.compareAtHint}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label={t.sku}
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  error={fieldErrors.sku}
                  hint={t.skuHint}
                  placeholder={t.skuPlaceholder}
                />
                {tracked && (
                  <TextField
                    label={t.stock}
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    error={fieldErrors.stock}
                    hint={t.stockHint}
                  />
                )}
              </div>

              {productType === "physical" && (
                <WeightInput
                  label={t.weight}
                  unit={t.weightUnit}
                  value={weight}
                  onChange={setWeight}
                  error={fieldErrors.weight}
                  hint={t.weightHint}
                  className="sm:max-w-[calc(50%-0.5rem)]"
                />
              )}

              {tracked && (
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={allowOverselling}
                    onChange={(e) => setAllowOverselling(e.target.checked)}
                  />
                  {t.allowOverselling}
                </label>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isCreate && (
        <ProductImagesSection
          mode="create"
          value={media}
          onChange={setMedia}
          error={mediaError ?? undefined}
          onUploadingChange={setImagesUploading}
        />
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={saving || imagesUploading > 0}>
          {saving
            ? t.saving
            : imagesUploading > 0
              ? t.uploading
              : isCreate
                ? t.create
                : t.saveBasics}
        </Button>
      </div>
    </form>
  );
}
