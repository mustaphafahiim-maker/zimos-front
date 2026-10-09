import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { IconDelete } from "@/components/icons";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  PRICE_SCHEDULE_LIMITS,
  apiFieldProblems,
  isApiErrorCode,
  priceScheduleCreate,
  priceScheduleUpdate,
  type PriceChangeMode,
  type PriceSchedule,
  type PriceScheduleInput,
  type PriceScheduleTargetType,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { minorToMajorInput } from "@/lib/format";
import { parseWholeNumber } from "@/lib/wholeNumber";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Field, TextField } from "@/components/Field";
import { FilterTabs } from "@/components/FilterTabs";
import { MoneyInput } from "@/components/MoneyInput";
import { SaveBar } from "@/components/SaveBar";
import { Section } from "@/components/Section";
import { Select } from "@/components/Select";
import { costToMinor, variantFullName } from "@/pages/inventory/inventoryText";
import { VariantCell } from "@/pages/inventory/InventoryParts";
import { VariantAddRow } from "@/pages/inventory/VariantAddRow";
import { useCatalogVariants } from "@/pages/inventory/useCatalogVariants";
import { ProductChecklist, useStoreProducts } from "@/pages/offers/OfferRuleParts";
import { PRICE_SCHEDULE_STRINGS } from "./priceScheduleStrings";
import { SalePreview } from "./SalePreview";
import { isoOfStoreInput, storeInputOf } from "./storeTime";

const TARGETS: readonly PriceScheduleTargetType[] = ["products", "variants", "collection"];
const MODES: readonly PriceChangeMode[] = ["percent_off", "amount_off", "set_price"];

interface Draft {
  name: string;
  targetType: PriceScheduleTargetType;
  productIds: string[];
  variantIds: string[];
  collectionId: string;
  mode: PriceChangeMode;
  /** The value as typed, kept per kind of discount so switching kinds never mixes a percent with money. */
  percent: string;
  amount: string;
  price: string;
  /** `datetime-local` text on the store's clock. */
  startsAt: string;
  endsAt: string;
  showWasPrice: boolean;
}

/** The next full hour on the store's clock: a start a merchant can accept as it is. */
function nextHour(zone: string | null): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return storeInputOf(new Date(now.getTime() + 3600_000).toISOString(), zone);
}

function draftOf(sale: PriceSchedule | null, zone: string | null, forProduct: string | null): Draft {
  const value = sale?.change.value;
  return {
    name: sale?.name ?? "",
    targetType: sale?.target.type ?? "products",
    productIds: sale?.target.type === "products" ? sale.target.ids : forProduct ? [forProduct] : [],
    variantIds: sale?.target.type === "variants" ? sale.target.ids : [],
    collectionId: sale?.target.type === "collection" ? (sale.target.ids[0] ?? "") : "",
    mode: sale?.change.mode ?? "percent_off",
    percent: sale?.change.mode === "percent_off" ? String(value) : "",
    amount: sale?.change.mode === "amount_off" ? minorToMajorInput(value) : "",
    price: sale?.change.mode === "set_price" ? minorToMajorInput(value) : "",
    startsAt: sale ? storeInputOf(sale.startsAt, zone) : nextHour(zone),
    endsAt: storeInputOf(sale?.endsAt, zone),
    showWasPrice: sale?.showWasPrice ?? true,
  };
}

/** The ids the sale is on, by its kind of target. */
function targetIds(draft: Draft): string[] {
  if (draft.targetType === "products") return draft.productIds;
  if (draft.targetType === "variants") return draft.variantIds;
  return draft.collectionId ? [draft.collectionId] : [];
}

/** The discount's value in the API's units; NaN when what is typed is not one. */
function changeValue(draft: Draft): number {
  if (draft.mode === "percent_off") {
    const n = parseWholeNumber(draft.percent, PRICE_SCHEDULE_LIMITS.percentMin, PRICE_SCHEDULE_LIMITS.percentMax);
    return n === null ? Number.NaN : n;
  }
  const minor = costToMinor(draft.mode === "amount_off" ? draft.amount : draft.price);
  return draft.mode === "amount_off" && minor === 0 ? Number.NaN : minor;
}

const fingerprint = (draft: Draft) =>
  JSON.stringify([draft.name.trim(), draft.targetType, targetIds(draft), draft.mode, draft.percent.trim(), draft.amount.trim(), draft.price.trim(), draft.startsAt, draft.endsAt, draft.showWasPrice]);

type Errors = Partial<Record<"name" | "target" | "value" | "startsAt" | "endsAt", string>>;

/**
 * A sale's form (POST / PUT /price-schedules): its name, what is on sale
 * (products, single variants, or one collection), the discount, the window on
 * the store's clock, and whether the old price shows crossed out. Under it,
 * the preview: every variant's price now and during the sale, from the server.
 * A new sale is saved with the button; a sale that has not started yet shows
 * the save bar once something changed.
 */
export function ScheduledSaleEditor({
  sale,
  forProduct,
  currency,
  zone,
  onSaved,
  onDirtyChange,
  onLocked,
}: {
  /** The scheduled sale being edited; null for a new one. */
  sale: PriceSchedule | null;
  /** A product to start a new sale on (?product=<id>). */
  forProduct?: string | null;
  currency: string;
  /** The store's time zone; null reads the fields on the device's clock. */
  zone: string | null;
  onSaved: (saved: PriceSchedule, created: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** The sale started meanwhile (409 PRICE_SCHEDULE_LOCKED). */
  onLocked?: () => void;
}) {
  const t = useT(PRICE_SCHEDULE_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const products = useStoreProducts();
  const catalog = useCatalogVariants(workspaceId);
  const collections = useAsync(() => apiClient.listCollections(workspaceId), [workspaceId]);
  const collectionId = useId();
  const valueId = useId();

  const [draft, setDraft] = useState<Draft>(() => draftOf(sale, zone, forProduct ?? null));
  const [baseline, setBaseline] = useState(() => fingerprint(draftOf(sale, zone, forProduct ?? null)));
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = fingerprint(draft) !== baseline;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // A new sale started from a product is named after it until the merchant types a name.
  const forProductName = !sale && forProduct ? (products.data ?? []).find((p) => p.id === forProduct)?.name : undefined;
  useEffect(() => {
    if (forProductName) setDraft((d) => (d.name ? d : { ...d, name: fmt(t.nameFor, { product: forProductName }).slice(0, PRICE_SCHEDULE_LIMITS.name) }));
    // Once, when the product's name is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forProductName]);

  const patch = (change: Partial<Draft>, cleared?: keyof Errors) => {
    setDraft((d) => ({ ...d, ...change }));
    if (cleared && errors[cleared]) setErrors((e) => ({ ...e, [cleared]: undefined }));
  };

  const ids = targetIds(draft);
  const value = changeValue(draft);
  const taken = useMemo(() => new Set(draft.variantIds), [draft.variantIds]);
  const variantById = useMemo(() => new Map(catalog.variants.map((v) => [v.variantId, v])), [catalog.variants]);

  // What the preview asks about: complete as soon as there is a target and a discount.
  const previewBody = useMemo<PriceScheduleInput | null>(() => {
    if (ids.length === 0 || Number.isNaN(value)) return null;
    return {
      name: draft.name.trim() || "-",
      startsAt: new Date().toISOString(),
      endsAt: null,
      target: { type: draft.targetType, ids },
      change: { mode: draft.mode, value },
      showWasPrice: draft.showWasPrice,
    };
    // `ids` is rebuilt every render; its content is in the listed draft fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.targetType, draft.productIds, draft.variantIds, draft.collectionId, draft.mode, value, draft.showWasPrice, draft.name]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFailure(null);
    const found: Errors = {};
    const name = draft.name.trim();
    if (!name) found.name = t.nameError;
    if (ids.length === 0) found.target = t.targetError;
    if (Number.isNaN(value)) found.value = draft.mode === "percent_off" ? t.percentError : draft.mode === "amount_off" ? t.amountError : t.priceError;
    const startsAt = isoOfStoreInput(draft.startsAt, zone);
    if (!startsAt) found.startsAt = t.startError;
    const endsAt = draft.endsAt ? isoOfStoreInput(draft.endsAt, zone) : null;
    if (draft.endsAt && (!endsAt || (startsAt && new Date(endsAt) <= new Date(startsAt)) || new Date(endsAt).getTime() <= Date.now())) found.endsAt = t.endError;
    setErrors(found);
    if (Object.keys(found).length > 0 || !startsAt) return;

    const body: PriceScheduleInput = {
      name,
      startsAt,
      endsAt,
      target: { type: draft.targetType, ids },
      change: { mode: draft.mode, value },
      showWasPrice: draft.showWasPrice,
    };
    setSaving(true);
    try {
      const saved = sale ? await priceScheduleUpdate(apiClient, workspaceId, sale.id, body) : await priceScheduleCreate(apiClient, workspaceId, body);
      const next = draftOf(saved, zone, null);
      setDraft(next);
      setBaseline(fingerprint(next));
      onSaved(saved, !sale);
    } catch (err) {
      if (isApiErrorCode(err, "PRICE_SCHEDULE_LOCKED")) {
        if (onLocked) onLocked();
        else setFailure(t.lockedNotice);
      } else {
        const fields = apiFieldProblems(err).map((p) => p.field);
        if (fields.some((f) => f.startsWith("endsAt"))) setErrors({ endsAt: t.endError });
        else if (fields.some((f) => f.startsWith("target"))) setErrors({ target: t.targetGone });
        else setFailure(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  const collectionList = collections.data ?? [];

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          <Section title={t.onSaleTitle} description={t.onSaleHint}>
            <div className="space-y-4">
              <TextField
                label={t.name}
                required
                maxLength={PRICE_SCHEDULE_LIMITS.name}
                placeholder={t.namePlaceholder}
                value={draft.name}
                disabled={saving}
                error={errors.name}
                onChange={(e) => patch({ name: e.target.value }, "name")}
              />

              <div className="max-w-full overflow-x-auto">
                <FilterTabs
                  tabs={TARGETS.map((type) => ({ value: type, label: t[`target_${type}`] }))}
                  value={draft.targetType}
                  onChange={(targetType) => patch({ targetType }, "target")}
                  label={t.targetLabel}
                  className="flex-nowrap"
                  buttonClassName="min-h-11 whitespace-nowrap sm:min-h-0"
                />
              </div>

              {draft.targetType === "products" && (
                <ProductChecklist
                  label={t.productsLabel}
                  products={products.data ?? []}
                  loading={products.loading}
                  value={draft.productIds}
                  onChange={(productIds) => patch({ productIds }, "target")}
                  disabled={saving}
                  max={PRICE_SCHEDULE_LIMITS.ids}
                />
              )}

              {draft.targetType === "variants" && (
                <div className="space-y-3">
                  {draft.variantIds.length === 0 ? (
                    <p className="rounded-[0.875rem] border border-dashed border-line px-4 py-4 text-center text-sm text-ink-soft">{t.variantsEmpty}</p>
                  ) : (
                    <ul aria-label={t.variantsLabel} className="zimos-offer-checklist divide-y divide-line rounded-[0.875rem] bg-paper-raised ring-1 ring-line">
                      {draft.variantIds.map((id) => {
                        const known = variantById.get(id);
                        const productName = known?.productName ?? t.unknownProduct;
                        const name = variantFullName(productName, known?.detail ?? "");
                        return (
                          <li key={id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                            <VariantCell name={productName} detail={known?.detail || undefined} />
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => patch({ variantIds: draft.variantIds.filter((v) => v !== id) }, "target")}
                              aria-label={fmt(t.removeVariant, { name })}
                              className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
                            >
                              <IconDelete className="size-4" aria-hidden />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <VariantAddRow
                    variants={catalog.variants}
                    loading={catalog.loading}
                    failed={catalog.failed}
                    taken={taken}
                    disabled={saving}
                    query={catalog.query}
                    onQuery={catalog.searchable ? catalog.setQuery : undefined}
                    onAdd={(picked) => patch({ variantIds: [...draft.variantIds, picked.variantId] }, "target")}
                  />
                </div>
              )}

              {draft.targetType === "collection" && (
                <div className="space-y-1.5">
                  <label htmlFor={collectionId} className="text-sm font-medium text-ink">
                    {t.collectionLabel}
                  </label>
                  <Select
                    id={collectionId}
                    className="h-11 text-base md:text-sm"
                    value={draft.collectionId}
                    disabled={saving || collections.loading}
                    onChange={(e) => patch({ collectionId: e.target.value }, "target")}
                  >
                    <option value="">{t.chooseCollection}</option>
                    {collectionList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  {!collections.loading && collectionList.length === 0 && <p className="text-xs text-ink-soft">{t.noCollections}</p>}
                </div>
              )}

              {errors.target && (
                <p role="alert" className="text-xs font-medium text-danger">
                  {errors.target}
                </p>
              )}
            </div>
          </Section>

          <Section title={t.previewTitle} description={t.previewHint}>
            <SalePreview body={previewBody} currency={currency} />
          </Section>
        </div>

        <div className="min-w-0 space-y-4">
          <Section title={t.discountTitle}>
            <div className="space-y-4">
              <div className="max-w-full overflow-x-auto">
                <FilterTabs
                  tabs={MODES.map((mode) => ({ value: mode, label: t[`mode_${mode}`] }))}
                  value={draft.mode}
                  onChange={(mode) => patch({ mode }, "value")}
                  label={t.modeLabel}
                  className="flex-nowrap"
                  buttonClassName="min-h-11 whitespace-nowrap sm:min-h-0"
                />
              </div>

              {draft.mode === "percent_off" ? (
                <div className="space-y-1.5">
                  <label htmlFor={valueId} className="text-sm font-medium text-ink">
                    {t.value_percent_off}
                    <span className="text-danger"> *</span>
                  </label>
                  {/* dir on the box: the number is typed left to right, so its "%" sits after it in both languages. */}
                  <div className="relative max-w-[10rem]" dir="ltr">
                    <Input
                      id={valueId}
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={2}
                      value={draft.percent}
                      disabled={saving}
                      aria-invalid={errors.value ? true : undefined}
                      onChange={(e) => patch({ percent: e.target.value }, "value")}
                      className="h-11 pe-9 text-base tabular-nums md:text-sm"
                    />
                    <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-ink-soft">%</span>
                  </div>
                  {errors.value && <p className="text-xs font-medium text-danger">{errors.value}</p>}
                </div>
              ) : (
                <MoneyInput
                  label={t[`value_${draft.mode}`]}
                  required
                  currency={currency}
                  value={draft.mode === "amount_off" ? draft.amount : draft.price}
                  disabled={saving}
                  error={errors.value}
                  onChange={(v) => patch(draft.mode === "amount_off" ? { amount: v } : { price: v }, "value")}
                />
              )}

              <div>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 cursor-pointer accent-primary"
                    checked={draft.showWasPrice}
                    disabled={saving}
                    onChange={(e) => patch({ showWasPrice: e.target.checked })}
                  />
                  {t.showWasPrice}
                </label>
                <p className="text-xs text-ink-soft">{t.showWasPriceHint}</p>
              </div>
            </div>
          </Section>

          <Section title={t.whenTitle} description={zone ? fmt(t.storeTime, { zone }) : undefined}>
            <div className="space-y-4">
              <Field label={t.startsAt} required error={errors.startsAt} hint={t.startsNowHint}>
                {(props) => (
                  <Input
                    {...props}
                    type="datetime-local"
                    dir="ltr"
                    value={draft.startsAt}
                    disabled={saving}
                    onChange={(e) => patch({ startsAt: e.target.value }, "startsAt")}
                    className="min-h-11 text-base md:text-sm"
                  />
                )}
              </Field>
              <Field label={t.endsAt} error={errors.endsAt} hint={t.endsHint}>
                {(props) => (
                  <div className="flex items-center gap-2">
                    <Input
                      {...props}
                      type="datetime-local"
                      dir="ltr"
                      value={draft.endsAt}
                      disabled={saving}
                      onChange={(e) => patch({ endsAt: e.target.value }, "endsAt")}
                      className="min-h-11 min-w-0 flex-1 text-base md:text-sm"
                    />
                    {draft.endsAt && (
                      <Button type="button" variant="ghost" className="min-h-11 shrink-0 rounded-full" disabled={saving} onClick={() => patch({ endsAt: "" }, "endsAt")}>
                        {t.clearEnd}
                      </Button>
                    )}
                  </div>
                )}
              </Field>
            </div>
          </Section>
        </div>
      </div>

      {failure && <Alert variant="danger">{failure}</Alert>}

      {sale ? (
        <SaveBar dirty={dirty} saving={saving} onDiscard={() => setDraft(draftOf(sale, zone, null))} />
      ) : (
        <div className="flex justify-end">
          <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={saving}>
            {saving ? t.scheduling : t.schedule}
          </Button>
        </div>
      )}
    </form>
  );
}
