import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Badge } from "@store-builder/ui";
import {
  profitGetEconomics,
  profitResetProductEconomics,
  profitSaveDefaults,
  profitSaveProductEconomics,
  type ProfitEconomics,
  type ProfitEconomicsProduct,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
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
import { DataTable, type Column } from "@/components/DataTable";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { MoneyInput } from "@/components/MoneyInput";
import { Section } from "@/components/Section";
import { useToast } from "@/components/Toast";
import { useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Costs",
    description: "What every order really costs you. The profit report uses these numbers; a product can override the store defaults.",
    back: "Real profit",
    defaultsTitle: "Store defaults",
    defaultsDesc: "Used for every product that has no values of its own.",
    packaging: "Packaging per unit",
    shipping: "Courier charge per order",
    shippingHint: "What the courier charges you, not what the customer pays",
    returnCost: "Return charge per order",
    collection: "COD collection fee %",
    gateway: "Online payment fee %",
    damage: "Damaged or lost %",
    damageHint: "Share of the unit cost written off",
    save: "Save",
    saved: "Costs saved.",
    productsTitle: "Products",
    productsDesc: "Unit cost comes from each product's variants. Override the other costs only where a product differs.",
    product: "Product",
    unitCost: "Unit cost",
    price: "Price",
    costsCol: "Other costs",
    usesDefaults: "Store defaults",
    custom: "Custom",
    missingCost: "No unit cost",
    someMissing: "{n} variants without cost",
    edit: "Edit",
    editTitle: "Costs for {name}",
    editDesc: "Leave a field empty to use the store default.",
    reset: "Use store defaults",
    resetDone: "Now using the store defaults.",
    setUnitCost: "Set unit cost",
    invalid: "Enter a valid number",
    noProducts: "No products yet.",
  },
  ar: {
    title: "التكاليف",
    description: "ما يكلّفك كل طلب فعلًا. تقرير الأرباح يعتمد على هذه الأرقام، ويمكن لأي منتج أن يخالف افتراضيات المتجر.",
    back: "الأرباح الحقيقية",
    defaultsTitle: "افتراضيات المتجر",
    defaultsDesc: "تُستخدم لكل منتج ليست له قيم خاصة.",
    packaging: "التغليف لكل قطعة",
    shipping: "تكلفة الشحن لكل طلب",
    shippingHint: "ما تحاسبك عليه شركة الشحن، لا ما يدفعه العميل",
    returnCost: "تكلفة المرتجع لكل طلب",
    collection: "رسوم التحصيل عند الاستلام %",
    gateway: "رسوم الدفع الإلكتروني %",
    damage: "التالف أو المفقود %",
    damageHint: "نسبة من تكلفة القطعة تُحتسب خسارة",
    save: "حفظ",
    saved: "تم حفظ التكاليف.",
    productsTitle: "المنتجات",
    productsDesc: "تكلفة القطعة تأتي من أنواع كل منتج. غيّر باقي التكاليف فقط للمنتج الذي يختلف.",
    product: "المنتج",
    unitCost: "تكلفة القطعة",
    price: "السعر",
    costsCol: "باقي التكاليف",
    usesDefaults: "افتراضيات المتجر",
    custom: "خاصة",
    missingCost: "بدون تكلفة",
    someMissing: "{n} نوع بدون تكلفة",
    edit: "تعديل",
    editTitle: "تكاليف {name}",
    editDesc: "اترك الحقل فارغًا لاستخدام افتراضي المتجر.",
    reset: "استخدم افتراضيات المتجر",
    resetDone: "يستخدم الآن افتراضيات المتجر.",
    setUnitCost: "حدّد تكلفة القطعة",
    invalid: "أدخل رقمًا صحيحًا",
    noProducts: "لا توجد منتجات بعد.",
  },
} satisfies Messages;

type FormState = Record<keyof ProfitEconomics, string>;
const MONEY_FIELDS: (keyof ProfitEconomics)[] = ["packagingCostAmount", "shippingCostAmount", "returnCostAmount"];
const PERCENT_FIELDS: (keyof ProfitEconomics)[] = ["collectionFeeBp", "gatewayFeeBp", "damageBp"];

function toForm(e: ProfitEconomics | null): FormState {
  return {
    packagingCostAmount: minorToMajorInput(e?.packagingCostAmount),
    shippingCostAmount: minorToMajorInput(e?.shippingCostAmount),
    returnCostAmount: minorToMajorInput(e?.returnCostAmount),
    collectionFeeBp: basisPointsToPercentInput(e?.collectionFeeBp),
    gatewayFeeBp: basisPointsToPercentInput(e?.gatewayFeeBp),
    damageBp: basisPointsToPercentInput(e?.damageBp),
  };
}

/** Empty = null (use the default). Returns null when a field does not parse. */
function fromForm(form: FormState): ProfitEconomics | null {
  const out = {} as ProfitEconomics;
  for (const f of MONEY_FIELDS) {
    if (form[f].trim() === "") out[f] = null;
    else {
      const v = majorToMinor(form[f]);
      if (!Number.isFinite(v) || v < 0) return null;
      out[f] = v;
    }
  }
  for (const f of PERCENT_FIELDS) {
    if (form[f].trim() === "") out[f] = null;
    else {
      const v = percentToBasisPoints(form[f]);
      if (!Number.isFinite(v) || v < 0 || v > 10000) return null;
      out[f] = v;
    }
  }
  return out;
}

/** Product economics (SPEC §15.4): store defaults and per-product overrides. */
export function ProfitCostsPage() {
  const t = useT(STRINGS);
  const common = useCommon();
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const list = useAsync(() => profitGetEconomics(apiClient, workspaceId), [workspaceId]);
  const [defaults, setDefaults] = useState<FormState>(toForm(null));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ProfitEconomicsProduct | null>(null);

  useEffect(() => {
    if (list.data) setDefaults(toForm(list.data.defaults));
  }, [list.data]);

  async function saveDefaults(e: FormEvent) {
    e.preventDefault();
    const payload = fromForm(defaults);
    if (!payload) return toast.error(t.invalid);
    setSaving(true);
    try {
      await profitSaveDefaults(apiClient, workspaceId, payload);
      toast.success(t.saved);
      await list.refresh({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const money = (v: number | null) => (v === null ? "—" : formatMoney(v, currency));
  const columns: Column<ProfitEconomicsProduct>[] = [
    {
      key: "name",
      header: t.product,
      cell: (p) => (
        <span className="font-medium text-ink" dir="auto">
          {p.name}
        </span>
      ),
    },
    {
      key: "cost",
      header: t.unitCost,
      align: "end",
      cell: (p) =>
        p.minCostAmount === null ? (
          <Link to={`/catalog/${p.productId}`} className="text-sm font-medium text-primary hover:underline">
            {t.setUnitCost}
          </Link>
        ) : (
          <span>
            <bdi dir="ltr">
              {p.minCostAmount === p.maxCostAmount ? money(p.minCostAmount) : `${money(p.minCostAmount)} – ${money(p.maxCostAmount)}`}
            </bdi>
            {p.variantsWithoutCost > 0 && (
              <span className="block text-xs text-danger">{t.someMissing.replace("{n}", String(p.variantsWithoutCost))}</span>
            )}
          </span>
        ),
    },
    {
      key: "price",
      header: t.price,
      align: "end",
      cell: (p) => (
        <bdi dir="ltr">
          {p.minPriceAmount === p.maxPriceAmount ? money(p.minPriceAmount) : `${money(p.minPriceAmount)} – ${money(p.maxPriceAmount)}`}
        </bdi>
      ),
    },
    {
      key: "costs",
      header: t.costsCol,
      cell: (p) => <Badge variant={p.overrides ? "default" : "secondary"}>{p.overrides ? t.custom : t.usesDefaults}</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (p) => (
        <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
          {t.edit}
        </Button>
      ),
    },
  ];

  return (
    <div className="min-w-0 max-w-5xl">
      <PageHeader title={t.title} description={t.description} back={{ to: "/profit", label: t.back }} />
      <DataState loading={list.loading && !list.data} error={list.error} onRetry={() => void list.refresh()}>
        {list.data && (
          <div className="space-y-4">
            <Section title={t.defaultsTitle} description={t.defaultsDesc}>
              <form onSubmit={saveDefaults}>
                <EconomicsFields form={defaults} onChange={setDefaults} currency={currency} />
                <div className="mt-4 flex justify-end">
                  <Button type="submit" disabled={saving}>
                    {saving ? common.saving : t.save}
                  </Button>
                </div>
              </form>
            </Section>

            <Section title={t.productsTitle} description={t.productsDesc} flush>
              <DataTable
                columns={columns}
                rows={list.data.products}
                rowKey={(p) => p.productId}
                minWidth="44rem"
                empty={<p className="px-4 pb-4 text-sm text-ink-soft">{t.noProducts}</p>}
              />
            </Section>
          </div>
        )}
      </DataState>

      {editing && (
        <ProductCostsModal
          product={editing}
          currency={currency}
          workspaceId={workspaceId}
          onClose={() => setEditing(null)}
          onSaved={async (message) => {
            setEditing(null);
            toast.success(message);
            await list.refresh({ silent: true });
          }}
        />
      )}
    </div>
  );
}

function EconomicsFields({
  form,
  onChange,
  currency,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  currency: string;
}) {
  const t = useT(STRINGS);
  const set = (field: keyof ProfitEconomics) => (value: string) => onChange({ ...form, [field]: value });
  const percent = (field: keyof ProfitEconomics, label: string, hint?: string) => (
    <TextField
      label={label}
      hint={hint}
      inputMode="decimal"
      dir="ltr"
      placeholder="0"
      value={form[field]}
      onChange={(e) => set(field)(e.target.value)}
    />
  );
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MoneyInput label={t.shipping} hint={t.shippingHint} value={form.shippingCostAmount} onChange={set("shippingCostAmount")} currency={currency} />
      <MoneyInput label={t.returnCost} value={form.returnCostAmount} onChange={set("returnCostAmount")} currency={currency} />
      <MoneyInput label={t.packaging} value={form.packagingCostAmount} onChange={set("packagingCostAmount")} currency={currency} />
      {percent("collectionFeeBp", t.collection)}
      {percent("gatewayFeeBp", t.gateway)}
      {percent("damageBp", t.damage, t.damageHint)}
    </div>
  );
}

function ProductCostsModal({
  product,
  currency,
  workspaceId,
  onClose,
  onSaved,
}: {
  product: ProfitEconomicsProduct;
  currency: string;
  workspaceId: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(toForm(product.overrides));
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      await onSaved(message);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.editTitle.replace("{name}", product.name)}
      description={t.editDesc}
      className="max-w-2xl"
      footer={
        <>
          {product.overrides && (
            <Button
              variant="ghost"
              disabled={busy}
              className="me-auto"
              onClick={() => void run(() => profitResetProductEconomics(apiClient, workspaceId, product.productId), t.resetDone)}
            >
              {t.reset}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {common.cancel}
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              const payload = fromForm(form);
              if (!payload) return toast.error(t.invalid);
              void run(() => profitSaveProductEconomics(apiClient, workspaceId, product.productId, payload), t.saved);
            }}
          >
            {busy ? common.saving : t.save}
          </Button>
        </>
      }
    >
      <EconomicsFields form={form} onChange={setForm} currency={currency} />
    </Modal>
  );
}
