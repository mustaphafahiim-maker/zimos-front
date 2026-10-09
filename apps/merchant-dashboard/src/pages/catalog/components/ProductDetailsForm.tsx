import { useEffect, useRef, useState, type FormEvent } from "react";
import { IconArchive, IconSliders } from "@/components/icons";
import { Alert, Button, cn } from "@store-builder/ui";
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
import { SaveBar } from "@/components/SaveBar";
import { AccordionSection } from "@/components/Accordion";
import { useReportDirty } from "@/lib/useUnsavedGuard";
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
import { ProductPageCard } from "./ProductPageCard";
import { SwitchTrack } from "../variants/SwitchTrack";
import { SectionSaveBar } from "../product/saveQueue";
import type { ProductStatusControl } from "../product/productStatus";

const STATUSES: ProductStatus[] = ["draft", "active", "archived"];
const TYPES: ProductType[] = ["physical", "digital", "service"];
const SHIPPING_MODES: ProductShippingMode[] = ["standard", "free", "extra_fee"];

const STRINGS = {
  en: {
    basics: "Basics",
    basicsHint: "The name and the words shoppers read, and how the product ships.",
    archive: "Archive the product",
    archiveHint: "It leaves the store and the list. You can bring it back at any time.",
    archived: "This product is archived. Choose Active or Draft above to bring it back.",
    essentials: "The essentials",
    moreDetails: "More details (optional)",
    moreDetailsHint: "Description, type, SKU, weight, tags and shipping",
    publish: "Show it in the store now",
    publishOn: "Shoppers can see and order it as soon as you save.",
    publishOff: "Saved as a draft: nobody sees it until you show it.",
    publishSoldOut: "It will show in the store as sold out, because the quantity is 0. Type the quantity you have above.",
    soldOutNote: "Quantity is 0: the store will show it as sold out",
    unsavedBasics: "Basics not saved yet",
    unsavedNew: "This product isn't saved yet",
    stockZero: "Left at 0, the store shows it as sold out.",
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
    stock: "Quantity you have",
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
    create: "Save product",
    saveBasics: "Save basics",
    createdToast: "«{name}» created.",
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
    basics: "الأساسيات",
    basicsHint: "الاسم والكلام اللي العميل بيقراه، وطريقة شحن المنتج.",
    archive: "أرشف المنتج",
    archiveHint: "بيختفي من المتجر ومن القايمة، وتقدر ترجّعه في أي وقت.",
    archived: "المنتج ده مؤرشف. اختار «شغّال» أو «مسودة» فوق عشان ترجّعه.",
    essentials: "الأساسي",
    moreDetails: "تفاصيل تانية (اختياري)",
    moreDetailsHint: "الوصف، النوع، الـ SKU، الوزن، التاجات والشحن",
    publish: "اعرضه في المتجر على طول",
    publishOn: "العملاء هيشوفوه ويطلبوه أول ما تحفظ.",
    publishOff: "هيتحفظ مسودة: محدش هيشوفه لحد ما تعرضه.",
    publishSoldOut: "هيتعرض في المتجر بس هيظهر إنه خلص، عشان الكمية صفر. اكتب الكمية اللي عندك فوق.",
    soldOutNote: "الكمية صفر: المنتج هيظهر في المتجر إنه خلص",
    unsavedBasics: "البيانات الأساسية لسه ما اتحفظتش",
    unsavedNew: "المنتج لسه ما اتحفظش",
    stockZero: "لو سبتها صفر، المنتج هيظهر في المتجر إنه خلص.",
    name: "الاسم",
    namePlaceholder: "اسم المنتج",
    description: "الوصف",
    descriptionPlaceholder: "اوصف منتجك: الخامة، المقاس، اللي جوه العلبة",
    status: "الحالة",
    type: "النوع",
    tags: "التاجات",
    tagsHint: "افصل بينها بفاصلة.",
    tagsPlaceholder: "ملابس، صيفي",
    pricing: "السعر والمخزون",
    pricingHint: "ده أول نوع للمنتج. المقاسات والألوان والأنواع التانية تضيفها بعد ما تحفظ.",
    price: "السعر",
    compareAt: "السعر قبل الخصم",
    compareAtHint: "اختياري — بيظهر متشطّب في المتجر.",
    sku: "SKU",
    skuHint: "اختياري.",
    skuPlaceholder: "TSHIRT-01",
    stock: "الكمية اللي عندك",
    stockHint: "بتتحدد هنا مرة واحدة، وبعد كده بتتعدّل من المخزون.",
    allowOverselling: "اقبل أوردرات حتى لو الكمية خلصت",
    nameRequired: "اكتب اسم المنتج.",
    descriptionRequired: "ضيف وصف.",
    imageRequired: "ضيف صورة واحدة على الأقل للمنتج.",
    priceInvalid: "اكتب سعر صحيح (صفر أو أكتر).",
    compareAtInvalid: "اكتب مبلغ صحيح، أو سيبه فاضي.",
    stockInvalid: "اكتب رقم صحيح، صفر أو أكتر.",
    weight: "الوزن",
    weightUnit: "كجم",
    weightHint: "بيتحسب بيه سعر الشحن ونوع الشحنة عند شركة الشحن. سيبه فاضي لو مش عارفه.",
    weightInvalid: "اكتب وزن بين 0 و1000 كجم، أو سيبه فاضي.",
    skuTaken: "الـ SKU ده مستخدم لنوع تاني.",
    saving: "بنحفظ…",
    uploading: "بنرفع الصور…",
    create: "احفظ المنتج",
    saveBasics: "احفظ البيانات الأساسية",
    createdToast: "اتضاف «{name}».",
    savedToast: "اتحفظت بيانات المنتج.",
    shippingMode: "الشحن",
    mode_standard: "أسعار الشحن بتاعة المتجر",
    mode_free: "شحن مجاني",
    mode_extra_fee: "سعر المتجر + رسوم زيادة",
    shippingModeHint:
      "الأوردر بيتشحن مجانًا لما كل منتجاته شحنها مجاني. لو معاه منتجات تانية، بيتحسب سعر الشحن العادي.",
    extraFee: "رسوم شحن زيادة لكل قطعة",
    extraFeeHint: "بتتضاف على سعر الشحن عن كل قطعة من المنتج ده في الأوردر.",
    extraFeeInvalid: "اكتب مبلغ أكبر من 0.",
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

/** Fields that sit in the folded "more details" part of the new-product form. */
const MORE_FIELDS = new Set(["description", "productType", "tags", "shippingMode", "shippingExtraAmount", "sku", "weight"]);

interface Props {
  mode: "create" | "edit";
  product?: Product;
  onCreated?: (product: Product) => void;
  onSaved?: () => void;
  /**
   * Edit mode: the status is changed in place by the page (the «شغّال / مسودة» switch, with Undo).
   * The form then has no status field of its own and sends the status the page shows.
   */
  statusControl?: ProductStatusControl;
}

export function ProductDetailsForm({ mode, product, onCreated, onSaved, statusControl }: Props) {
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
  // A new product goes on sale when saved (the setup guide promises name + price + quantity +
  // photo is enough); a visible switch keeps "save as draft" one tap away (audit N-04).
  const initialStatus: ProductStatus = product?.status ?? (mode === "create" ? "active" : "draft");
  const [ownStatus, setStatus] = useState<ProductStatus>(initialStatus);
  const status = statusControl?.status ?? ownStatus;
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
  const formRef = useRef<HTMLFormElement>(null);
  // New product: the optional fields are folded; an error in one of them opens the fold.
  const [moreOpen, setMoreOpen] = useState(false);
  const openMoreFor = (errors: Record<string, string>) => {
    if (isCreate && Object.keys(errors).some((key) => MORE_FIELDS.has(key))) setMoreOpen(true);
  };

  /**
   * After a failed save, bring the first problem into view and focus it: on a
   * phone the field in error is usually off screen above the Save button.
   */
  function revealFirstError() {
    requestAnimationFrame(() => {
      const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]');
      if (!first) return;
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof first.focus === "function") first.focus({ preventScroll: true });
    });
  }

  // Leaving with typed but unsaved basics asks first (tab close / reload), and the save bar shows.
  // Everything the basics save sends is compared; a fee typed under another shipping mode is not sent.
  const basicsNow = JSON.stringify([
    name,
    description,
    // Changed in place by the page when it is controlled: not an unsaved edit of this form.
    statusControl ? "" : status,
    tags,
    productType,
    tracked,
    shippingMode,
    shippingMode === "extra_fee" ? extraFee : "",
  ]);
  const initialBasics = useRef(basicsNow);
  const dirty = basicsNow !== initialBasics.current || (isCreate && (price !== "" || media.length > 0));
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // The new-product form tells the page's leave guard itself; the edit form does it through its save bar.
  useReportDirty(isCreate && dirty && !saving);
  // What "discard" puts back: the basics as they were last saved.
  const savedBasics = useRef({ name, description, productType, tags, shippingMode, extraFee, trackInventory });
  function discard() {
    const was = savedBasics.current;
    setName(was.name);
    setDescription(was.description);
    setProductType(was.productType);
    setTags(was.tags);
    setShippingMode(was.shippingMode);
    setExtraFee(was.extraFee);
    setTrackInventory(was.trackInventory);
    setFieldErrors({});
    setFormError(null);
  }
  const [mediaError, setMediaError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    // Client-side required-field checks. For a new product: name, at least one
    // image and a price ("a name, a price and a photo are enough to start" —
    // the description can come later; the API accepts it empty). For edits: just name.
    const errs: Record<string, string> = {};
    if (name.trim() === "") errs.name = t.nameRequired;
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
      openMoreFor(errs);
      setMediaError(missingImage ? t.imageRequired : null);
      setFormError(null);
      revealFirstError();
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
        initialBasics.current = basicsNow;
        savedBasics.current = { name, description, productType, tags, shippingMode, extraFee, trackInventory };
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
      openMoreFor(fields);
      setFormError(Object.keys(fields).length === 0 ? errorMessage(err) : null);
      revealFirstError();
    } finally {
      setSaving(false);
    }
  }

  const nameField = (
    <TextField
      label={t.name}
      required
      value={name}
      onChange={(e) => setName(e.target.value)}
      error={fieldErrors.name}
      placeholder={t.namePlaceholder}
    />
  );
  const descriptionFields = (
    <>
      <Field label={t.description} error={fieldErrors.description}>
        {({ id }) => <RichDescriptionField id={id} value={description} onChange={setDescription} placeholder={t.descriptionPlaceholder} />}
      </Field>
      <AiDescriptionButton name={name} onWritten={(output) => setDescription(output.description)} />
    </>
  );
  const typeField = (
    <Field label={t.type} error={fieldErrors.productType}>
      {({ id }) => (
        <Select id={id} value={productType} onChange={(e) => setProductType(e.target.value as ProductType)}>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {labels.type(type)}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
  const trackField =
    productType === "physical" ? <TrackQuantityField value={trackInventory} onChange={setTrackInventory} disabled={saving} /> : null;
  const tagsField = (
    <TextField
      label={t.tags}
      hint={t.tagsHint}
      value={tags}
      onChange={(e) => setTags(e.target.value)}
      error={fieldErrors.tags}
      placeholder={t.tagsPlaceholder}
    />
  );
  const shippingFields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t.shippingMode} hint={t.shippingModeHint} error={fieldErrors.shippingMode}>
        {({ id, ...aria }) => (
          <Select id={id} {...aria} value={shippingMode} onChange={(e) => setShippingMode(e.target.value as ProductShippingMode)}>
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
  );
  const submitLabel = saving ? t.saving : imagesUploading > 0 ? t.uploading : isCreate ? t.create : t.saveBasics;

  if (!isCreate) {
    return (
      <ProductPageCard title={t.basics} description={t.basicsHint}>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {formError && <Alert variant="danger">{formError}</Alert>}
          {nameField}
          {descriptionFields}
          <div className="grid gap-4 sm:grid-cols-2">
            {typeField}
            {!statusControl && (
              <Field label={t.status} error={fieldErrors.status}>
                {({ id }) => (
                  <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {labels.status(s)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
          </div>
          {trackField}
          {tagsField}
          {shippingFields}
          {/* Archiving is the third status: it stays here, one tap away, and can be undone from its toast. */}
          {statusControl &&
            (statusControl.status === "archived" ? (
              <p role="status" className="zimos-product-note rounded-[var(--radius)] bg-paper-sunken px-3.5 py-3 text-sm leading-6 text-ink-soft">
                {t.archived}
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line pt-3">
                <p className="min-w-0 flex-1 basis-56 text-[13px] leading-5 text-ink-soft">{t.archiveHint}</p>
                <Button type="button" variant="ghost" className="min-h-11 shrink-0 text-ink-soft hover:text-danger" onClick={() => statusControl.change("archived")}>
                  <IconArchive className="size-4" aria-hidden />
                  {t.archive}
                </Button>
              </div>
            ))}
          {/* The page's one save bar: it names the section and stays in reach wherever the page is scrolled. */}
          <SectionSaveBar
            section={t.basics}
            dirty={dirty}
            saving={saving}
            error={formError}
            onSave={() => formRef.current?.requestSubmit()}
            onDiscard={discard}
          />
        </form>
      </ProductPageCard>
    );
  }

  // New product: name → price → photo first (audit N-04), everything optional folded below.
  const stockValueNow = stock.trim() === "" ? 0 : Number(stock);
  // On sale with nothing to sell: the store would show it as sold out, so the screen must not promise orders.
  const soldOutOnPublish = status === "active" && tracked && stockValueNow === 0 && !allowOverselling;
  return (
    <form ref={formRef} onSubmit={handleSubmit} className="zimos-product-new flex flex-col gap-4 md:gap-5">
      {/* The page header already says a name, a price, a quantity and a photo are enough. */}
      <ProductPageCard title={t.essentials}>
        <div className="space-y-4">
          {formError && <Alert variant="danger">{formError}</Alert>}
          {nameField}
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyInput currency={currency} label={t.price} required value={price} onChange={setPrice} error={fieldErrors.price} />
            <MoneyInput
              currency={currency}
              label={t.compareAt}
              value={compareAt}
              onChange={setCompareAt}
              error={fieldErrors.compareAt}
              hint={t.compareAtHint}
            />
          </div>
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
              hint={stockValueNow === 0 ? t.stockZero : t.stockHint}
              className="sm:max-w-[calc(50%-0.5rem)]"
            />
          )}
        </div>
      </ProductPageCard>

      <ProductImagesSection
        mode="create"
        value={media}
        onChange={setMedia}
        error={mediaError ?? undefined}
        onUploadingChange={setImagesUploading}
      />

      {/* Still mounted while folded, so nothing typed is lost; an error inside opens it. */}
      <AccordionSection title={t.moreDetails} summary={t.moreDetailsHint} icon={IconSliders} open={moreOpen} onOpenChange={setMoreOpen} keepMounted>
        <div className="space-y-4 pt-1">
          {descriptionFields}
          <div className="grid gap-4 sm:grid-cols-2">{typeField}</div>
          {trackField}
          <p className="text-xs text-ink-soft">{t.pricingHint}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t.sku}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              error={fieldErrors.sku}
              hint={t.skuHint}
              placeholder={t.skuPlaceholder}
            />
            {productType === "physical" && (
              <WeightInput
                label={t.weight}
                unit={t.weightUnit}
                value={weight}
                onChange={setWeight}
                error={fieldErrors.weight}
                hint={t.weightHint}
              />
            )}
          </div>
          {tracked && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                className="size-5 shrink-0 accent-primary"
                checked={allowOverselling}
                onChange={(e) => setAllowOverselling(e.target.checked)}
              />
              {t.allowOverselling}
            </label>
          )}
          {tagsField}
          {shippingFields}
        </div>
      </AccordionSection>

      {/* The publish switch: a whole 56px row to press, the switch at its end. */}
      <label
        data-slot="card"
        className="zimos-product-publish relative flex min-h-14 cursor-pointer items-center gap-3 rounded-[var(--radius-card)] bg-card px-4 py-3 shadow-[var(--shadow-card)] ring-1 ring-line sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">{t.publish}</span>
          <span
            id="product-publish-hint"
            className={cn("block text-[13px] leading-5", soldOutOnPublish ? "font-medium text-accent-dark" : "text-ink-soft")}
          >
            {status !== "active" ? t.publishOff : soldOutOnPublish ? t.publishSoldOut : t.publishOn}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0"
          checked={status === "active"}
          onChange={(e) => setStatus(e.target.checked ? "active" : "draft")}
          aria-describedby="product-publish-hint"
        />
        <SwitchTrack
          on={status === "active"}
          className="peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-active:[&>span]:scale-[0.92]"
        />
      </label>

      {/* The bar is in reach from the first field, so it carries the sold-out warning the switch above also gives. */}
      {dirty ? (
        <SaveBar
          dirty={dirty}
          saving={saving}
          disabled={imagesUploading > 0}
          message={soldOutOnPublish ? <span className="text-accent-dark">{t.soldOutNote}</span> : t.unsavedNew}
          saveLabel={imagesUploading > 0 ? t.uploading : t.create}
          savingLabel={t.saving}
        />
      ) : (
        <div className="flex justify-end">
          <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={saving || imagesUploading > 0}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
