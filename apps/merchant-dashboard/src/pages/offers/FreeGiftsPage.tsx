import { useMemo, useState } from "react";
import { Gift } from "lucide-react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  FREE_GIFT_MAX_RULES,
  freeGiftProblemOf,
  freeGiftsList,
  freeGiftsSave,
  type FreeGiftRule,
  type Product,
  type Variant,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime, formatMoney, formatOptions, majorToMinor, minorToMajorInput } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { ProductChecklist, RuleCard, useStoreProducts } from "./OfferRuleParts";

/**
 * Free gift with purchase (handoff 208), in the Offers hub beside the other
 * tools that raise an order's value: "spend 400, get a tote" or "buy this,
 * get that". The store's checkout adds the gift at 0 while it is in stock;
 * the cart shows the shopper how far they are from it. The API keeps the
 * whole list (20 rules at most) and every save sends it back whole.
 */

const STRINGS = {
  en: {
    back: "Offers",
    title: "Free gifts",
    description: "A gift added to the order at no charge when it reaches an amount or has a product in it.",
    newRule: "New free gift",
    limitReached: "A store can have up to {max} free gifts. Delete one to add another.",
    emptyTitle: "No free gifts yet",
    emptyHint: "Pick a small gift — a tote, a sample — that joins the order when it reaches an amount. Shoppers see how much is left in their cart.",
    whenAmount: "When the order reaches {amount}",
    whenProducts: "When the cart has {products}",
    whenBoth: "When the order reaches {amount} and the cart has {products}",
    orJoin: " or ",
    more: "+{count} more",
    gives: "Gift:",
    quoted: "“{name}”",
    giftGone: "The gift product was deleted",
    giftOff: "The gift product is not on sale",
    giftOut: "The gift is out of stock — it is added again once it is back",
    ended: "Ended",
    dates: "{from} to {to}",
    from: "From {date}",
    until: "Until {date}",
    createTitle: "New free gift",
    editTitle: "Edit free gift",
    name: "Name",
    namePlaceholder: "Spend 400, get a tote",
    nameHint: "For you, to tell the gifts apart.",
    gift: "The gift",
    giftPick: "Choose the gift…",
    giftHint: "A product of your store. It is added at no charge, and only while it is in stock.",
    outOfStock: "(out of stock)",
    quantity: "How many",
    whenTitle: "When is it added?",
    whenHint: "Set at least one. With both, the order needs both.",
    minAmount: "When the order reaches",
    minAmountHint: "The cart total before shipping. Leave blank for no amount.",
    products: "When the cart has",
    productsHint: "Any one of them is enough.",
    startsAt: "Starts",
    endsAt: "Ends",
    datesHint: "Leave blank to start now and never end.",
    clearDate: "Clear",
    active: "On",
    preview: "In the cart, the shopper sees",
    previewEarned: "Free gift: {gift}",
    previewMissing: "Before that, the cart shows how much is left to reach {amount}.",
    nameRequired: "Write a name for this gift.",
    giftRequired: "Choose the gift.",
    quantityInvalid: "How many: a whole number from 1 to 10.",
    conditionRequired: "Set an amount, choose products, or both.",
    amountInvalid: "Write a valid amount, or leave it blank.",
    datesInvalid: "The end has to be after the start.",
    gift_not_in_store: "That gift isn't one of your store's products anymore. Choose another one.",
    product_not_in_store: "A product in the condition isn't in your store anymore. Remove it and save again.",
    ends_before_start: "The end has to be after the start.",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    deleteTitle: "Delete “{name}”?",
    deleteHint: "Orders stop getting this gift. Orders that already have it keep it.",
    delete: "Delete",
    deleted: "Deleted.",
  },
  ar: {
    back: "العروض",
    title: "هدايا مع الأوردر",
    description: "هدية بتتضاف للأوردر ببلاش لما يوصل لمبلغ معيّن أو يكون فيه منتج معيّن.",
    newRule: "هدية جديدة",
    limitReached: "المتجر يقدر يعمل لحد {max} هدية. امسح واحدة عشان تضيف غيرها.",
    emptyTitle: "مفيش هدايا لسه",
    emptyHint: "اختار هدية صغيرة — شنطة أو عيّنة — تتضاف للأوردر لما يوصل لمبلغ معيّن. العميل بيشوف في السلة فاضله قد إيه.",
    whenAmount: "لما الأوردر يوصل لـ {amount}",
    whenProducts: "لما يكون في السلة {products}",
    whenBoth: "لما الأوردر يوصل لـ {amount} ويكون في السلة {products}",
    orJoin: " أو ",
    more: "و{count} كمان",
    gives: "الهدية:",
    quoted: "«{name}»",
    giftGone: "منتج الهدية اتمسح",
    giftOff: "منتج الهدية مش شغّال",
    giftOut: "الهدية خلصت من المخزن — هترجع تتضاف أول ما ترجع",
    ended: "خلصت",
    dates: "من {from} لحد {to}",
    from: "من {date}",
    until: "لحد {date}",
    createTitle: "هدية جديدة",
    editTitle: "تعديل الهدية",
    name: "الاسم",
    namePlaceholder: "اشتري بـ 400 وخد شنطة هدية",
    nameHint: "ليك انت، عشان تفرّق بين الهدايا.",
    gift: "الهدية",
    giftPick: "اختار الهدية…",
    giftHint: "منتج من متجرك. بيتضاف ببلاش، وطول ما هو موجود في المخزن بس.",
    outOfStock: "(خلص)",
    quantity: "العدد",
    whenTitle: "إمتى تتضاف؟",
    whenHint: "اختار شرط واحد على الأقل. لو اخترت الاتنين، لازم الأوردر يحقق الاتنين.",
    minAmount: "لما الأوردر يوصل لـ",
    minAmountHint: "إجمالي السلة من غير الشحن. سيبه فاضي لو مفيش مبلغ.",
    products: "لما يكون في السلة",
    productsHint: "أي منتج منهم يكفي.",
    startsAt: "بتبدأ",
    endsAt: "بتخلص",
    datesHint: "سيبهم فاضيين عشان تشتغل من دلوقتي ومن غير نهاية.",
    clearDate: "امسح",
    active: "شغّالة",
    preview: "العميل هيشوف في السلة",
    previewEarned: "هدية مجانية: {gift}",
    previewMissing: "وقبلها، السلة بتقوله فاضله قد إيه عشان يوصل لـ {amount}.",
    nameRequired: "اكتب اسم للهدية دي.",
    giftRequired: "اختار الهدية.",
    quantityInvalid: "العدد: رقم صحيح من 1 لـ 10.",
    conditionRequired: "حط مبلغ، أو اختار منتجات، أو الاتنين.",
    amountInvalid: "اكتب مبلغ صحيح، أو سيبه فاضي.",
    datesInvalid: "النهاية لازم تكون بعد البداية.",
    gift_not_in_store: "الهدية دي مبقتش من منتجات متجرك. اختار هدية تانية.",
    product_not_in_store: "في منتج في الشرط مبقاش في متجرك. شيله واحفظ تاني.",
    ends_before_start: "النهاية لازم تكون بعد البداية.",
    cancel: "إلغاء",
    save: "حفظ",
    saving: "بنحفظ…",
    saved: "اتحفظ.",
    deleteTitle: "تمسح «{name}»؟",
    deleteHint: "الأوردرات الجاية مش هتاخد الهدية دي. اللي خدتها قبل كده هتفضل معاها.",
    delete: "امسح",
    deleted: "اتمسح.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

/** `datetime-local` value on the viewer's own clock for an ISO time, and back. */
function localInputOf(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function isoOfLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

interface VariantRef {
  product: Product;
  variant: Variant;
}

/** Every variant of the loaded products, by id. */
function variantIndex(products: Product[]): Map<string, VariantRef> {
  const index = new Map<string, VariantRef>();
  for (const product of products) for (const variant of product.variants ?? []) index.set(variant.id, { product, variant });
  return index;
}

/** Same test as the server: the product is on sale and the variant can give `qty` pieces. */
function giftState(ref: VariantRef | undefined, qty: number): "gone" | "off" | "out" | "ok" {
  if (!ref) return "gone";
  if (ref.product.status !== "active") return "off";
  const { variant } = ref;
  return variant.allowOverselling || variant.stockOnHand - variant.reservedStock >= qty ? "ok" : "out";
}

function giftName(ref: VariantRef | undefined): string {
  if (!ref) return "";
  const options = formatOptions(ref.variant.optionValues);
  return (ref.product.variants?.length ?? 0) > 1 && options ? `${ref.product.name} — ${options}` : ref.product.name;
}

function productNames(ids: string[], products: Product[], t: Strings): string {
  const names = ids.map((id) => products.find((p) => p.id === id)?.name).filter((n): n is string => Boolean(n));
  const shown = names.slice(0, 3).map((name) => fmt(t.quoted, { name })).join(t.orJoin);
  return names.length > 3 ? `${shown} ${fmt(t.more, { count: names.length - 3 })}` : shown;
}

function conditionText(rule: FreeGiftRule, products: Product[], t: Strings): string {
  const amount = rule.minSubtotal ? formatMoney(rule.minSubtotal) : null;
  const names = rule.productIds?.length ? productNames(rule.productIds, products, t) : null;
  if (amount && names) return fmt(t.whenBoth, { amount, products: names });
  if (amount) return fmt(t.whenAmount, { amount });
  return fmt(t.whenProducts, { products: names ?? "" });
}

function datesText(rule: FreeGiftRule, t: Strings): string | null {
  if (rule.startsAt && rule.endsAt) return fmt(t.dates, { from: formatDateTime(rule.startsAt), to: formatDateTime(rule.endsAt) });
  if (rule.startsAt) return fmt(t.from, { date: formatDateTime(rule.startsAt) });
  if (rule.endsAt) return fmt(t.until, { date: formatDateTime(rule.endsAt) });
  return null;
}

export function FreeGiftsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => freeGiftsList(apiClient, workspaceId), [workspaceId]);
  const products = useStoreProducts();
  const [editing, setEditing] = useState<FreeGiftRule | "new" | null>(null);
  const [deleting, setDeleting] = useState<FreeGiftRule | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rules = list.data ?? [];
  const catalog = useMemo(() => products.data ?? [], [products.data]);
  const variants = useMemo(() => variantIndex(catalog), [catalog]);
  const full = rules.length >= FREE_GIFT_MAX_RULES;

  /** The whole list goes back on every change (PUT replaces it). */
  async function saveAll(next: FreeGiftRule[]) {
    const saved = await freeGiftsSave(apiClient, workspaceId, next);
    list.setData(saved);
    return saved;
  }

  async function toggle(rule: FreeGiftRule) {
    setBusyId(rule.id ?? null);
    try {
      await saveAll(rules.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r)));
      toast.success(t.saved);
    } catch (err) {
      toast.error(serverProblem(err, t) ?? errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const newButton = (
    <Button type="button" disabled={full} onClick={() => setEditing("new")}>
      {t.newRule}
    </Button>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader title={t.title} description={t.description} back={{ to: "/offers", label: t.back }} actions={rules.length > 0 ? newButton : undefined} />
      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        {rules.length === 0 ? (
          <EmptyState icon={<Gift />} title={t.emptyTitle} description={t.emptyHint} action={newButton} />
        ) : (
          <div className="space-y-3">
            {full && <Alert>{fmt(t.limitReached, { max: FREE_GIFT_MAX_RULES })}</Alert>}
            {rules.map((rule) => {
              const ref = variants.get(rule.giftVariantId);
              const state = products.loading ? "ok" : giftState(ref, rule.quantity);
              const ended = Boolean(rule.endsAt && new Date(rule.endsAt) <= new Date());
              const warning =
                state === "gone" ? t.giftGone : state === "off" ? t.giftOff : state === "out" ? t.giftOut : ended && rule.active ? t.ended : undefined;
              const dates = datesText(rule, t);
              return (
                <RuleCard
                  key={rule.id ?? rule.name}
                  title={rule.name}
                  subtitle={conditionText(rule, catalog, t)}
                  isActive={rule.active}
                  warning={rule.active ? warning : undefined}
                  busy={busyId === rule.id}
                  onEdit={() => setEditing(rule)}
                  onToggle={() => void toggle(rule)}
                  onDelete={() => setDeleting(rule)}
                >
                  {ref && (
                    <p className="text-sm text-ink">
                      <Gift className="me-1.5 inline size-4 align-[-3px] text-primary" aria-hidden />
                      {t.gives} <bdi>{giftName(ref)}</bdi> × {fmt("{qty}", { qty: rule.quantity })}
                    </p>
                  )}
                  {dates && <p className="text-xs text-ink-soft">{dates}</p>}
                </RuleCard>
              );
            })}
          </div>
        )}
      </DataState>

      {editing && (
        <FreeGiftDialog
          rule={editing === "new" ? null : editing}
          products={catalog}
          productsLoading={products.loading}
          onClose={() => setEditing(null)}
          onSave={async (draft) => {
            const next = editing === "new" ? [...rules, draft] : rules.map((r) => (r.id === editing.id ? { ...draft, id: r.id } : r));
            await saveAll(next);
            setEditing(null);
            toast.success(t.saved);
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={fmt(t.deleteTitle, { name: deleting?.name ?? "" })}
        description={t.deleteHint}
        confirmLabel={t.delete}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await saveAll(rules.filter((r) => r.id !== deleting.id));
            toast.success(t.deleted);
          } catch (err) {
            toast.error(serverProblem(err, t) ?? errorMessage(err));
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}

function serverProblem(err: unknown, t: Strings): string | null {
  const problem = freeGiftProblemOf(err);
  return problem ? t[problem] : null;
}

function FreeGiftDialog({
  rule,
  products,
  productsLoading,
  onClose,
  onSave,
}: {
  rule: FreeGiftRule | null;
  products: Product[];
  productsLoading: boolean;
  onClose: () => void;
  onSave: (rule: FreeGiftRule) => Promise<void>;
}) {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const [name, setName] = useState(rule?.name ?? "");
  const [giftVariantId, setGiftVariantId] = useState(rule?.giftVariantId ?? "");
  const [quantity, setQuantity] = useState(String(rule?.quantity ?? 1));
  const [minAmount, setMinAmount] = useState(rule?.minSubtotal ? minorToMajorInput(rule.minSubtotal) : "");
  const [productIds, setProductIds] = useState<string[]>(rule?.productIds ?? []);
  const [startsAt, setStartsAt] = useState(localInputOf(rule?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(localInputOf(rule?.endsAt ?? null));
  const [active, setActive] = useState(rule?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const variants = useMemo(() => variantIndex(products), [products]);
  const chosen = variants.get(giftVariantId);
  const qty = Number(quantity);
  const amountMinor = minAmount.trim() ? majorToMinor(minAmount) : null;

  function check(): FreeGiftRule | string {
    if (!name.trim()) return t.nameRequired;
    if (!giftVariantId) return t.giftRequired;
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) return t.quantityInvalid;
    if (amountMinor !== null && (!Number.isFinite(amountMinor) || amountMinor < 1)) return t.amountInvalid;
    if (amountMinor === null && productIds.length === 0) return t.conditionRequired;
    const from = isoOfLocalInput(startsAt);
    const to = isoOfLocalInput(endsAt);
    if (from && to && to <= from) return t.datesInvalid;
    return {
      ...(rule?.id ? { id: rule.id } : {}),
      name: name.trim(),
      giftVariantId,
      quantity: qty,
      minSubtotal: amountMinor,
      productIds: productIds.length ? productIds : null,
      startsAt: from,
      endsAt: to,
      active,
    };
  }

  async function submit() {
    const draft = check();
    if (typeof draft === "string") {
      setError(draft);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (err) {
      setError(serverProblem(err, t) ?? errorMessage(err));
      setBusy(false);
    }
  }

  const giftLabel = chosen ? giftName(chosen) : null;

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={rule ? t.editTitle : t.createTitle}
      footer={
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label={t.name}
          hint={t.nameHint}
          maxLength={120}
          placeholder={t.namePlaceholder}
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <Field label={t.gift} hint={t.giftHint}>
            {(props) => (
              <Select {...props} value={giftVariantId} disabled={busy || productsLoading} onChange={(e) => setGiftVariantId(e.target.value)}>
                <option value="">{t.giftPick}</option>
                {products.map((product) => {
                  const list = product.variants ?? [];
                  if (list.length === 0) return null;
                  const label = (variant: Variant) => {
                    const out = giftState({ product, variant }, Number.isInteger(qty) && qty > 0 ? qty : 1) === "out" ? ` ${t.outOfStock}` : "";
                    return `${list.length > 1 ? formatOptions(variant.optionValues) || product.name : product.name}${out}`;
                  };
                  return list.length > 1 ? (
                    <optgroup key={product.id} label={product.name}>
                      {list.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {label(variant)}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option key={product.id} value={list[0].id}>
                      {label(list[0])}
                    </option>
                  );
                })}
              </Select>
            )}
          </Field>
          <TextField
            label={t.quantity}
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            dir="ltr"
            value={quantity}
            disabled={busy}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <fieldset className="space-y-3 rounded-[var(--radius)] border border-line p-3">
          <legend className="px-1 text-sm font-semibold text-ink">{t.whenTitle}</legend>
          <p className="text-xs text-ink-soft">{t.whenHint}</p>
          <MoneyInput label={t.minAmount} hint={t.minAmountHint} value={minAmount} onChange={setMinAmount} disabled={busy} />
          <ProductChecklist label={t.products} hint={t.productsHint} products={products} value={productIds} onChange={setProductIds} disabled={busy} />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              [t.startsAt, startsAt, setStartsAt],
              [t.endsAt, endsAt, setEndsAt],
            ] as const
          ).map(([label, value, set]) => (
            <Field key={label} label={label}>
              {(props) => (
                <div className="flex items-center gap-2">
                  <Input
                    {...props}
                    type="datetime-local"
                    dir="ltr"
                    value={value}
                    disabled={busy}
                    onChange={(e) => set(e.target.value)}
                    className="min-h-11 min-w-0 flex-1"
                  />
                  {value && (
                    <Button type="button" variant="ghost" className="min-h-11 shrink-0" disabled={busy} onClick={() => set("")}>
                      {t.clearDate}
                    </Button>
                  )}
                </div>
              )}
            </Field>
          ))}
          <p className="-mt-2 text-xs text-ink-soft sm:col-span-2">{t.datesHint}</p>
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
          <input type="checkbox" className="size-4 accent-primary" checked={active} disabled={busy} onChange={(e) => setActive(e.target.checked)} />
          {t.active}
        </label>

        {giftLabel && (
          <div className="space-y-1.5 rounded-[var(--radius)] bg-paper-sunken p-3 text-sm">
            <p className="text-xs font-medium text-ink-soft">{t.preview}</p>
            <p className="font-medium text-success">{fmt(t.previewEarned, { gift: giftLabel })}</p>
            {amountMinor !== null && Number.isFinite(amountMinor) && amountMinor > 0 && (
              <p className="text-xs text-ink-soft">{fmt(t.previewMissing, { amount: formatMoney(amountMinor) })}</p>
            )}
          </div>
        )}

        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
