import { useState, type FormEvent } from "react";
import { Alert, Button, Card, CardContent } from "@store-builder/ui";
import type {
  CreateProductPayload,
  Product,
  ProductMedia,
  ProductStatus,
  ProductType,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { useToast } from "@/components/Toast";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import { fmt, useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";
import { ProductImagesSection } from "./ProductImagesSection";

const STATUSES: ProductStatus[] = ["draft", "active", "archived"];
const TYPES: ProductType[] = ["physical", "digital", "service"];

const STATUS_LABELS: Record<Locale, Record<ProductStatus, string>> = {
  en: { draft: "Draft", active: "Active", archived: "Archived" },
  ar: { draft: "مسودة", active: "نشط", archived: "مؤرشف" },
};

const TYPE_LABELS: Record<Locale, Record<ProductType, string>> = {
  en: { physical: "Physical", digital: "Digital", service: "Service" },
  ar: { physical: "منتج ملموس", digital: "منتج رقمي", service: "خدمة" },
};

const STRINGS = {
  en: {
    basics: "Basics",
    name: "Name",
    namePlaceholder: "T-Shirt",
    description: "Description",
    descriptionPlaceholder: "Soft cotton tee…",
    type: "Type",
    tags: "Tags",
    tagsHint: "Comma-separated.",
    tagsPlaceholder: "apparel, summer",
    errName: "Enter a product name.",
    errDescription: "Add a description.",
    errImage: "Add at least one product image.",
    createdToast: "\"{name}\" created.",
    savedToast: "Product details saved.",
    uploadingImages: "Uploading images…",
    createProduct: "Create product",
    saveBasics: "Save basics",
  },
  ar: {
    basics: "المعلومات الأساسية",
    name: "الاسم",
    namePlaceholder: "تيشيرت",
    description: "الوصف",
    descriptionPlaceholder: "تيشيرت قطن ناعم…",
    type: "النوع",
    tags: "الوسوم",
    tagsHint: "افصل بينها بفاصلة (,).",
    tagsPlaceholder: "ملابس, صيفي",
    errName: "أدخل اسم المنتج.",
    errDescription: "أضف وصفًا للمنتج.",
    errImage: "أضف صورة واحدة على الأقل للمنتج.",
    createdToast: "تم إنشاء \"{name}\".",
    savedToast: "تم حفظ بيانات المنتج.",
    uploadingImages: "جارٍ رفع الصور…",
    createProduct: "إنشاء المنتج",
    saveBasics: "حفظ المعلومات الأساسية",
  },
} satisfies Messages;

interface Props {
  mode: "create" | "edit";
  product?: Product;
  onCreated?: (product: Product) => void;
  onSaved?: () => void;
}

export function ProductDetailsForm({ mode, product, onCreated, onSaved }: Props) {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const isCreate = mode === "create";

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "draft");
  const [productType, setProductType] = useState<ProductType>(product?.productType ?? "physical");
  const [tags, setTags] = useState((product?.tags ?? []).join(", "));
  // New-product flow: images are collected here and sent in the create payload.
  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [imagesUploading, setImagesUploading] = useState(0);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [mediaError, setMediaError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Client-side required-field checks. For a new product: name, description
    // and at least one image. For edits: just name.
    const errs: Record<string, string> = {};
    if (name.trim() === "") errs.name = t.errName;
    if (isCreate && description.trim() === "") errs.description = t.errDescription;
    const missingImage = isCreate && media.length === 0;

    if (Object.keys(errs).length > 0 || missingImage) {
      setFieldErrors(errs);
      setMediaError(missingImage ? t.errImage : null);
      setFormError(null);
      return;
    }

    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    setMediaError(null);

    const payload: CreateProductPayload = {
      name: name.trim(),
      description: description.trim(),
      status,
      productType,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      ...(isCreate ? { media } : {}),
    };

    try {
      if (isCreate) {
        const created = await apiClient.createProduct(workspaceId, payload);
        toast.success(fmt(t.createdToast, { name: created.name }));
        onCreated?.(created);
      } else if (product) {
        await apiClient.updateProduct(workspaceId, product.id, payload);
        toast.success(t.savedToast);
        onSaved?.();
      }
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
      else setFormError(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="rounded-2xl">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-ink">{t.basics}</h2>
            {formError && <Alert variant="danger">{formError}</Alert>}

            <TextField
              label={t.name}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
              placeholder={t.namePlaceholder}
            />

            <Field label={t.description} required={isCreate} error={fieldErrors.description}>
              {({ id }) => (
                <Textarea
                  id={id}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.descriptionPlaceholder}
                />
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={c.status} error={fieldErrors.status}>
                {({ id }) => (
                  <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[locale][s]}
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
                        {TYPE_LABELS[locale][type]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>

            <TextField
              label={t.tags}
              hint={t.tagsHint}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              error={fieldErrors.tags}
              placeholder={t.tagsPlaceholder}
            />
          </div>
        </CardContent>
      </Card>

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
            ? c.saving
            : imagesUploading > 0
              ? t.uploadingImages
              : isCreate
                ? t.createProduct
                : t.saveBasics}
        </Button>
      </div>
    </form>
  );
}
