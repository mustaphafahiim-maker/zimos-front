import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import { stockCountStart, type StockCount, type StockLocation } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { getFieldErrors } from "@/lib/errors";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { PURCHASING_STRINGS } from "./purchasingStrings";
import { useCatalogVariants } from "./useCatalogVariants";

type Scope = "all" | "product";

/**
 * «ابدأ جرد» / Start a count (POST /purchasing/stock-counts): where — the
 * whole store or one location — and what — every product or one. The count
 * keeps what is on hand now as "expected"; the counting happens on its page.
 */
export function StartCountDialog({
  open,
  locations,
  onClose,
  onStarted,
}: {
  open: boolean;
  locations: StockLocation[];
  onClose: () => void;
  onStarted: (count: StockCount) => void;
}) {
  const t = useT(PURCHASING_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const productFieldId = useId();
  const [locationId, setLocationId] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [productId, setProductId] = useState("");
  const [note, setNote] = useState("");
  const [productError, setProductError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLocationId("");
    setScope("all");
    setProductId("");
    setNote("");
    setProductError(null);
    setFailure(null);
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (scope === "product" && !productId) {
      setProductError(t.productError);
      document.getElementById(productFieldId)?.focus();
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      onStarted(
        await stockCountStart(apiClient, workspaceId, {
          locationId: locationId || null,
          ...(scope === "product" ? { productId } : {}),
          note: note.trim() || null,
        })
      );
    } catch (err) {
      // A store (or a product) without variants: the API says so on `variantIds`.
      setFailure(getFieldErrors(err).variantIds ? t.nothingToCount : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.startTitle}
      description={t.startDescription}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={saving}>
            {saving ? t.starting : t.startSubmit}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        {locations.length > 0 && (
          <Field label={t.countLocation}>
            {(props) => (
              <Select {...props} className="h-11" value={locationId} disabled={saving} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">{t.wholeStore}</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.isDefault ? fmt(t.defaultLocation, { name: l.name }) : l.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">{t.countScope}</p>
          <Segmented<Scope>
            label={t.countScope}
            value={scope}
            onChange={(next) => {
              setScope(next);
              setProductError(null);
            }}
            options={[
              { value: "all", label: t.scopeAll },
              { value: "product", label: t.scopeProduct },
            ]}
            className="w-full"
          />
          {scope === "all" && <p className="text-xs text-ink-soft">{t.scopeLimit}</p>}
        </div>

        {scope === "product" && (
          <ProductField
            fieldId={productFieldId}
            value={productId}
            error={productError}
            disabled={saving}
            onChange={(next) => {
              setProductId(next);
              setProductError(null);
            }}
          />
        )}

        <Field label={t.countNote}>
          {(props) => (
            <Input {...props} dir="auto" autoComplete="off" maxLength={300} value={note} disabled={saving} onChange={(e) => setNote(e.target.value)} className="h-11" />
          )}
        </Field>

        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}

/** The product to count. Its own component, so the catalog is read only once "One product" is chosen. */
function ProductField({
  fieldId,
  value,
  error,
  disabled,
  onChange,
}: {
  fieldId: string;
  value: string;
  error: string | null;
  disabled: boolean;
  onChange: (productId: string) => void;
}) {
  const t = useT(PURCHASING_STRINGS);
  const workspaceId = useWorkspaceId();
  const catalog = useCatalogVariants(workspaceId);
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-ink">
        {t.countProduct}
      </label>
      {catalog.searchable && (
        <Input
          type="search"
          dir="auto"
          autoComplete="off"
          maxLength={100}
          aria-label={t.productSearch}
          placeholder={t.productSearch}
          value={catalog.query}
          onChange={(e) => catalog.setQuery(e.target.value)}
          className="h-11"
        />
      )}
      <Select
        id={fieldId}
        className="h-11"
        value={value}
        disabled={disabled || catalog.loading}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{catalog.loading ? t.productsLoading : t.chooseProduct}</option>
        {catalog.products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : catalog.failed && <p className="text-xs text-danger">{t.productsFailed}</p>}
    </div>
  );
}
