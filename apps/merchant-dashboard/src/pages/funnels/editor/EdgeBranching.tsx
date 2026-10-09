import { useEffect, useId, useMemo, useState } from "react";
import { Button, Input, cn } from "@store-builder/ui";
import {
  FUNNEL_EDGE_PAYMENT_METHODS,
  FUNNEL_EDGE_WHEN_MAX_IDS,
  funnelSettingsGet,
  type FunnelEdgePaymentMethod,
  type FunnelEdgeWhen,
  type Product,
} from "@store-builder/api-client";
import { IconArrowDown, IconArrowUp, IconClose, IconPlus } from "@/components/icons";
import { Select } from "@/components/Select";
import { Sheet } from "@/components/Sheet";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatOptions, majorToMinor } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import type { UiEdge } from "../funnelAdapter";
import { EDGE_WHEN_STRINGS, edgeWhenLabels, hasWhen, rememberWhenNames, whenNameOf, type EdgeWhenStrings } from "./edgeWhenText";

type Kind = "product" | "total" | "payment";
const KINDS: readonly Kind[] = ["product", "total", "payment"];
const ADD_LABEL = { product: "addProduct", total: "addTotal", payment: "addPayment" } as const;

const FIELD = "h-11 text-base md:h-9 md:text-sm";
const ICON_BUTTON =
  "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none md:size-9";

/** Arabic-Indic digits and the Arabic decimal mark as a browser reads a number. */
const asciiNumber = (raw: string) => raw.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace("٫", ".");

/** A typed amount in minor units; null for an empty field; undefined for something that is not an amount. */
function parseAmount(raw: string): number | null | undefined {
  const text = asciiNumber(raw);
  if (text === "") return null;
  const minor = majorToMinor(text);
  return Number.isFinite(minor) && minor >= 0 ? minor : undefined;
}

const amountText = (minor: number | undefined) => (minor === undefined ? "" : String(minor / 100));

/** The funnel's own currency (its settings), else the store's. Read once per funnel for the session. */
function useFunnelCurrency(funnelId: string): string {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const settings = useCachedAsync(`funnel-currency:${workspaceId}:${funnelId}`, () => funnelSettingsGet(apiClient, workspaceId, funnelId).catch(() => null), [workspaceId, funnelId]);
  return settings.data?.currency || currentWorkspace?.defaultCurrency || "EGP";
}

/**
 * Under a way out of a step in the funnel's inspector (handoff 376): its place
 * among the step's ways (up / down: the first way that fits is taken) and
 * «شروط على الطلب» — what the order the visitor placed in this funnel must
 * hold for this way to be taken: a product bought, the order's total, how it
 * was paid. Every condition given must hold; the server checks them against
 * the order itself.
 *
 * Only a condition the server would accept is written to the path: an
 * unfinished one (no product ticked yet, an amount half typed) stays here
 * until it is complete, and says what it is missing.
 */
export function EdgeBranching({
  funnelId,
  edge,
  outgoing,
  products,
  productsLoading = false,
  productsFailed = false,
  onWhenChange,
  onReorder,
}: {
  funnelId: string;
  edge: UiEdge;
  /** The step's ways out, first tried first. */
  outgoing: readonly UiEdge[];
  products: readonly Product[];
  productsLoading?: boolean;
  productsFailed?: boolean;
  onWhenChange: (when: FunnelEdgeWhen | null) => void;
  /** New priorities by edge id, after this way moved up or down. */
  onReorder: (priorities: Map<string, number>) => void;
}) {
  const t = useT(EDGE_WHEN_STRINGS);
  const currency = useFunnelCurrency(funnelId);
  const addId = useId();
  const when = edge.when ?? null;

  // The map's arrows name the products too: what this pane knows, it remembers.
  useEffect(() => {
    const entries: Array<[string, string]> = [];
    for (const product of products) {
      entries.push([product.id, product.name]);
      for (const variant of product.variants ?? []) {
        const options = formatOptions(variant.optionValues);
        entries.push([variant.id, options ? `${product.name} (${options})` : product.name]);
      }
    }
    rememberWhenNames(entries);
  }, [products]);

  // A kind is shown once it holds something, or once it was added here and is still being filled.
  const [opened, setOpened] = useState<ReadonlySet<Kind>>(new Set());
  const holds: Record<Kind, boolean> = {
    product: when?.productIds !== undefined || when?.variantIds !== undefined,
    total: when?.minTotal !== undefined || when?.maxTotal !== undefined,
    payment: when?.paymentMethods !== undefined,
  };
  // A kind the path holds stays on screen while it is emptied (every product unticked), until it is removed.
  const holding = KINDS.filter((kind) => holds[kind]).join(",");
  useEffect(() => {
    if (holding) setOpened((prev) => new Set([...prev, ...(holding.split(",") as Kind[])]));
  }, [holding]);
  const shown = KINDS.filter((kind) => holds[kind] || opened.has(kind));
  const addable = KINDS.filter((kind) => !shown.includes(kind));

  const write = (next: FunnelEdgeWhen) => onWhenChange(hasWhen(next) ? next : null);
  function removeKind(kind: Kind) {
    setOpened((prev) => new Set([...prev].filter((k) => k !== kind)));
    const next: FunnelEdgeWhen = { ...(when ?? {}) };
    if (kind === "product") {
      delete next.productIds;
      delete next.variantIds;
    } else if (kind === "total") {
      delete next.minTotal;
      delete next.maxTotal;
    } else delete next.paymentMethods;
    write(next);
  }

  // --- place among the ways out ---------------------------------------------------------
  const index = outgoing.findIndex((e) => e.id === edge.id);
  function move(delta: -1 | 1) {
    const target = index + delta;
    if (index < 0 || target < 0 || target >= outgoing.length) return;
    const order = [...outgoing];
    [order[index], order[target]] = [order[target], order[index]];
    // Distinct, spaced numbers, highest first: the order on screen is the order the server tries.
    onReorder(new Map(order.map((e, i) => [e.id, (order.length - i) * 10])));
  }

  const labels = edgeWhenLabels(t, when, currency);

  return (
    <div data-slot="funnel-way-branching" className="space-y-2 border-t border-line pt-2">
      {outgoing.length > 1 && (
        <div className="flex items-center gap-1 text-xs text-ink-soft" title={t.orderHint}>
          <span className="min-w-0 flex-1">{t.order}</span>
          <button type="button" className={ICON_BUTTON} onClick={() => move(-1)} disabled={index <= 0} aria-label={t.moveUp} title={t.moveUp}>
            <IconArrowUp className="size-4" aria-hidden />
          </button>
          <button type="button" className={ICON_BUTTON} onClick={() => move(1)} disabled={index < 0 || index >= outgoing.length - 1} aria-label={t.moveDown} title={t.moveDown}>
            <IconArrowDown className="size-4" aria-hidden />
          </button>
        </div>
      )}

      <p className="text-xs font-semibold text-ink">{t.title}</p>

      {labels.length > 0 && (
        <ul data-slot="funnel-way-when" className="space-y-0.5 text-xs leading-5 text-ink">
          {labels.map((label) => (
            <li key={label}>
              <bdi>{label}</bdi>
            </li>
          ))}
        </ul>
      )}

      {shown.map((kind) => (
        <div key={kind} data-slot="funnel-when-row" data-kind={kind} className="space-y-2 rounded-[0.875rem] bg-paper-sunken p-2.5">
          <div className="flex items-center gap-1">
            <p className="min-w-0 flex-1 text-xs font-medium text-ink">{kind === "product" ? t.products : kind === "total" ? t.total : t.payment}</p>
            <button type="button" className={ICON_BUTTON} onClick={() => removeKind(kind)} aria-label={t.remove} title={t.remove}>
              <IconClose className="size-4" aria-hidden />
            </button>
          </div>
          {kind === "product" && (
            <ProductCondition t={t} when={when} products={products} loading={productsLoading} failed={productsFailed} onChange={(ids) => write({ ...withoutProducts(when), ...ids })} />
          )}
          {kind === "total" && <TotalCondition t={t} when={when} currency={currency} onChange={(totals) => write({ ...withoutTotals(when), ...totals })} />}
          {kind === "payment" && (
            <PaymentCondition
              t={t}
              value={when?.paymentMethods ?? []}
              onChange={(methods) => {
                const next: FunnelEdgeWhen = { ...(when ?? {}) };
                if (methods.length > 0) next.paymentMethods = methods;
                else delete next.paymentMethods;
                write(next);
              }}
            />
          )}
        </div>
      ))}

      {addable.length > 0 && (
        <div className="flex items-center gap-2">
          <IconPlus className="size-4 shrink-0 text-ink-soft" aria-hidden />
          <label htmlFor={addId} className="sr-only">
            {t.add}
          </label>
          <Select
            id={addId}
            value=""
            className={cn(FIELD, "min-w-0 flex-1")}
            onChange={(e) => {
              const kind = e.target.value as Kind;
              if (KINDS.includes(kind)) setOpened((prev) => new Set([...prev, kind]));
            }}
          >
            <option value="">{t.add}</option>
            {addable.map((kind) => (
              <option key={kind} value={kind}>
                {t[ADD_LABEL[kind]]}
              </option>
            ))}
          </Select>
        </div>
      )}

      {shown.length > 0 && <p className="text-xs leading-5 text-ink-soft">{t.hint}</p>}
    </div>
  );
}

function withoutProducts(when: FunnelEdgeWhen | null): FunnelEdgeWhen {
  const next: FunnelEdgeWhen = { ...(when ?? {}) };
  delete next.productIds;
  delete next.variantIds;
  return next;
}

function withoutTotals(when: FunnelEdgeWhen | null): FunnelEdgeWhen {
  const next: FunnelEdgeWhen = { ...(when ?? {}) };
  delete next.minTotal;
  delete next.maxTotal;
  return next;
}

// ------------------------------------------------------------------ bought a product --

function ProductCondition({
  t,
  when,
  products,
  loading,
  failed,
  onChange,
}: {
  t: EdgeWhenStrings;
  when: FunnelEdgeWhen | null;
  products: readonly Product[];
  loading: boolean;
  failed: boolean;
  onChange: (ids: Pick<FunnelEdgeWhen, "productIds" | "variantIds">) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");
  const [variantsOpen, setVariantsOpen] = useState<ReadonlySet<string>>(new Set());
  const productIds = useMemo(() => when?.productIds ?? [], [when?.productIds]);
  const variantIds = useMemo(() => when?.variantIds ?? [], [when?.variantIds]);
  const chosen = [...productIds, ...variantIds];

  const emit = (nextProducts: string[], nextVariants: string[]) =>
    onChange({ ...(nextProducts.length > 0 ? { productIds: nextProducts } : {}), ...(nextVariants.length > 0 ? { variantIds: nextVariants } : {}) });

  function toggleProduct(product: Product) {
    const own = new Set((product.variants ?? []).map((v) => v.id));
    if (productIds.includes(product.id)) return emit(productIds.filter((id) => id !== product.id), variantIds);
    if (productIds.length >= FUNNEL_EDGE_WHEN_MAX_IDS) return;
    // The whole product replaces any of its variants ticked one by one.
    emit([...productIds, product.id], variantIds.filter((id) => !own.has(id)));
  }
  function toggleVariant(product: Product, variantId: string) {
    if (variantIds.includes(variantId)) return emit(productIds, variantIds.filter((id) => id !== variantId));
    if (variantIds.length >= FUNNEL_EDGE_WHEN_MAX_IDS) return;
    emit(productIds.filter((id) => id !== product.id), [...variantIds, variantId]);
  }

  const needle = search.trim().toLocaleLowerCase();
  const listed = needle ? products.filter((p) => p.name.toLocaleLowerCase().includes(needle)) : products;
  // With the catalogue at hand, an id it lacks is a product deleted since.
  const known = (id: string) => whenNameOf(id) !== undefined || products.some((p) => p.id === id || (p.variants ?? []).some((v) => v.id === id));
  const catalogueReady = !loading && !failed;

  return (
    <div className="space-y-2">
      {chosen.length === 0 ? (
        <p className="text-xs leading-5 text-accent-dark">{t.noProducts}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {chosen.map((id) => {
            const gone = catalogueReady && !known(id);
            return (
              <li key={id} className={cn("max-w-full truncate rounded-full px-2.5 py-1 text-xs", gone ? "bg-danger-soft text-danger" : "bg-paper-raised text-ink ring-1 ring-line")}>
                <bdi>{gone ? t.productGone : (whenNameOf(id) ?? "…")}</bdi>
              </li>
            );
          })}
        </ul>
      )}
      <Button type="button" variant="outline" className="min-h-11 w-full md:min-h-9" onClick={() => setPicking(true)}>
        {chosen.length === 0 ? t.chooseProducts : t.changeProducts}
      </Button>

      <Sheet
        open={picking}
        onOpenChange={setPicking}
        title={t.pickerTitle}
        description={t.pickerHint}
        size="md"
        footer={
          <>
            <span className="me-auto self-center text-xs text-ink-soft">{pluralOf(t, "selected", chosen.length)}</span>
            <Button type="button" onClick={() => setPicking(false)}>
              {t.done}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.pickerSearch} aria-label={t.pickerSearch} className="h-11 text-base md:h-9 md:text-sm" />
          {loading ? (
            <p role="status" className="py-3 text-sm text-ink-soft">
              {t.pickerLoading}
            </p>
          ) : failed ? (
            <p role="alert" className="py-3 text-sm text-danger">
              {t.pickerFailed}
            </p>
          ) : products.length === 0 ? (
            <p className="py-3 text-sm text-ink-soft">{t.pickerNone}</p>
          ) : listed.length === 0 ? (
            <p className="py-3 text-sm text-ink-soft">{t.pickerEmpty}</p>
          ) : (
            <ul className="divide-y divide-line">
              {listed.map((product) => {
                const variants = (product.variants ?? []).filter((v) => v.status !== "archived");
                const whole = productIds.includes(product.id);
                const some = variants.some((v) => variantIds.includes(v.id));
                const expanded = variants.length > 1 && (variantsOpen.has(product.id) || some);
                return (
                  <li key={product.id} className="py-1">
                    <div className="flex items-center gap-2">
                      <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <input type="checkbox" className="size-5 shrink-0 cursor-pointer accent-primary" checked={whole} onChange={() => toggleProduct(product)} />
                        <bdi className="min-w-0 truncate text-sm text-ink">{product.name}</bdi>
                      </label>
                      {variants.length > 1 && !some && (
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setVariantsOpen((prev) => (prev.has(product.id) ? new Set([...prev].filter((id) => id !== product.id)) : new Set([...prev, product.id])))}
                          className="min-h-11 shrink-0 cursor-pointer rounded-full px-3 text-xs font-medium text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary md:min-h-9"
                        >
                          {t.someVariants}
                        </button>
                      )}
                    </div>
                    {expanded && (
                      <ul aria-label={fmt(t.variantsOf, { name: product.name })} className="ms-7 border-s border-line ps-3">
                        {variants.map((variant) => (
                          <li key={variant.id}>
                            <label className="flex min-h-11 cursor-pointer items-center gap-3 md:min-h-9">
                              <input
                                type="checkbox"
                                className="size-5 shrink-0 cursor-pointer accent-primary"
                                checked={variantIds.includes(variant.id)}
                                onChange={() => toggleVariant(product, variant.id)}
                              />
                              <bdi className="min-w-0 truncate text-sm text-ink">{formatOptions(variant.optionValues) || variant.sku || t.wholeProduct}</bdi>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-ink-soft">{fmt(t.max, { n: FUNNEL_EDGE_WHEN_MAX_IDS })}</p>
        </div>
      </Sheet>
    </div>
  );
}

// ------------------------------------------------------------------------ order total --

function TotalCondition({
  t,
  when,
  currency,
  onChange,
}: {
  t: EdgeWhenStrings;
  when: FunnelEdgeWhen | null;
  currency: string;
  onChange: (totals: Pick<FunnelEdgeWhen, "minTotal" | "maxTotal">) => void;
}) {
  const minId = useId();
  const maxId = useId();
  const [minText, setMinText] = useState(amountText(when?.minTotal));
  const [maxText, setMaxText] = useState(amountText(when?.maxTotal));

  // An undo, or another pane, changed the path: the fields follow what it holds now.
  const savedMin = when?.minTotal;
  const savedMax = when?.maxTotal;
  useEffect(() => {
    setMinText((text) => (parseAmount(text) === (savedMin ?? null) ? text : amountText(savedMin)));
    setMaxText((text) => {
      const typed = parseAmount(text);
      // «أقل من» typed at or under «على الأقل» is kept on screen (with its reason) though the path does not hold it.
      if (typed === (savedMax ?? null) || (savedMax === undefined && typed !== null && typed !== undefined && savedMin !== undefined && typed <= savedMin)) return text;
      return amountText(savedMax);
    });
  }, [savedMin, savedMax]);

  const min = parseAmount(minText);
  const max = parseAmount(maxText);
  const badOrder = typeof min === "number" && typeof max === "number" && max <= min;

  function commit(nextMinText: string, nextMaxText: string) {
    const nextMin = parseAmount(nextMinText);
    const nextMax = parseAmount(nextMaxText);
    const totals: Pick<FunnelEdgeWhen, "minTotal" | "maxTotal"> = {};
    if (typeof nextMin === "number") totals.minTotal = nextMin;
    if (typeof nextMax === "number" && !(typeof nextMin === "number" && nextMax <= nextMin)) totals.maxTotal = nextMax;
    onChange(totals);
  }

  const field = (id: string, label: string, value: string, bad: boolean, onText: (text: string) => void) => (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-1 block text-xs text-ink-soft">
        {label} <bdi dir="ltr">({currency})</bdi>
      </label>
      <Input id={id} inputMode="decimal" dir="ltr" value={value} aria-invalid={bad || undefined} onChange={(e) => onText(e.target.value)} className={cn(FIELD, "w-full tabular-nums")} />
    </div>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        {field(minId, t.atLeast, minText, min === undefined, (text) => {
          setMinText(text);
          commit(text, maxText);
        })}
        {field(maxId, t.lessThan, maxText, max === undefined || badOrder, (text) => {
          setMaxText(text);
          commit(minText, text);
        })}
      </div>
      {(min === undefined || max === undefined) && <p className="text-xs leading-5 text-danger">{t.totalWhole}</p>}
      {badOrder && <p className="text-xs leading-5 text-danger">{t.totalOrder}</p>}
    </div>
  );
}

// --------------------------------------------------------------------- payment method --

function PaymentCondition({ t, value, onChange }: { t: EdgeWhenStrings; value: readonly FunnelEdgePaymentMethod[]; onChange: (methods: FunnelEdgePaymentMethod[]) => void }) {
  const words = t as unknown as Record<string, string>;
  return (
    <ul className="grid grid-cols-2 gap-x-2">
      {FUNNEL_EDGE_PAYMENT_METHODS.map((method) => {
        const checked = value.includes(method);
        return (
          <li key={method}>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink md:min-h-9">
              <input
                type="checkbox"
                className="size-5 shrink-0 cursor-pointer accent-primary"
                checked={checked}
                // Kept in the list's own order, so the same choice is always the same condition.
                onChange={() => onChange(FUNNEL_EDGE_PAYMENT_METHODS.filter((m) => (m === method ? !checked : value.includes(m))))}
              />
              <span className="min-w-0">{words[`pay_${method}`] ?? method}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
