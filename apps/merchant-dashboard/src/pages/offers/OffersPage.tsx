import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Input, Label, Spinner, Tabs, TabsList, TabsTrigger, cn } from "@store-builder/ui";
import { ArrowRight, Gift, Layers, Pencil, ShoppingBag, Sparkles, Trash2, TrendingDown, Check } from "lucide-react";
import type { ConversionOffer, ConversionOfferType, OfferProductRef } from "@/mock/types";
import { mockApi } from "@/mock/api";
import { uid, nowIso } from "@/mock/store";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import {
  basisPointsToPercentInput,
  formatMoney,
  majorToMinor,
  minorToMajorInput,
  percentToBasisPoints,
} from "@/lib/format";
import { fmt, useCommon, useLocale, useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { Toggle } from "@/components/Toggle";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { MoneyInput } from "@/components/MoneyInput";
import { useToast } from "@/components/Toast";
import {
  FORM_STRINGS,
  OFFER_TYPES,
  PAGE_STRINGS,
  PREVIEW_STRINGS,
  TAB_LABEL,
  TRIGGER_ANY_ORDER_ON_CANCEL,
  TRIGGER_ANY_PRODUCT,
  TYPE_HINT,
  TYPE_LABEL,
  type OfferTabKey,
} from "./OffersPage.strings";

type DemoProduct = { id: string; name: string; price: number };
type TabKey = OfferTabKey;
type PageT = Record<keyof (typeof PAGE_STRINGS)["en"], string>;

const TYPE_TONE: Record<ConversionOfferType, string> = {
  order_bump: "bg-primary-soft text-primary-dark",
  post_purchase_upsell: "bg-accent-soft text-accent-dark",
  cross_sell: "bg-zimos-ice text-primary",
  downsell: "bg-info-soft text-info",
  bundle: "bg-paper text-ink-soft border border-line",
};

const TYPE_ICON: Record<ConversionOfferType, typeof Gift> = {
  order_bump: Gift,
  post_purchase_upsell: Sparkles,
  cross_sell: ShoppingBag,
  downsell: TrendingDown,
  bundle: Layers,
};

const TAB_KEYS: TabKey[] = ["all", ...OFFER_TYPES];

function discountLabel(o: ConversionOffer, t: PageT): string {
  if (o.type === "bundle") {
    if (o.tiers.length === 0) return "—";
    return o.tiers
      .map((tier) => fmt(t.tier, { q: tier.quantity, pct: basisPointsToPercentInput(tier.discountBasisPoints) }))
      .join(" · ");
  }
  if (o.discountType === "percentage") return fmt(t.pctOff, { pct: basisPointsToPercentInput(o.discountValue) });
  if (o.discountType === "fixed") return fmt(t.amountOff, { amount: formatMoney(o.discountValue) });
  return t.noDiscount;
}

function triggerDisplay(label: string, t: PageT): string {
  if (!label) return "—";
  if (label === TRIGGER_ANY_PRODUCT) return t.anyProduct;
  if (label === TRIGGER_ANY_ORDER_ON_CANCEL) return t.anyOrderOnCancel;
  return label;
}

function acceptanceRate(o: ConversionOffer): number {
  return o.impressions > 0 ? (o.accepted / o.impressions) * 100 : 0;
}

export function OffersPage() {
  const t = useT(PAGE_STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => mockApi.listOffers(workspaceId), [workspaceId]);
  const products = useAsync(() => mockApi.demoProducts(), []);

  const [tab, setTab] = useState<TabKey>("all");
  const [formTarget, setFormTarget] = useState<ConversionOffer | "new" | null>(null);
  const [deleting, setDeleting] = useState<ConversionOffer | null>(null);

  const offers = list.data ?? [];
  const reload = () => list.refresh({ silent: true });

  const kpis = useMemo(() => {
    const revenue = offers.reduce((a, o) => a + Number(o.revenueAmount), 0);
    const impressions = offers.reduce((a, o) => a + o.impressions, 0);
    const accepted = offers.reduce((a, o) => a + o.accepted, 0);
    return {
      revenue,
      rate: impressions > 0 ? (accepted / impressions) * 100 : 0,
      active: offers.filter((o) => o.status === "active").length,
    };
  }, [offers]);

  const visible = tab === "all" ? offers : offers.filter((o) => o.type === tab);
  const typeLabel = TYPE_LABEL[locale];

  async function toggleStatus(o: ConversionOffer, next: boolean) {
    const status: ConversionOffer["status"] = next ? "active" : "disabled";
    list.setData((prev) => (prev ?? []).map((x) => (x.id === o.id ? { ...x, status } : x)));
    try {
      await mockApi.saveOffer(workspaceId, { ...o, status });
      toast.success(next ? t.toastEnabled : t.toastDisabled);
    } catch (err) {
      toast.error(getErrorMessage(err));
      reload();
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    await mockApi.deleteOffer(workspaceId, deleting.id);
    toast.success(t.toastDeleted);
    setDeleting(null);
    reload();
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={<Button onClick={() => setFormTarget("new")}>{t.createOffer}</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard label={t.kpiRevenue} value={<bdi>{formatMoney(kpis.revenue)}</bdi>} hint={t.kpiRevenueHint} icon={<Sparkles />} />
        <KpiCard label={t.kpiRate} value={<span dir="ltr">{kpis.rate.toFixed(1)}%</span>} hint={t.kpiRateHint} icon={<Check />} />
        <KpiCard label={t.kpiActive} value={kpis.active} hint={fmt(t.kpiActiveHint, { n: offers.length })} icon={<Gift />} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v) as TabKey)} className="mb-4 max-w-full overflow-x-auto">
        <TabsList variant="line">
          {TAB_KEYS.map((key) => (
            <TabsTrigger key={key} value={key}>
              {TAB_LABEL[locale][key]}
              <span className="ms-1 rounded-full bg-line/60 px-1.5 text-[10px] tabular-nums text-ink-soft">
                {key === "all" ? offers.length : offers.filter((o) => o.type === key).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataState
        loading={list.loading}
        error={list.error}
        empty={visible.length === 0}
        emptyMessage={tab === "all" ? t.emptyAll : fmt(t.emptyType, { type: typeLabel[tab] })}
        onRetry={() => list.refresh()}
      >
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-start text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 text-start font-medium">{t.colOffer}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colType}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colTrigger}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colOffered}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colDiscount}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colImpressions}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colRevenue}</th>
                <th className="px-4 py-3 text-start font-medium">{c.status}</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">{c.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => {
                const Icon = TYPE_ICON[o.type];
                return (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="max-w-[260px] px-4 py-3">
                      <p className="truncate font-medium text-ink">{o.name}</p>
                      <p className="truncate text-xs text-ink-soft">{o.headline}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", TYPE_TONE[o.type])}>
                        <Icon className="size-3" aria-hidden />
                        {typeLabel[o.type]}
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-ink-soft">{triggerDisplay(o.triggerLabel, t)}</td>
                    <td className="max-w-[200px] px-4 py-3 text-ink-soft">
                      {o.products.length === 0 ? (
                        "—"
                      ) : (
                        <span className="truncate">
                          {o.products.map((p) => `${p.quantity > 1 ? `${p.quantity}× ` : ""}${p.productName}`).join(locale === "ar" ? "، " : ", ")}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{discountLabel(o, t)}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-soft">
                      <bdi>{o.impressions.toLocaleString()}</bdi>
                      <ArrowRight className="mx-1 inline size-3 rtl:rotate-180" aria-hidden />
                      <bdi>{o.accepted.toLocaleString()}</bdi>
                      <span className="ms-1 text-xs text-primary" dir="ltr">
                        ({acceptanceRate(o).toFixed(1)}%)
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink">
                      <bdi>{formatMoney(o.revenueAmount)}</bdi>
                    </td>
                    <td className="px-4 py-3">
                      <Toggle checked={o.status === "active"} onChange={(next) => toggleStatus(o, next)} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-end">
                      <Button size="icon-sm" variant="ghost" aria-label={fmt(t.editAria, { name: o.name })} title={c.edit} onClick={() => setFormTarget(o)}>
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={fmt(t.deleteAria, { name: o.name })}
                        title={c.delete}
                        className="text-danger hover:bg-danger-soft"
                        onClick={() => setDeleting(o)}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataState>

      <Modal
        open={formTarget !== null}
        onClose={() => setFormTarget(null)}
        title={formTarget === "new" ? t.createOffer : t.editOffer}
        className="max-w-4xl"
      >
        {formTarget !== null && (
          <OfferForm
            key={formTarget === "new" ? "new" : formTarget.id}
            offer={formTarget === "new" ? undefined : formTarget}
            products={products.data ?? []}
            productsLoading={products.loading}
            onCancel={() => setFormTarget(null)}
            onDone={() => {
              setFormTarget(null);
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? fmt(t.confirmTitleNamed, { name: deleting.name }) : t.confirmTitle}
        description={t.confirmDescription}
        confirmLabel={t.confirmLabel}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// ------------------------------------------------------------------ Form --

interface TierRow {
  quantity: string;
  percent: string;
}

function OfferForm({
  offer,
  products,
  productsLoading,
  onDone,
  onCancel,
}: {
  offer?: ConversionOffer;
  products: DemoProduct[];
  productsLoading: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT(FORM_STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const isEdit = Boolean(offer);

  const [type, setType] = useState<ConversionOfferType>(offer?.type ?? "order_bump");
  const [name, setName] = useState(offer?.name ?? "");
  const [headline, setHeadline] = useState(offer?.headline ?? "");
  const [triggerIds, setTriggerIds] = useState<string[]>(offer?.triggerProductIds ?? []);
  const [offered, setOffered] = useState<OfferProductRef[]>(offer?.products ?? []);
  const [discountType, setDiscountType] = useState<ConversionOffer["discountType"]>(offer?.discountType ?? "none");
  const [discountValue, setDiscountValue] = useState(() => {
    if (!offer) return "";
    if (offer.discountType === "percentage") return basisPointsToPercentInput(offer.discountValue);
    if (offer.discountType === "fixed") return minorToMajorInput(offer.discountValue);
    return "";
  });
  const [tiers, setTiers] = useState<TierRow[]>(
    offer?.tiers.length
      ? offer.tiers.map((tier) => ({ quantity: String(tier.quantity), percent: basisPointsToPercentInput(tier.discountBasisPoints) }))
      : [
          { quantity: "2", percent: "10" },
          { quantity: "3", percent: "20" },
        ]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const hasTrigger = type !== "downsell";
  const isBundle = type === "bundle";

  function toggleTrigger(id: string) {
    setTriggerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleOffered(p: DemoProduct) {
    setOffered((prev) =>
      prev.some((x) => x.productId === p.id)
        ? prev.filter((x) => x.productId !== p.id)
        : [...prev, { productId: p.id, productName: p.name, quantity: 1 }]
    );
  }

  function setOfferedQty(id: string, qty: number) {
    setOffered((prev) => prev.map((x) => (x.productId === id ? { ...x, quantity: Math.max(1, qty) } : x)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t.errName;
    if (!headline.trim()) errs.headline = t.errHeadline;
    if (type !== "downsell" && offered.length === 0) errs.offered = t.errOffered;

    let value = 0;
    if (!isBundle && discountType === "percentage") {
      value = percentToBasisPoints(discountValue);
      if (!Number.isFinite(value) || value < 0 || value > 10000) errs.discount = t.errPercent;
    }
    if (!isBundle && discountType === "fixed") {
      value = majorToMinor(discountValue);
      if (!Number.isFinite(value) || value < 0) errs.discount = t.errAmount;
    }

    let parsedTiers: ConversionOffer["tiers"] = [];
    if (isBundle) {
      parsedTiers = tiers.map((tier) => ({ quantity: Math.floor(Number(tier.quantity)), discountBasisPoints: percentToBasisPoints(tier.percent) }));
      if (
        parsedTiers.length === 0 ||
        parsedTiers.some(
          (tier) =>
            !Number.isFinite(tier.quantity) ||
            tier.quantity < 2 ||
            !Number.isFinite(tier.discountBasisPoints) ||
            tier.discountBasisPoints < 0 ||
            tier.discountBasisPoints > 10000
        )
      ) {
        errs.tiers = t.errTiers;
      }
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    // Stored labels stay in English so saved data is locale-independent; the table translates them on display.
    const triggerLabel = hasTrigger
      ? triggerIds.length === 0
        ? TRIGGER_ANY_PRODUCT
        : products.filter((p) => triggerIds.includes(p.id)).map((p) => p.name).join(" + ")
      : TRIGGER_ANY_ORDER_ON_CANCEL;

    const next: ConversionOffer = {
      id: offer?.id ?? uid(),
      workspaceId,
      type,
      name: name.trim(),
      headline: headline.trim(),
      status: offer?.status ?? "active",
      triggerProductIds: hasTrigger ? triggerIds : [],
      triggerLabel,
      products: offered,
      discountType: isBundle ? "none" : discountType,
      discountValue: isBundle || discountType === "none" ? 0 : value,
      tiers: isBundle ? parsedTiers : [],
      impressions: offer?.impressions ?? 0,
      accepted: offer?.accepted ?? 0,
      revenueAmount: offer?.revenueAmount ?? "0",
      createdAt: offer?.createdAt ?? nowIso(),
    };

    setSaving(true);
    try {
      await mockApi.saveOffer(workspaceId, next);
      toast.success(isEdit ? t.toastSaved : t.toastCreated);
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const previewOffer: ConversionOffer = {
    id: "preview",
    workspaceId,
    type,
    name,
    headline,
    status: "active",
    triggerProductIds: triggerIds,
    triggerLabel: "",
    products: offered,
    discountType: isBundle ? "none" : discountType,
    discountValue:
      discountType === "percentage" ? percentToBasisPoints(discountValue) || 0 : discountType === "fixed" ? majorToMinor(discountValue) || 0 : 0,
    tiers: tiers.map((tier) => ({ quantity: Number(tier.quantity) || 0, discountBasisPoints: percentToBasisPoints(tier.percent) || 0 })),
    impressions: 0,
    accepted: 0,
    revenueAmount: "0",
    createdAt: nowIso(),
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <Field label={t.offerType} hint={TYPE_HINT[locale][type]}>
          {({ id }) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as ConversionOfferType)} disabled={isEdit}>
              {OFFER_TYPES.map((key) => (
                <option key={key} value={key}>
                  {TYPE_LABEL[locale][key]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <TextField label={t.name} required value={name} onChange={(e) => setName(e.target.value)} error={fieldErrors.name} placeholder={t.namePlaceholder} />

        <Field label={t.headline} required error={fieldErrors.headline} hint={t.headlineHint}>
          {({ id, ...aria }) => (
            <Textarea id={id} {...aria} value={headline} onChange={(e) => setHeadline(e.target.value)} rows={2} placeholder={t.headlinePlaceholder} />
          )}
        </Field>

        {hasTrigger && (
          <div className="space-y-1.5">
            <Label>{t.triggerProducts}</Label>
            <p className="text-xs text-ink-soft">{t.triggerHint}</p>
            <ProductChecklist products={products} loading={productsLoading} selected={triggerIds} onToggle={toggleTrigger} />
          </div>
        )}

        {type !== "downsell" && (
          <div className="space-y-1.5">
            <Label>
              {t.offeredProducts} <span className="text-danger">*</span>
            </Label>
            <ProductChecklist
              products={products}
              loading={productsLoading}
              selected={offered.map((o) => o.productId)}
              onToggle={(id) => {
                const p = products.find((x) => x.id === id);
                if (p) toggleOffered(p);
              }}
              renderExtra={(p) => {
                const row = offered.find((o) => o.productId === p.id);
                if (!row) return null;
                return (
                  <span className="ms-auto flex items-center gap-1 text-xs text-ink-soft">
                    {t.qty}
                    <Input
                      type="number"
                      min={1}
                      value={row.quantity}
                      aria-label={fmt(t.qtyAria, { name: p.name })}
                      onChange={(e) => setOfferedQty(p.id, Number(e.target.value))}
                      className="h-7 w-16 px-2 text-xs"
                    />
                  </span>
                );
              }}
            />
            {fieldErrors.offered && <p className="text-xs font-medium text-danger">{fieldErrors.offered}</p>}
          </div>
        )}

        {isBundle ? (
          <div className="space-y-2">
            <Label>{t.quantityTiers}</Label>
            <div className="space-y-2 rounded-2xl border border-line p-3">
              {tiers.map((tier, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink-soft">{t.buy}</span>
                  <Input
                    type="number"
                    min={2}
                    value={tier.quantity}
                    aria-label={fmt(t.tierQtyAria, { n: i + 1 })}
                    onChange={(e) => setTiers((prev) => prev.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
                    className="w-20"
                  />
                  <span className="text-xs text-ink-soft">{t.get}</span>
                  <div className="relative w-24">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={tier.percent}
                      aria-label={fmt(t.tierPctAria, { n: i + 1 })}
                      onChange={(e) => setTiers((prev) => prev.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)))}
                      className="pe-7"
                    />
                    <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-2 text-xs text-ink-soft">%</span>
                  </div>
                  {t.off && <span className="text-xs text-ink-soft">{t.off}</span>}
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="ms-auto text-danger"
                    aria-label={t.removeTier}
                    title={t.removeTier}
                    onClick={() => setTiers((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setTiers((prev) => [...prev, { quantity: String((Number(prev[prev.length - 1]?.quantity) || 1) + 1), percent: "" }])}
              >
                {t.addTier}
              </Button>
            </div>
            {fieldErrors.tiers && <p className="text-xs font-medium text-danger">{fieldErrors.tiers}</p>}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.discount}>
              {({ id }) => (
                <Select id={id} value={discountType} onChange={(e) => setDiscountType(e.target.value as ConversionOffer["discountType"])}>
                  <option value="none">{t.noDiscount}</option>
                  <option value="percentage">{t.percentageOff}</option>
                  <option value="fixed">{t.fixedOff}</option>
                </Select>
              )}
            </Field>
            {discountType === "percentage" && (
              <Field label={t.percentage} required error={fieldErrors.discount}>
                {({ id, ...aria }) => (
                  <div className="relative">
                    <Input id={id} {...aria} type="number" min={0} max={100} step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="pe-8" />
                    <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-ink-soft">%</span>
                  </div>
                )}
              </Field>
            )}
            {discountType === "fixed" && <MoneyInput label={t.amountOff} required value={discountValue} onChange={setDiscountValue} error={fieldErrors.discount} />}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {c.cancel}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? c.saving : isEdit ? t.saveOffer : t.createOffer}
          </Button>
        </div>
      </div>

      <div className="min-w-0 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{t.preview}</p>
        <OfferPreview offer={previewOffer} products={products} />
        <p className="text-xs text-ink-soft">{t.previewNote}</p>
      </div>
    </form>
  );
}

function ProductChecklist({
  products,
  loading,
  selected,
  onToggle,
  renderExtra,
}: {
  products: DemoProduct[];
  loading: boolean;
  selected: string[];
  onToggle: (id: string) => void;
  renderExtra?: (p: DemoProduct) => ReactNode;
}) {
  if (loading) return <Spinner className="size-4" />;
  return (
    <div className="max-h-44 space-y-1 overflow-y-auto rounded-2xl border border-line p-2">
      {products.map((p) => (
        <label key={p.id} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm text-ink hover:bg-paper-raised">
          <input type="checkbox" checked={selected.includes(p.id)} onChange={() => onToggle(p.id)} />
          <span className="truncate">{p.name}</span>
          <bdi className="text-xs text-ink-soft">{formatMoney(p.price)}</bdi>
          {renderExtra?.(p)}
        </label>
      ))}
    </div>
  );
}

// --------------------------------------------------------------- Preview --

function discountedPrice(base: number, offer: ConversionOffer): number {
  if (offer.discountType === "percentage") return Math.max(0, Math.round(base * (1 - offer.discountValue / 10000)));
  if (offer.discountType === "fixed") return Math.max(0, base - offer.discountValue);
  return base;
}

function OfferPreview({ offer, products }: { offer: ConversionOffer; products: DemoProduct[] }) {
  const t = useT(PREVIEW_STRINGS);
  const pt = useT(PAGE_STRINGS);
  const c = useCommon();
  const [checked, setChecked] = useState(true);
  const [tier, setTier] = useState(0);
  const first = offer.products[0];
  const firstProduct = products.find((p) => p.id === first?.productId);
  const basePrice = (firstProduct?.price ?? 0) * (first?.quantity ?? 1);
  const hasDiscount = offer.discountType !== "none" && offer.discountValue > 0;
  const finalPrice = discountedPrice(basePrice, offer);
  const headline = offer.headline || t.headlinePlaceholder;
  const productName = first?.productName ?? t.offeredProduct;

  const frame = "rounded-2xl border border-line bg-paper p-3";

  if (offer.type === "order_bump") {
    return (
      <div className={frame}>
        <div className="mb-2 h-2 w-24 rounded bg-line/60" />
        <div className="mb-2 h-2 w-40 rounded bg-line/40" />
        <label className={cn("flex cursor-pointer gap-3 rounded-lg border-2 border-dashed p-3 transition-colors", checked ? "border-accent bg-accent-soft/40" : "border-line")}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-dark">{t.bumpCheck}</p>
            <p className="mt-1 text-sm font-medium text-ink">{headline}</p>
            <p className="mt-1 truncate text-xs text-ink-soft">{productName}</p>
            <p className="mt-1 text-sm">
              {hasDiscount && <bdi className="me-2 text-ink-soft line-through">{formatMoney(basePrice)}</bdi>}
              <bdi className="font-semibold text-ink">{formatMoney(finalPrice)}</bdi>
            </p>
          </div>
        </label>
        <div className="mt-3 h-9 rounded-lg bg-primary/90 text-center text-xs font-medium leading-9 text-white">{t.placeOrder}</div>
      </div>
    );
  }

  if (offer.type === "post_purchase_upsell" || offer.type === "downsell") {
    return (
      <div className={frame}>
        <p className="mb-2 text-center text-xs text-success">✓ {t.orderPlaced}</p>
        <div className="rounded-lg border border-line bg-paper-raised p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{offer.type === "downsell" ? t.waitBeforeYouGo : t.oneTimeOffer}</p>
          <p className="mt-1 text-sm font-medium text-ink">{headline}</p>
          {first && (
            <div className="mt-2 flex items-center gap-2">
              <div className="size-10 shrink-0 rounded bg-line/60" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-ink">{productName}</p>
                <p className="text-sm">
                  {hasDiscount && <bdi className="me-2 text-ink-soft line-through">{formatMoney(basePrice)}</bdi>}
                  <bdi className="font-semibold text-ink">{formatMoney(finalPrice)}</bdi>
                </p>
              </div>
            </div>
          )}
          {offer.type === "downsell" && !first && hasDiscount && (
            <p className="mt-2 text-lg font-semibold text-ink">
              {offer.discountType === "percentage"
                ? fmt(pt.pctOff, { pct: basisPointsToPercentInput(offer.discountValue) })
                : fmt(pt.amountOff, { amount: formatMoney(offer.discountValue) })}
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="h-9 rounded-lg bg-primary text-center text-xs font-medium leading-9 text-white">{offer.type === "downsell" ? t.keepOrder : t.yesAdd}</div>
            <div className="h-9 rounded-lg border border-line text-center text-xs font-medium leading-9 text-ink-soft">{offer.type === "downsell" ? t.cancelAnyway : t.noThanks}</div>
          </div>
        </div>
      </div>
    );
  }

  if (offer.type === "bundle") {
    const unit = firstProduct?.price ?? 0;
    const validTiers = offer.tiers.filter((x) => x.quantity >= 1);
    const options = [{ quantity: 1, discountBasisPoints: 0 }, ...validTiers];
    return (
      <div className={frame}>
        <p className="text-sm font-medium text-ink">{headline}</p>
        <p className="mt-0.5 truncate text-xs text-ink-soft">{productName}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((opt, i) => {
            const total = Math.round(unit * opt.quantity * (1 - opt.discountBasisPoints / 10000));
            const active = tier === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setTier(i)}
                className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", active ? "border-primary bg-primary-soft text-primary-dark" : "border-line text-ink-soft hover:border-primary/40")}
              >
                <bdi className="font-semibold">{opt.quantity}×</bdi>
                {opt.discountBasisPoints > 0 && (
                  <span className="ms-1" dir="ltr">
                    −{basisPointsToPercentInput(opt.discountBasisPoints)}%
                  </span>
                )}
                <bdi className="ms-1 opacity-70">{formatMoney(total)}</bdi>
              </button>
            );
          })}
        </div>
        <div className="mt-3 h-9 rounded-lg bg-primary/90 text-center text-xs font-medium leading-9 text-white">{t.addToCart}</div>
      </div>
    );
  }

  // cross_sell
  return (
    <div className={frame}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.cart}</p>
      <div className="mt-2 h-2 w-32 rounded bg-line/60" />
      <p className="mt-3 text-sm font-medium text-ink">{headline}</p>
      <div className="mt-2 space-y-2">
        {(offer.products.length ? offer.products : [{ productId: "x", productName: t.offeredProduct, quantity: 1 }]).map((p) => {
          const base = (products.find((x) => x.id === p.productId)?.price ?? 0) * p.quantity;
          return (
            <div key={p.productId} className="flex items-center gap-2 rounded-lg border border-line p-2">
              <div className="size-9 shrink-0 rounded bg-line/60" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-ink">{p.productName}</p>
                <p className="text-xs">
                  {hasDiscount && <bdi className="me-1 text-ink-soft line-through">{formatMoney(base)}</bdi>}
                  <bdi className="font-semibold text-ink">{formatMoney(discountedPrice(base, offer))}</bdi>
                </p>
              </div>
              <span className="rounded-md border border-primary px-2 py-1 text-[11px] font-medium text-primary">{c.add}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
