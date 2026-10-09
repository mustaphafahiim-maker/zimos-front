import { useId, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconDelete } from "@/components/icons";
import { Alert, Input } from "@store-builder/ui";
import {
  PRICE_LIST_LIMITS,
  contactsListTags,
  priceListCreate,
  priceListDelete,
  priceListGet,
  priceListProblemOf,
  priceListUpdate,
  shopperAccountsGet,
  type PriceList,
  type PriceListKind,
  type PriceListPayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Section } from "@/components/Section";
import { Field, TextField } from "@/components/Field";
import { TagListField } from "@/components/TagListField";
import { SaveBar } from "@/components/SaveBar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useToast } from "@/components/Toast";
import { ProductChecklist } from "@/pages/offers/OfferRuleParts";
import { FormProblem, OfferMenu, OfferPage } from "@/pages/offers/OfferKit";
import { parseWhole } from "@/pages/loyalty/loyaltyStrings";
import { FixedPricesEditor, checkPriceRows, parsePrice, parseQuantity, rowsFromPrices, type PriceRowDraft, type PriceRowErrors } from "./FixedPricesEditor";
import { usePriceListCatalog } from "./priceListCatalog";
import { PRICE_LISTS_PATH, priceListPath } from "./priceListPaths";
import { PRICE_LIST_STRINGS } from "./priceListStrings";

interface Draft {
  name: string;
  tags: string[];
  isActive: boolean;
  kind: PriceListKind;
  percent: string;
  scope: "all" | "chosen";
  productIds: string[];
  rows: PriceRowDraft[];
}

function toDraft(list: PriceList | null): Draft {
  return {
    name: list?.name ?? "",
    tags: list?.customerTags ?? [],
    isActive: list?.isActive ?? true,
    kind: list?.kind ?? "percent",
    percent: list?.percent ? String(list.percent) : "",
    scope: list?.productIds?.length ? "chosen" : "all",
    productIds: list?.productIds ?? [],
    rows: list ? rowsFromPrices(list.prices) : [],
  };
}

/** A draft without its rows' own keys, to tell an edited form from the saved one. */
const fingerprint = (d: Draft) => JSON.stringify({ ...d, rows: d.rows.map((row) => [row.variantId, row.quantity.trim(), row.price.trim()]) });

type Errors = Partial<Record<"name" | "tags" | "percent" | "products" | "prices", string>>;
const FIELD_ORDER = ["name", "tags", "percent", "products", "prices"] as const;

/**
 * Offers → Price lists → one list (handoff 205, change products.manage): its
 * name and the customer tags it is for, then either a percent off (every
 * product or chosen ones) or fixed prices per variant with quantity tiers.
 */
export function PriceListEditorPage() {
  const t = useT(PRICE_LIST_STRINGS);
  const { priceListId } = useParams<{ priceListId: string }>();
  const workspaceId = useWorkspaceId();
  const list = useAsync(() => (priceListId ? priceListGet(apiClient, workspaceId, priceListId) : Promise.resolve(null)), [workspaceId, priceListId]);
  const back = { to: PRICE_LISTS_PATH, label: t.backToLists };
  // Asked from the header's «…», answered by the form's own confirmation.
  const [removing, setRemoving] = useState(false);

  if (!priceListId) {
    return (
      <OfferPage title={t.newTitle} back={back}>
        <PriceListForm list={null} removing={false} onRemovingChange={setRemoving} />
      </OfferPage>
    );
  }

  const saved = list.data;
  return (
    <OfferPage
      title={saved?.name ?? t.editTitle}
      back={back}
      titleBadge={
        saved ? (
          <StatusBadge value={saved.isActive ? "active" : "inactive"} tone={saved.isActive ? "success" : "neutral"} text={saved.isActive ? t.stateOn : t.stateOff} />
        ) : undefined
      }
      actions={
        saved ? (
          <OfferMenu
            label={t.moreActions}
            items={[{ id: "delete", label: t.delete, icon: IconDelete, destructive: true, onSelect: () => setRemoving(true) }]}
            className="bg-paper-raised ring-1 ring-line"
          />
        ) : undefined
      }
    >
      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {saved && <PriceListForm key={saved.id} list={saved} onSaved={(next) => list.setData(next)} removing={removing} onRemovingChange={setRemoving} />}
      </DataState>
    </OfferPage>
  );
}

function PriceListForm({
  list,
  onSaved,
  removing,
  onRemovingChange,
}: {
  list: PriceList | null;
  onSaved?: (saved: PriceList) => void;
  /** The delete confirmation is open (asked from the page header). */
  removing: boolean;
  onRemovingChange: (open: boolean) => void;
}) {
  const t = useT(PRICE_LIST_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const navigate = useNavigate();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const kindName = useId();
  const scopeName = useId();

  const [saved, setSaved] = useState<Draft>(() => toDraft(list));
  const [draft, setDraft] = useState<Draft>(saved);
  const [errors, setErrors] = useState<Errors>({});
  const [rowErrors, setRowErrors] = useState<PriceRowErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const catalog = usePriceListCatalog();
  // How many customers carry each tag, so a mistyped tag shows before it costs a sale.
  // A role that may not read contacts simply sees no counts.
  const tagCounts = useAsync(() => contactsListTags(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const accounts = useAsync(() => shopperAccountsGet(apiClient, workspaceId).catch(() => null), [workspaceId]);

  // A list that does not exist yet is unsaved from the start.
  const dirty = !list || fingerprint(draft) !== fingerprint(saved);
  // A new list is guarded only once something was typed in it.
  useReportDirty(list ? dirty : fingerprint(draft) !== fingerprint(saved));

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setFailure(null);
    if (key === "name") setErrors((e) => ({ ...e, name: undefined }));
    if (key === "tags") setErrors((e) => ({ ...e, tags: undefined }));
    if (key === "percent") setErrors((e) => ({ ...e, percent: undefined }));
    if (key === "productIds" || key === "scope") setErrors((e) => ({ ...e, products: undefined }));
    if (key === "rows") {
      setErrors((e) => ({ ...e, prices: undefined }));
      setRowErrors({});
    }
  };

  const countsByTag = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of tagCounts.data ?? []) {
      const key = entry.tag.trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + entry.count);
    }
    return map;
  }, [tagCounts.data]);

  // What the percent does to a real product of the store, on the number being typed.
  const livePercent = parseWhole(draft.percent, PRICE_LIST_LIMITS.percentMin, PRICE_LIST_LIMITS.percentMax);
  const exampleProduct =
    (draft.scope === "chosen" ? catalog.products.find((p) => draft.productIds.includes(p.id)) : undefined) ??
    (draft.scope === "all" ? catalog.products.find((p) => (p.variants?.length ?? 0) > 0) : undefined);
  const examplePrice = exampleProduct?.variants?.[0] ? Number(exampleProduct.variants[0].priceAmount) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const name = draft.name.trim();
    const found: Errors = {};
    let foundRows: PriceRowErrors = {};
    if (!name) found.name = t.nameRequired;
    if (draft.tags.length === 0) found.tags = t.tagsRequired;

    let payload: PriceListPayload | null = null;
    if (draft.kind === "percent") {
      const percent = parseWhole(draft.percent, PRICE_LIST_LIMITS.percentMin, PRICE_LIST_LIMITS.percentMax);
      if (percent === null) found.percent = t.percentError;
      // A product deleted since it was ticked is left out: the API would refuse the whole list.
      const ids = catalog.knownProductIds ? draft.productIds.filter((id) => catalog.knownProductIds?.has(id)) : draft.productIds;
      if (draft.scope === "chosen" && ids.length === 0) found.products = t.productsRequired;
      if (percent !== null) {
        payload = { name, customerTags: draft.tags, kind: "percent", percent, productIds: draft.scope === "chosen" ? ids : null, isActive: draft.isActive };
      }
    } else {
      foundRows = checkPriceRows(draft.rows, t);
      if (draft.rows.length === 0) found.prices = t.pricesRequired;
      else if (draft.rows.length > PRICE_LIST_LIMITS.pricesMax) found.prices = fmt(t.tooManyPrices, { max: PRICE_LIST_LIMITS.pricesMax });
      else if (Object.keys(foundRows).length > 0) found.prices = t.fixFields;
      payload = {
        name,
        customerTags: draft.tags,
        kind: "fixed",
        prices: draft.rows.map((row) => ({ variantId: row.variantId, minQuantity: parseQuantity(row.quantity) ?? 1, priceAmount: parsePrice(row.price) ?? 0 })),
        isActive: draft.isActive,
      };
    }

    setErrors(found);
    setRowErrors(foundRows);
    const first = FIELD_ORDER.find((key) => found[key]);
    if (first || !payload) {
      setFailure(t.fixFields);
      const scope = document.getElementById(formId);
      const box = scope?.querySelector<HTMLElement>(`[data-field="${first}"]`);
      box?.scrollIntoView({ block: "center" });
      (box?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? box?.querySelector<HTMLElement>("input"))?.focus({ preventScroll: true });
      return;
    }

    setSaving(true);
    setFailure(null);
    try {
      if (list) {
        const result = await priceListUpdate(apiClient, workspaceId, list.id, payload);
        const next = toDraft(result);
        setSaved(next);
        setDraft(next);
        onSaved?.(result);
        toast.success(t.saved);
      } else {
        const result = await priceListCreate(apiClient, workspaceId, payload);
        toast.success(t.created);
        navigate(priceListPath(result.id), { replace: true });
      }
    } catch (err) {
      const problem = priceListProblemOf(err);
      setFailure(problem ? t[problem] : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDraft(saved);
    setErrors({});
    setRowErrors({});
    setFailure(null);
  }

  const choice = (name: string, checked: boolean, onPick: () => void, title: string, hint?: string) => (
    <label className="flex min-h-11 flex-1 cursor-pointer items-start gap-2.5 rounded-[1rem] px-3 py-2.5 text-sm text-ink ring-1 ring-line has-[:checked]:bg-primary-soft has-[:checked]:ring-primary has-[:disabled]:cursor-default">
      <input type="radio" name={name} className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary" checked={checked} disabled={saving} onChange={onPick} />
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        {hint && <span className="mt-0.5 block text-xs text-ink-soft">{hint}</span>}
      </span>
    </label>
  );

  return (
    <>
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        {accounts.data && !accounts.data.enabled && (
          <Alert>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="min-w-0 flex-1 basis-64">{t.accountsOff}</span>
              <ViewLink to="/store-settings/customer-accounts" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
                {t.accountsOffAction}
              </ViewLink>
            </div>
          </Alert>
        )}

        <Section title={t.basicsTitle}>
          <div className="space-y-5">
            <div data-field="name" className="max-w-md">
              <TextField
                label={t.name}
                hint={t.nameHint}
                required
                autoComplete="off"
                maxLength={PRICE_LIST_LIMITS.nameMax}
                placeholder={t.namePlaceholder}
                value={draft.name}
                disabled={saving}
                onChange={(e) => set("name", e.target.value)}
                error={errors.name}
                className="[&_input]:h-11 [&_input]:text-base md:[&_input]:text-sm"
              />
            </div>

            <div data-field="tags" className="max-w-md">
              <TagListField
                label={t.tags}
                values={draft.tags}
                onChange={(next) => set("tags", next)}
                max={PRICE_LIST_LIMITS.tagsMax}
                maxLength={PRICE_LIST_LIMITS.tagMax}
                placeholder={t.tagsPlaceholder}
                hint={t.tagsHint}
                lowercase
                dir="auto"
                disabled={saving}
              />
              {errors.tags && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
                  {errors.tags}
                </p>
              )}
              {tagCounts.data && draft.tags.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
                  {draft.tags.map((tag) => {
                    const n = countsByTag.get(tag.toLowerCase()) ?? 0;
                    return <li key={tag}>{n > 0 ? fmt(pluralOf(t, "tagCustomers", n), { tag }) : fmt(t.tagNobody, { tag })}</li>;
                  })}
                </ul>
              )}
            </div>

            <SettingsGroup className="max-w-md">
              <SettingsSwitch
                checked={draft.isActive}
                onChange={(next) => set("isActive", next)}
                label={t.active}
                hint={draft.isActive ? t.activeHintOn : t.activeHintOff}
                disabled={saving}
              />
            </SettingsGroup>
          </div>
        </Section>

        <Section title={t.pricesTitle} description={draft.kind === "fixed" && draft.rows.length > 0 ? pluralOf(t, "pricesCount", draft.rows.length) : undefined}>
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">{t.kind}</legend>
              <div className="flex flex-col gap-2 sm:flex-row">
                {choice(kindName, draft.kind === "percent", () => set("kind", "percent"), t.kindPercent, t.kindPercentHint)}
                {choice(kindName, draft.kind === "fixed", () => set("kind", "fixed"), t.kindFixed, t.kindFixedHint)}
              </div>
              {list && draft.kind !== list.kind && (
                <p className="mt-2 text-xs font-medium text-accent-dark">
                  {fmt(t.kindSwitchNote, { kind: draft.kind === "percent" ? t.kindPercent : t.kindFixed })}
                </p>
              )}
            </fieldset>

            {draft.kind === "percent" ? (
              <>
                <div data-field="percent">
                  <Field label={t.percent} required error={errors.percent} hint={t.percentHint}>
                    {(props) => (
                      <div className="flex items-center gap-2">
                        <Input
                          {...props}
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          autoComplete="off"
                          maxLength={2}
                          value={draft.percent}
                          disabled={saving}
                          onChange={(e) => set("percent", e.target.value)}
                          className="h-11 w-24 text-center text-base tabular-nums md:text-sm"
                        />
                        <span aria-hidden className="text-sm text-ink-soft">
                          {t.percentUnit}
                        </span>
                      </div>
                    )}
                  </Field>
                </div>

                <fieldset data-field="products">
                  <legend className="mb-1.5 text-sm font-medium text-ink">{t.scope}</legend>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {choice(scopeName, draft.scope === "all", () => set("scope", "all"), t.scopeAll)}
                    {choice(scopeName, draft.scope === "chosen", () => set("scope", "chosen"), t.scopeChosen)}
                  </div>
                  {draft.scope === "chosen" && (
                    <div className="mt-3">
                      <ProductChecklist
                        label={t.products}
                        products={catalog.products}
                        value={draft.productIds}
                        onChange={(ids) => set("productIds", ids)}
                        disabled={saving || catalog.loading}
                        max={PRICE_LIST_LIMITS.productsMax}
                      />
                    </div>
                  )}
                  {errors.products && (
                    <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
                      {errors.products}
                    </p>
                  )}
                </fieldset>

                {livePercent !== null && exampleProduct && examplePrice !== null && examplePrice > 0 && (
                  <p data-slot="offer-preview" className="zimos-offer-preview rounded-[1rem] bg-paper-sunken px-3.5 py-3 text-sm leading-6 text-ink ring-1 ring-line">
                    {fmt(t.example, {
                      name: exampleProduct.name,
                      price: formatMoney(examplePrice, currency),
                      // The API's own rounding: the normal price less the percent, to the nearest minor unit.
                      yours: formatMoney(Math.round((examplePrice * (100 - livePercent)) / 100), currency),
                    })}
                  </p>
                )}
              </>
            ) : (
              <div data-field="prices">
                <FixedPricesEditor
                  rows={draft.rows}
                  onChange={(rows) => set("rows", rows)}
                  errors={rowErrors}
                  products={catalog.products}
                  variants={catalog.variants}
                  catalogComplete={catalog.complete}
                  catalogLoading={catalog.loading}
                  currency={currency}
                  disabled={saving}
                />
                {errors.prices && errors.prices !== t.fixFields && (
                  <p role="alert" className="mt-2 text-xs font-medium text-danger">
                    {errors.prices}
                  </p>
                )}
              </div>
            )}

            <FormProblem>{failure}</FormProblem>
          </div>
        </Section>

        <SaveBar dirty={dirty} saving={saving} saveLabel={t.save} savingLabel={t.saving} onDiscard={list ? discard : undefined} />
      </form>

      <ConfirmDialog
        open={removing}
        title={fmt(t.deleteTitle, { name: list?.name ?? "" })}
        description={t.deleteHint}
        confirmLabel={t.deleteConfirm}
        destructive
        onCancel={() => onRemovingChange(false)}
        onConfirm={async () => {
          if (!list) return;
          await priceListDelete(apiClient, workspaceId, list.id);
          toast.success(t.deleted);
          navigate(PRICE_LISTS_PATH, { replace: true });
        }}
      />
    </>
  );
}
