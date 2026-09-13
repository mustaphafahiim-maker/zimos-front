import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { CheckCircle2, ImagePlus, Loader2, Plus } from "lucide-react";
import { Alert, Button, Textarea, cn } from "@store-builder/ui";
import type { ProductMedia } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { fmt, useT } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Field, TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { majorToMinor } from "@/lib/format";
import type { StepProps } from "./state";
import { STRINGS } from "./strings";

export function StepProduct({ state, next, update, setSaving, saving, formId }: StepProps) {
  const t = useT(STRINGS);
  const { workspaces } = useWorkspace();
  const workspaceId = state.workspaceId!;
  const currency =
    state.basics?.currency ?? workspaces.find((w) => w.id === workspaceId)?.defaultCurrency ?? "EGP";

  const saved = state.product?.variantId ? state.product : null;
  const [showForm, setShowForm] = useState(!saved);

  const [name, setName] = useState(state.product && !saved ? state.product.name : "");
  const [price, setPrice] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [stock, setStock] = useState("10");
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState<ProductMedia | null>(state.product && !saved ? state.product.media ?? null : null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErrors((prev) => ({ ...prev, image: "" }));
    setUploading(true);
    try {
      setMedia(await apiClient.uploadMedia(workspaceId, file));
    } catch (err) {
      setErrors((prev) => ({ ...prev, image: getErrorMessage(err, t.uploadError) }));
    } finally {
      setUploading(false);
    }
  }

  function resetForm() {
    setName("");
    setPrice("");
    setCompareAt("");
    setStock("10");
    setDescription("");
    setMedia(null);
    setErrors({});
    setFormError(null);
    update({ product: undefined });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving || uploading) return;
    if (!showForm) {
      next();
      return;
    }
    setErrors({});
    setFormError(null);

    const priceMinor = majorToMinor(price);
    const compareMinor = compareAt.trim() ? majorToMinor(compareAt) : null;
    const stockNum = Number(stock);
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t.requiredField;
    if (!Number.isFinite(priceMinor) || priceMinor < 0) errs.price = t.priceInvalid;
    if (compareMinor !== null && (!Number.isFinite(compareMinor) || compareMinor <= priceMinor)) errs.compareAt = t.compareInvalid;
    if (stock.trim() === "" || !Number.isInteger(stockNum) || stockNum < 0) errs.stock = t.stockInvalid;
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    let stage: "product" | "variant" = "product";
    try {
      // Resume: a product created on an earlier attempt whose variant failed.
      let product = state.product && !state.product.variantId ? state.product : undefined;
      if (!product) {
        const created = await apiClient.createProduct(workspaceId, {
          name: name.trim(),
          description: description.trim(),
          productType: "physical",
          status: "active",
          media: media ? [media] : [],
        });
        product = { id: created.id, name: created.name, media };
        update({ product });
      }
      stage = "variant";
      const variant = await apiClient.createVariant(workspaceId, product.id, {
        priceAmount: priceMinor,
        compareAtAmount: compareMinor,
        currency,
        stockOnHand: stockNum,
      });
      next({ product: { ...product, variantId: variant.id, priceMinor } });
    } catch (err) {
      const fe = getFieldErrors(err);
      const mapped: Record<string, string> = {};
      if (stage === "product") {
        if (fe.name) mapped.name = fe.name;
        if (fe.description) mapped.description = fe.description;
      } else {
        if (fe.priceAmount) mapped.price = fe.priceAmount;
        if (fe.compareAtAmount) mapped.compareAt = fe.compareAtAmount;
        if (fe.stockOnHand) mapped.stock = fe.stockOnHand;
      }
      if (Object.keys(mapped).length) setErrors(mapped);
      else setFormError(getErrorMessage(err, t.productError));
    } finally {
      setSaving(false);
    }
  }

  if (!showForm && saved) {
    return (
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-paper-raised p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-ink">{fmt(t.productSaved, { name: saved.name })}</p>
        </div>
        <Button type="button" variant="outline" onClick={resetForm}>
          <Plus className="size-4" aria-hidden />
          {t.addAnother}
        </Button>
      </form>
    );
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <TextField
        label={t.productName}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.productNamePlaceholder}
        error={errors.name}
        maxLength={300}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <MoneyInput label={t.price} required currency={currency} value={price} onChange={setPrice} error={errors.price} />
        <MoneyInput
          label={t.compareAt}
          currency={currency}
          value={compareAt}
          onChange={setCompareAt}
          error={errors.compareAt}
          hint={t.compareHint}
        />
        <TextField
          label={t.stock}
          required
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          error={errors.stock}
          className="tabular"
        />
      </div>

      <Field label={t.image} hint={t.imageHint} error={errors.image || undefined}>
        {({ id }) => (
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-line bg-paper",
                uploading && "animate-pulse"
              )}
            >
              {uploading ? (
                <Loader2 className="size-5 animate-spin text-ink-muted" aria-hidden />
              ) : media ? (
                <img src={media.url} alt="" className="size-full object-cover" />
              ) : (
                <ImagePlus className="size-6 text-ink-muted" aria-hidden />
              )}
            </span>
            <input
              id={id}
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="sr-only"
              onChange={handleFile}
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? t.uploading : media ? t.replaceImage : t.chooseImage}
            </Button>
            {media && !uploading && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setMedia(null)}>
                {t.removeImage}
              </Button>
            )}
          </div>
        )}
      </Field>

      <Field label={t.description} error={errors.description}>
        {({ id, ...aria }) => (
          <Textarea
            id={id}
            {...aria}
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              // Enter submits the step; Shift+Enter adds a line break.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
        )}
      </Field>
    </form>
  );
}
