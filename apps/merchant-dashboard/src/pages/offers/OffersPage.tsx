import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Input, Label, Spinner, Tabs, TabsList, TabsTrigger, cn } from "@store-builder/ui";
import { Gift, Layers, Pencil, ShoppingBag, Sparkles, Trash2, TrendingDown, Check } from "lucide-react";
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

type DemoProduct = { id: string; name: string; price: number };
type TabKey = "all" | ConversionOfferType;

const TYPE_LABEL: Record<ConversionOfferType, string> = {
  order_bump: "Order bump",
  post_purchase_upsell: "Post-purchase upsell",
  cross_sell: "Cross-sell",
  downsell: "Downsell",
  bundle: "Bundle",
};

const TYPE_HINT: Record<ConversionOfferType, string> = {
  order_bump: "A one-click add-on shown as a checkbox on the checkout page.",
  post_purchase_upsell: "Shown right after the order is placed — accepted with one tap, no re-entering details.",
  cross_sell: "Related products suggested in the cart drawer (“customers also bought”).",
  downsell: "A discount offered when the customer tries to cancel or declines an upsell.",
  bundle: "Quantity breaks — buy more of the same product for a bigger discount.",
};

const TYPE_TONE: Record<ConversionOfferType, string> = {
  order_bump: "bg-primary-soft text-primary-dark",
  post_purchase_upsell: "bg-accent-soft text-accent-dark",
  cross_sell: "bg-success-soft text-success",
  downsell: "bg-danger-soft text-danger",
  bundle: "bg-paper text-ink-soft border border-line",
};

const TYPE_ICON: Record<ConversionOfferType, typeof Gift> = {
  order_bump: Gift,
  post_purchase_upsell: Sparkles,
  cross_sell: ShoppingBag,
  downsell: TrendingDown,
  bundle: Layers,
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "order_bump", label: "Order bumps" },
  { key: "post_purchase_upsell", label: "Post-purchase upsells" },
  { key: "cross_sell", label: "Cross-sell" },
  { key: "downsell", label: "Downsell" },
  { key: "bundle", label: "Bundles" },
];

function discountLabel(o: ConversionOffer): string {
  if (o.type === "bundle") {
    if (o.tiers.length === 0) return "—";
    return o.tiers.map((t) => `${t.quantity}× → ${basisPointsToPercentInput(t.discountBasisPoints)}%`).join(" · ");
  }
  if (o.discountType === "percentage") return `${basisPointsToPercentInput(o.discountValue)}% off`;
  if (o.discountType === "fixed") return `${formatMoney(o.discountValue)} off`;
  return "No discount";
}

function acceptanceRate(o: ConversionOffer): number {
  return o.impressions > 0 ? (o.accepted / o.impressions) * 100 : 0;
}

export function OffersPage() {
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

  async function toggleStatus(o: ConversionOffer, next: boolean) {
    const status: ConversionOffer["status"] = next ? "active" : "disabled";
    list.setData((prev) => (prev ?? []).map((x) => (x.id === o.id ? { ...x, status } : x)));
    try {
      await mockApi.saveOffer(workspaceId, { ...o, status });
      toast.success(next ? "Offer enabled." : "Offer disabled.");
    } catch (err) {
      toast.error(getErrorMessage(err));
      reload();
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    await mockApi.deleteOffer(workspaceId, deleting.id);
    toast.success("Offer deleted.");
    setDeleting(null);
    reload();
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Offers & bundles"
        description="Order bumps, upsells, cross-sells and quantity bundles that lift average order value."
        actions={<Button onClick={() => setFormTarget("new")}>Create offer</Button>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Extra revenue from offers" value={formatMoney(kpis.revenue)} hint="All time, accepted offers only" icon={<Sparkles />} />
        <KpiCard label="Acceptance rate" value={`${kpis.rate.toFixed(1)}%`} hint="Accepted ÷ impressions" icon={<Check />} />
        <KpiCard label="Active offers" value={kpis.active} hint={`${offers.length} total`} icon={<Gift />} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v) as TabKey)} className="mb-4">
        <TabsList variant="line">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
              <span className="ml-1 rounded-full bg-line/60 px-1.5 text-[10px] text-ink-soft">
                {t.key === "all" ? offers.length : offers.filter((o) => o.type === t.key).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataState
        loading={list.loading}
        error={list.error}
        empty={visible.length === 0}
        emptyMessage={tab === "all" ? "No offers yet. Create your first one." : `No ${TYPE_LABEL[tab as ConversionOfferType].toLowerCase()} offers yet.`}
        onRetry={() => list.refresh()}
      >
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Offer</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Trigger</th>
                <th className="px-4 py-3 font-medium">Offered</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Impressions → accepted</th>
                <th className="px-4 py-3 font-medium">Revenue</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => {
                const Icon = TYPE_ICON[o.type];
                return (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-paper-raised">
                    <td className="max-w-[260px] px-4 py-3">
                      <p className="truncate font-medium text-ink">{o.name}</p>
                      <p className="truncate text-xs text-ink-soft">{o.headline}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", TYPE_TONE[o.type])}>
                        <Icon className="size-3" />
                        {TYPE_LABEL[o.type]}
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-ink-soft">{o.triggerLabel || "—"}</td>
                    <td className="max-w-[200px] px-4 py-3 text-ink-soft">
                      {o.products.length === 0 ? (
                        "—"
                      ) : (
                        <span className="truncate">
                          {o.products.map((p) => `${p.quantity > 1 ? `${p.quantity}× ` : ""}${p.productName}`).join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{discountLabel(o)}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-soft">
                      {o.impressions.toLocaleString()} → {o.accepted.toLocaleString()}
                      <span className="ml-1 text-xs text-success">({acceptanceRate(o).toFixed(1)}%)</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink">{formatMoney(o.revenueAmount)}</td>
                    <td className="px-4 py-3">
                      <Toggle checked={o.status === "active"} onChange={(next) => toggleStatus(o, next)} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setFormTarget(o)}>
                        <Pencil />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Delete" className="text-danger hover:bg-danger-soft" onClick={() => setDeleting(o)}>
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
        title={formTarget === "new" ? "Create offer" : "Edit offer"}
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
        title={deleting ? `Delete "${deleting.name}"?` : "Delete offer?"}
        description="The offer stops showing immediately. Historical revenue stays in reports."
        confirmLabel="Delete offer"
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
      ? offer.tiers.map((t) => ({ quantity: String(t.quantity), percent: basisPointsToPercentInput(t.discountBasisPoints) }))
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
    if (!name.trim()) errs.name = "Give the offer a name.";
    if (!headline.trim()) errs.headline = "Write the headline customers will see.";
    if (type !== "downsell" && offered.length === 0) errs.offered = "Pick at least one product to offer.";

    let value = 0;
    if (!isBundle && discountType === "percentage") {
      value = percentToBasisPoints(discountValue);
      if (!Number.isFinite(value) || value < 0 || value > 10000) errs.discount = "Enter a percentage between 0 and 100.";
    }
    if (!isBundle && discountType === "fixed") {
      value = majorToMinor(discountValue);
      if (!Number.isFinite(value) || value < 0) errs.discount = "Enter a valid amount.";
    }

    let parsedTiers: ConversionOffer["tiers"] = [];
    if (isBundle) {
      parsedTiers = tiers.map((t) => ({ quantity: Math.floor(Number(t.quantity)), discountBasisPoints: percentToBasisPoints(t.percent) }));
      if (parsedTiers.length === 0 || parsedTiers.some((t) => !Number.isFinite(t.quantity) || t.quantity < 2 || !Number.isFinite(t.discountBasisPoints) || t.discountBasisPoints < 0 || t.discountBasisPoints > 10000)) {
        errs.tiers = "Each tier needs a quantity of 2+ and a percentage between 0 and 100.";
      }
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    const triggerLabel = hasTrigger
      ? triggerIds.length === 0
        ? "Any product"
        : products.filter((p) => triggerIds.includes(p.id)).map((p) => p.name).join(" + ")
      : "Any order on cancel";

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
      toast.success(isEdit ? "Offer saved." : "Offer created.");
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
    tiers: tiers.map((t) => ({ quantity: Number(t.quantity) || 0, discountBasisPoints: percentToBasisPoints(t.percent) || 0 })),
    impressions: 0,
    accepted: 0,
    revenueAmount: "0",
    createdAt: nowIso(),
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <Field label="Offer type" hint={TYPE_HINT[type]}>
          {({ id }) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as ConversionOfferType)} disabled={isEdit}>
              {(Object.keys(TYPE_LABEL) as ConversionOfferType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} error={fieldErrors.name} placeholder="Internal name" />

        <Field label="Headline" required error={fieldErrors.headline} hint="What the customer sees. Arabic is fine.">
          {({ id, ...aria }) => (
            <Textarea id={id} {...aria} value={headline} onChange={(e) => setHeadline(e.target.value)} rows={2} placeholder="أضف … بخصم خاص — عرض لمرة واحدة" />
          )}
        </Field>

        {hasTrigger && (
          <div className="space-y-1.5">
            <Label>Trigger products</Label>
            <p className="text-xs text-ink-soft">Show this offer when the cart contains any of these. Leave empty for all products.</p>
            <ProductChecklist products={products} loading={productsLoading} selected={triggerIds} onToggle={toggleTrigger} />
          </div>
        )}

        {type !== "downsell" && (
          <div className="space-y-1.5">
            <Label>
              Offered products <span className="text-danger">*</span>
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
                  <span className="ml-auto flex items-center gap-1 text-xs text-ink-soft">
                    Qty
                    <Input type="number" min={1} value={row.quantity} onChange={(e) => setOfferedQty(p.id, Number(e.target.value))} className="h-7 w-16 px-2 text-xs" />
                  </span>
                );
              }}
            />
            {fieldErrors.offered && <p className="text-xs font-medium text-danger">{fieldErrors.offered}</p>}
          </div>
        )}

        {isBundle ? (
          <div className="space-y-2">
            <Label>Quantity tiers</Label>
            <div className="space-y-2 rounded-[var(--radius-card)] border border-line p-3">
              {tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-ink-soft">Buy</span>
                  <Input type="number" min={2} value={t.quantity} onChange={(e) => setTiers((prev) => prev.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} className="w-20" />
                  <span className="text-xs text-ink-soft">get</span>
                  <div className="relative w-24">
                    <Input type="number" min={0} max={100} value={t.percent} onChange={(e) => setTiers((prev) => prev.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)))} className="pr-7" />
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-xs text-ink-soft">%</span>
                  </div>
                  <span className="text-xs text-ink-soft">off</span>
                  <Button type="button" size="icon-sm" variant="ghost" className="ml-auto text-danger" aria-label="Remove tier" onClick={() => setTiers((prev) => prev.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => setTiers((prev) => [...prev, { quantity: String((Number(prev[prev.length - 1]?.quantity) || 1) + 1), percent: "" }])}>
                Add tier
              </Button>
            </div>
            {fieldErrors.tiers && <p className="text-xs font-medium text-danger">{fieldErrors.tiers}</p>}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Discount">
              {({ id }) => (
                <Select id={id} value={discountType} onChange={(e) => setDiscountType(e.target.value as ConversionOffer["discountType"])}>
                  <option value="none">No discount</option>
                  <option value="percentage">Percentage off</option>
                  <option value="fixed">Fixed amount off</option>
                </Select>
              )}
            </Field>
            {discountType === "percentage" && (
              <Field label="Percentage" required error={fieldErrors.discount}>
                {({ id, ...aria }) => (
                  <div className="relative">
                    <Input id={id} {...aria} type="number" min={0} max={100} step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="pr-8" />
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-ink-soft">%</span>
                  </div>
                )}
              </Field>
            )}
            {discountType === "fixed" && <MoneyInput label="Amount off" required value={discountValue} onChange={setDiscountValue} error={fieldErrors.discount} />}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save offer" : "Create offer"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Preview</p>
        <OfferPreview offer={previewOffer} products={products} />
        <p className="text-xs text-ink-soft">Approximation of how the offer renders in the storefront checkout.</p>
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
    <div className="max-h-44 space-y-1 overflow-y-auto rounded-[var(--radius-card)] border border-line p-2">
      {products.map((p) => (
        <label key={p.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm text-ink hover:bg-paper-raised">
          <input type="checkbox" checked={selected.includes(p.id)} onChange={() => onToggle(p.id)} />
          <span className="truncate">{p.name}</span>
          <span className="text-xs text-ink-soft">{formatMoney(p.price)}</span>
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
  const [checked, setChecked] = useState(true);
  const [tier, setTier] = useState(0);
  const first = offer.products[0];
  const firstProduct = products.find((p) => p.id === first?.productId);
  const basePrice = (firstProduct?.price ?? 0) * (first?.quantity ?? 1);
  const hasDiscount = offer.discountType !== "none" && offer.discountValue > 0;
  const finalPrice = discountedPrice(basePrice, offer);
  const headline = offer.headline || "Your headline appears here";
  const productName = first?.productName ?? "Offered product";

  const frame = "rounded-[var(--radius-card)] border border-line bg-paper p-3";

  if (offer.type === "order_bump") {
    return (
      <div className={frame}>
        <div className="mb-2 h-2 w-24 rounded bg-line/60" />
        <div className="mb-2 h-2 w-40 rounded bg-line/40" />
        <label className={cn("flex cursor-pointer gap-3 rounded-lg border-2 border-dashed p-3 transition-colors", checked ? "border-accent bg-accent-soft/40" : "border-line")}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-dark">Yes, add this to my order</p>
            <p className="mt-1 text-sm font-medium text-ink">{headline}</p>
            <p className="mt-1 truncate text-xs text-ink-soft">{productName}</p>
            <p className="mt-1 text-sm">
              {hasDiscount && <span className="mr-2 text-ink-soft line-through">{formatMoney(basePrice)}</span>}
              <span className="font-semibold text-ink">{formatMoney(finalPrice)}</span>
            </p>
          </div>
        </label>
        <div className="mt-3 h-9 rounded-lg bg-primary/90 text-center text-xs font-medium leading-9 text-white">Place order — COD</div>
      </div>
    );
  }

  if (offer.type === "post_purchase_upsell" || offer.type === "downsell") {
    return (
      <div className={frame}>
        <p className="mb-2 text-center text-xs text-success">✓ Order placed</p>
        <div className="rounded-lg border border-line bg-paper-raised p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{offer.type === "downsell" ? "Wait — before you go" : "One-time offer"}</p>
          <p className="mt-1 text-sm font-medium text-ink">{headline}</p>
          {first && (
            <div className="mt-2 flex items-center gap-2">
              <div className="size-10 shrink-0 rounded bg-line/60" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-ink">{productName}</p>
                <p className="text-sm">
                  {hasDiscount && <span className="mr-2 text-ink-soft line-through">{formatMoney(basePrice)}</span>}
                  <span className="font-semibold text-ink">{formatMoney(finalPrice)}</span>
                </p>
              </div>
            </div>
          )}
          {offer.type === "downsell" && !first && hasDiscount && (
            <p className="mt-2 text-lg font-semibold text-ink">{offer.discountType === "percentage" ? `${basisPointsToPercentInput(offer.discountValue)}% off` : `${formatMoney(offer.discountValue)} off`}</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="h-9 rounded-lg bg-primary text-center text-xs font-medium leading-9 text-white">{offer.type === "downsell" ? "Keep my order" : "Yes, add it"}</div>
            <div className="h-9 rounded-lg border border-line text-center text-xs font-medium leading-9 text-ink-soft">{offer.type === "downsell" ? "Cancel anyway" : "No thanks"}</div>
          </div>
        </div>
      </div>
    );
  }

  if (offer.type === "bundle") {
    const unit = firstProduct?.price ?? 0;
    const validTiers = offer.tiers.filter((t) => t.quantity >= 1);
    const options = [{ quantity: 1, discountBasisPoints: 0 }, ...validTiers];
    return (
      <div className={frame}>
        <p className="text-sm font-medium text-ink">{headline}</p>
        <p className="mt-0.5 truncate text-xs text-ink-soft">{productName}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((t, i) => {
            const total = Math.round(unit * t.quantity * (1 - t.discountBasisPoints / 10000));
            const active = tier === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setTier(i)}
                className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", active ? "border-primary bg-primary-soft text-primary-dark" : "border-line text-ink-soft hover:border-primary/40")}
              >
                <span className="font-semibold">{t.quantity}×</span>
                {t.discountBasisPoints > 0 && <span className="ml-1">−{basisPointsToPercentInput(t.discountBasisPoints)}%</span>}
                <span className="ml-1 opacity-70">{formatMoney(total)}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 h-9 rounded-lg bg-primary/90 text-center text-xs font-medium leading-9 text-white">Add to cart</div>
      </div>
    );
  }

  // cross_sell
  return (
    <div className={frame}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Cart</p>
      <div className="mt-2 h-2 w-32 rounded bg-line/60" />
      <p className="mt-3 text-sm font-medium text-ink">{headline}</p>
      <div className="mt-2 space-y-2">
        {(offer.products.length ? offer.products : [{ productId: "x", productName: "Offered product", quantity: 1 }]).map((p) => {
          const base = (products.find((x) => x.id === p.productId)?.price ?? 0) * p.quantity;
          return (
            <div key={p.productId} className="flex items-center gap-2 rounded-lg border border-line p-2">
              <div className="size-9 shrink-0 rounded bg-line/60" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-ink">{p.productName}</p>
                <p className="text-xs">
                  {hasDiscount && <span className="mr-1 text-ink-soft line-through">{formatMoney(base)}</span>}
                  <span className="font-semibold text-ink">{formatMoney(discountedPrice(base, offer))}</span>
                </p>
              </div>
              <span className="rounded-md border border-primary px-2 py-1 text-[11px] font-medium text-primary">Add</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
