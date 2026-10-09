import { useMemo, useRef, useState } from "react";
import { IconCash, IconDelete, IconEdit, IconPercent, IconPlus, IconPower, IconSale } from "@/components/icons";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  CART_OFFER_MAX_QUANTITY,
  CART_OFFER_MAX_RULES,
  cartOfferProblemOf,
  cartOffersList,
  cartOffersSave,
  type CartOfferRule,
  type Product,
  type Variant,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { asciiDigits, parseWholeNumber } from "@/lib/wholeNumber";
import { formatDateTime, formatMoney, formatOptions, majorToMinor, minorToMajorInput } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { Segmented } from "@/components/Segmented";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { Field, TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { ProductChecklist, useStoreProducts } from "./OfferRuleParts";
import { FormProblem, OfferList, OfferListState, OfferPage, OfferPreview, OfferRow, SheetActions, TOUCH_BUTTON, TOUCH_FIELD } from "./OfferKit";
// «شوف النتايج» → Reports → Cart offers & gifts (handoff 256).
import { OfferResultsLink } from "@/pages/analytics/storeReports/OfferResultsLink";

/**
 * Cart offers (handoff 253), in the Offers hub beside the free gifts: "add the
 * matching socks for 20% off". While a rule holds — the cart has one of its
 * products and/or reaches its amount — the store's cart shows the offered
 * product at the offer price and the shopper adds it with one tap; the order
 * is charged the same price, for up to "max quantity" units. The API keeps the
 * whole list (20 rules at most) and every save sends it back whole.
 */

const STRINGS = {
  en: {
    title: "Cart offers",
    listLabel: "Your cart offers",
    edit: "Edit",
    turnOn: "Turn on",
    turnOff: "Turn off",
    turnedOn: "“{name}” is on.",
    turnedOff: "“{name}” is off.",
    comesTo: "({price} instead of {regular})",
    previewEmpty: "Choose the product and its discount, and what the shopper reads shows here.",
    description: "A product offered at a lower price in the cart, when the cart has a certain product or reaches an amount.",
    newRule: "New cart offer",
    limitReached: "A store can have up to {max} cart offers. Delete one to add another.",
    emptyTitle: "No cart offers yet",
    emptyHint: "Offer something that goes with what is in the cart — matching socks at 20% off — and the shopper adds it with one tap.",
    whenAmount: "When the cart reaches {amount}",
    whenProducts: "When the cart has {products}",
    whenBoth: "When the cart reaches {amount} and has {products}",
    orJoin: " or ",
    more: "+{count} more",
    quoted: "“{name}”",
    percentOff: "{percent}% off",
    fixedPrice: "for {price}",
    insteadOf: "instead of {price}",
    maxLine: "Up to {count} at this price",
    productGone: "The offered product was deleted",
    productOff: "The offered product is not on sale",
    productOut: "The offered product is out of stock — the offer shows again once it is back",
    notCheaper: "The offer price is not lower than the product's price",
    ended: "Ended",
    dates: "{from} to {to}",
    from: "From {date}",
    until: "Until {date}",
    createTitle: "New cart offer",
    editTitle: "Edit cart offer",
    name: "Name",
    namePlaceholder: "Matching socks 20% off",
    nameHint: "Shoppers see it above the offer in the cart; you see it on the order and in the report.",
    product: "The product on offer",
    productPick: "Choose the product…",
    productMissing: "A product that is no longer in your store",
    productHint: "One of your products, and the exact option when it has several. The offer shows only while it is in stock.",
    outOfStock: "(out of stock)",
    discountType: "Discount",
    typePercent: "Percentage",
    typePrice: "Fixed price",
    percent: "Percent off",
    price: "Offer price",
    maxQuantity: "Max quantity at this price",
    maxQuantityHint: "With more than that in the cart, the product is back at its normal price.",
    whenTitle: "Show when",
    whenHint: "Set at least one. With both, the cart needs both.",
    products: "The cart has one of these products",
    productsHint: "Any one of them is enough. The offered product itself does not count.",
    minAmount: "The cart reaches",
    minAmountHint: "The cart total without the offered product and before shipping. Leave blank for no amount.",
    startsAt: "Starts",
    endsAt: "Ends",
    datesHint: "Leave blank to start now and never end.",
    clearDate: "Clear",
    active: "On",
    preview: "In the cart, the shopper sees",
    nameRequired: "Write a name for this offer: shoppers read it above the offer in the cart.",
    productRequired: "Choose the product on offer.",
    percentInvalid: "Percent off: a whole number from 1 to 100.",
    priceInvalid: "Write the offer price.",
    priceNotLower: "The offer price has to be lower than the product's price ({price}).",
    quantityInvalid: "Max quantity: a whole number from 1 to 10.",
    conditionRequired: "Choose products, set an amount, or both.",
    amountInvalid: "Write a valid amount, or leave it blank.",
    datesInvalid: "The end has to be after the start.",
    variant_not_in_store: "That product isn't one of your store's products anymore. Choose another one.",
    product_not_in_store: "A product in the condition isn't in your store anymore. Remove it and save again.",
    own_product_only: "The offered product can't be the only product that shows its own offer. Choose another product, or set an amount.",
    ends_before_start: "The end has to be after the start.",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    deleteTitle: "Delete “{name}”?",
    deleteHint: "Carts stop showing this offer. Orders that already took it keep their price.",
    delete: "Delete",
    deleted: "Deleted.",
  },
  ar: {
    title: "عروض السلة",
    listLabel: "عروض السلة بتاعتك",
    edit: "عدّل",
    turnOn: "شغّله",
    turnOff: "وقّفه",
    turnedOn: "«{name}» شغّال.",
    turnedOff: "«{name}» اتوقف.",
    comesTo: "({price} بدل {regular})",
    previewEmpty: "اختار المنتج والخصم، واللي العميل هيقراه يظهر هنا.",
    description: "منتج بيتعرض في السلة بسعر أقل، لما السلة يكون فيها منتج معيّن أو توصل لمبلغ معيّن.",
    newRule: "عرض جديد",
    limitReached: "المتجر يقدر يعمل لحد {max} عرض سلة. امسح واحد عشان تضيف غيره.",
    emptyTitle: "مفيش عروض سلة لسه",
    emptyHint: "اعرض حاجة تليق على اللي في السلة — شراب بخصم 20٪ مثلًا — والعميل يضيفها بضغطة واحدة.",
    whenAmount: "لما السلة توصل لـ {amount}",
    whenProducts: "لما السلة يكون فيها {products}",
    whenBoth: "لما السلة توصل لـ {amount} ويكون فيها {products}",
    orJoin: " أو ",
    more: "و{count} كمان",
    quoted: "«{name}»",
    percentOff: "خصم {percent}٪",
    fixedPrice: "بـ {price}",
    insteadOf: "بدل {price}",
    maxLine: "لحد {count} بالسعر ده",
    productGone: "منتج العرض اتمسح",
    productOff: "منتج العرض مش شغّال",
    productOut: "منتج العرض خلص من المخزن — العرض هيرجع يظهر أول ما يرجع",
    notCheaper: "سعر العرض مش أقل من سعر المنتج",
    ended: "خلص",
    dates: "من {from} لحد {to}",
    from: "من {date}",
    until: "لحد {date}",
    createTitle: "عرض سلة جديد",
    editTitle: "تعديل عرض السلة",
    name: "الاسم",
    namePlaceholder: "شراب بخصم 20٪ مع الكوتشي",
    nameHint: "العميل بيشوفه فوق العرض في السلة، وانت بتشوفه في الأوردر والتقرير.",
    product: "المنتج اللي في العرض",
    productPick: "اختار المنتج…",
    productMissing: "منتج مبقاش موجود في متجرك",
    productHint: "منتج من متجرك، والنوع بالظبط لو له أكتر من نوع. العرض بيظهر طول ما المنتج موجود في المخزن بس.",
    outOfStock: "(خلص)",
    discountType: "نوع الخصم",
    typePercent: "نسبة مئوية",
    typePrice: "سعر ثابت",
    percent: "نسبة الخصم",
    price: "السعر في العرض",
    maxQuantity: "أقصى كمية بالسعر ده",
    maxQuantityHint: "لو السلة فيها أكتر من كده، المنتج بيرجع لسعره العادي.",
    whenTitle: "يظهر لما",
    whenHint: "اختار شرط واحد على الأقل. لو اخترت الاتنين، لازم السلة تحقق الاتنين.",
    products: "السلة فيها منتج من دول",
    productsHint: "أي منتج منهم يكفي. منتج العرض نفسه مش بيتحسب.",
    minAmount: "السلة توصل لـ",
    minAmountHint: "إجمالي السلة من غير منتج العرض ومن غير الشحن. سيبه فاضي لو مفيش مبلغ.",
    startsAt: "بيبدأ",
    endsAt: "بيخلص",
    datesHint: "سيبهم فاضيين عشان يشتغل من دلوقتي ومن غير نهاية.",
    clearDate: "امسح",
    active: "شغّال",
    preview: "العميل هيشوف في السلة",
    nameRequired: "اكتب اسم للعرض ده: العميل بيقراه فوق العرض في السلة.",
    productRequired: "اختار منتج العرض.",
    percentInvalid: "نسبة الخصم: رقم صحيح من 1 لـ 100.",
    priceInvalid: "اكتب السعر في العرض.",
    priceNotLower: "السعر في العرض لازم يكون أقل من سعر المنتج ({price}).",
    quantityInvalid: "أقصى كمية: رقم صحيح من 1 لـ 10.",
    conditionRequired: "اختار منتجات، أو حط مبلغ، أو الاتنين.",
    amountInvalid: "اكتب مبلغ صحيح، أو سيبه فاضي.",
    datesInvalid: "النهاية لازم تكون بعد البداية.",
    variant_not_in_store: "المنتج ده مبقاش من منتجات متجرك. اختار منتج تاني.",
    product_not_in_store: "في منتج في الشرط مبقاش في متجرك. شيله واحفظ تاني.",
    own_product_only: "منتج العرض مينفعش يكون هو الشرط الوحيد لعرضه. اختار منتج تاني، أو حط مبلغ.",
    ends_before_start: "النهاية لازم تكون بعد البداية.",
    cancel: "إلغاء",
    save: "حفظ",
    saving: "بنحفظ…",
    saved: "اتحفظ.",
    deleteTitle: "تمسح «{name}»؟",
    deleteHint: "السلة مش هتعرض العرض ده تاني. الأوردرات اللي خدته قبل كده هتفضل بسعرها.",
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

/** A typed amount in minor units: Arabic digits and the Arabic decimal mark are read too. */
function typedAmount(raw: string): number {
  return majorToMinor(asciiDigits(raw).replace(/٫/g, "."));
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

/** Same test as the server: the product is on sale and the variant has a piece to sell. */
function offeredState(ref: VariantRef | undefined): "gone" | "off" | "out" | "ok" {
  if (!ref) return "gone";
  if (ref.product.status !== "active") return "off";
  const { variant } = ref;
  return variant.allowOverselling || variant.stockOnHand - variant.reservedStock >= 1 ? "ok" : "out";
}

function offeredName(ref: VariantRef): string {
  const options = formatOptions(ref.variant.optionValues);
  return (ref.product.variants?.length ?? 0) > 1 && options ? `${ref.product.name} — ${options}` : ref.product.name;
}

/** The price a rule offers a variant at — the server's own sum, for the merchant's preview only. */
function offerPriceOf(rule: Pick<CartOfferRule, "discountPercent" | "offerPriceAmount">, regular: number): number {
  const price =
    rule.offerPriceAmount !== null && rule.offerPriceAmount !== undefined
      ? Number(rule.offerPriceAmount)
      : Math.round((regular * (100 - Number(rule.discountPercent ?? 0))) / 100);
  return Math.max(0, Math.min(price, regular));
}

function dealText(rule: CartOfferRule, currency: string, t: Strings): string {
  return rule.discountPercent !== null && rule.discountPercent !== undefined
    ? fmt(t.percentOff, { percent: rule.discountPercent })
    : fmt(t.fixedPrice, { price: formatMoney(rule.offerPriceAmount ?? 0, currency) });
}

function productNames(ids: string[], products: Product[], t: Strings): string {
  const names = ids.map((id) => products.find((p) => p.id === id)?.name).filter((n): n is string => Boolean(n));
  const shown = names.slice(0, 3).map((name) => fmt(t.quoted, { name })).join(t.orJoin);
  return names.length > 3 ? `${shown} ${fmt(t.more, { count: names.length - 3 })}` : shown;
}

function conditionText(rule: CartOfferRule, products: Product[], currency: string, t: Strings): string {
  const amount = rule.minSubtotal ? formatMoney(rule.minSubtotal, currency) : null;
  const names = rule.productIds?.length ? productNames(rule.productIds, products, t) : null;
  if (amount && names) return fmt(t.whenBoth, { amount, products: names });
  if (amount) return fmt(t.whenAmount, { amount });
  return fmt(t.whenProducts, { products: names ?? "" });
}

function datesText(rule: CartOfferRule, t: Strings): string | null {
  if (rule.startsAt && rule.endsAt) return fmt(t.dates, { from: formatDateTime(rule.startsAt), to: formatDateTime(rule.endsAt) });
  if (rule.startsAt) return fmt(t.from, { date: formatDateTime(rule.startsAt) });
  if (rule.endsAt) return fmt(t.until, { date: formatDateTime(rule.endsAt) });
  return null;
}

function serverProblem(err: unknown, t: Strings): string | null {
  const problem = cartOfferProblemOf(err);
  return problem ? t[problem] : null;
}

export function CartOffersPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const storeCurrency = currentWorkspace?.defaultCurrency ?? "EGP";
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => cartOffersList(apiClient, workspaceId), [workspaceId]);
  const products = useStoreProducts();
  const [editing, setEditing] = useState<CartOfferRule | "new" | null>(null);
  const [deleting, setDeleting] = useState<CartOfferRule | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rules = list.data ?? [];
  const catalog = useMemo(() => products.data ?? [], [products.data]);
  const variants = useMemo(() => variantIndex(catalog), [catalog]);
  const full = rules.length >= CART_OFFER_MAX_RULES;

  /** The whole list goes back on every change (PUT replaces it). */
  async function saveAll(next: CartOfferRule[]) {
    const saved = await cartOffersSave(apiClient, workspaceId, next);
    list.setData(saved);
    return saved;
  }

  // The newest list, for a save that runs later than the render it was asked in (Undo).
  const latest = useRef(rules);
  latest.current = rules;

  async function toggle(rule: CartOfferRule, undoable = true): Promise<void> {
    const current = latest.current.find((r) => r.id === rule.id) ?? rule;
    const active = !current.active;
    setBusyId(rule.id ?? null);
    try {
      await saveAll(latest.current.map((r) => (r.id === rule.id ? { ...r, active } : r)));
      const said = fmt(active ? t.turnedOn : t.turnedOff, { name: rule.name });
      if (undoable) toast.undo(said, () => toggle(rule, false));
      else toast.success(said);
    } catch (err) {
      toast.error(serverProblem(err, t) ?? errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const newButton = (
    <Button type="button" className={TOUCH_BUTTON} disabled={full} onClick={() => setEditing("new")}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.newRule}
    </Button>
  );

  const menuFor = (rule: CartOfferRule): ContextMenuItem[] => [
    { id: "edit", label: t.edit, icon: IconEdit, onSelect: () => setEditing(rule) },
    { id: "toggle", label: rule.active ? t.turnOff : t.turnOn, icon: IconPower, onSelect: () => void toggle(rule) },
    { id: "delete", label: t.delete, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setDeleting(rule) },
  ];

  return (
    <OfferPage title={t.title} description={t.description} actions={<OfferResultsLink />} primaryAction={rules.length > 0 ? newButton : undefined}>
      <OfferListState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {rules.length === 0 ? (
          <EmptyState icon={<IconSale />} title={t.emptyTitle} description={t.emptyHint} action={newButton} />
        ) : (
          <div className="space-y-3">
            {full && <Alert>{fmt(t.limitReached, { max: CART_OFFER_MAX_RULES })}</Alert>}
            <OfferList label={t.listLabel}>
              {rules.map((rule) => {
                const ref = variants.get(rule.variantId);
                const currency = ref?.variant.currency ?? storeCurrency;
                const regular = ref ? Number(ref.variant.priceAmount) : null;
                const state = products.loading ? "ok" : offeredState(ref);
                const ended = Boolean(rule.endsAt && new Date(rule.endsAt) <= new Date());
                const notCheaper = regular !== null && offerPriceOf(rule, regular) >= regular;
                const warning =
                  state === "gone"
                    ? t.productGone
                    : state === "off"
                      ? t.productOff
                      : state === "out"
                        ? t.productOut
                        : ended
                          ? t.ended
                          : notCheaper
                            ? t.notCheaper
                            : undefined;
                const dates = datesText(rule, t);
                return (
                  <OfferRow
                    key={rule.id ?? rule.name}
                    name={rule.name}
                    badge={rule.active && warning ? <StatusBadge value="warning" tone="warning" text={warning} className="max-w-full whitespace-normal" /> : undefined}
                    line={
                      <>
                        {ref && (
                          <>
                            <bdi>{offeredName(ref)}</bdi>
                            {" — "}
                          </>
                        )}
                        <span className="font-semibold text-ink tabular-nums">
                          <bdi>{dealText(rule, currency, t)}</bdi>
                        </span>
                        {regular !== null && !notCheaper && (
                          // A percentage also says what it comes to: «خصم ٢٠٪ (٤٠ ج.م بدل ٥٠ ج.م)».
                          <span className="tabular-nums">
                            {" "}
                            <bdi>
                              {rule.discountPercent !== null && rule.discountPercent !== undefined
                                ? fmt(t.comesTo, { price: formatMoney(offerPriceOf(rule, regular), currency), regular: formatMoney(regular, currency) })
                                : fmt(t.insteadOf, { price: formatMoney(regular, currency) })}
                            </bdi>
                          </span>
                        )}
                      </>
                    }
                    details={
                      <>
                        <span>
                          <bdi>{conditionText(rule, catalog, storeCurrency, t)}</bdi>
                        </span>
                        <span className="tabular-nums">{fmt(t.maxLine, { count: rule.maxQuantity })}</span>
                        {dates && <span>{dates}</span>}
                      </>
                    }
                    onOpen={() => setEditing(rule)}
                    toggle={{ checked: rule.active, busy: busyId === rule.id, onChange: () => void toggle(rule) }}
                    menu={menuFor(rule)}
                  />
                );
              })}
            </OfferList>
          </div>
        )}
      </OfferListState>

      {editing && (
        <CartOfferDialog
          rule={editing === "new" ? null : editing}
          products={catalog}
          productsLoading={products.loading}
          storeCurrency={storeCurrency}
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
    </OfferPage>
  );
}

type DiscountKind = "percent" | "price";

function CartOfferDialog({
  rule,
  products,
  productsLoading,
  storeCurrency,
  onClose,
  onSave,
}: {
  rule: CartOfferRule | null;
  products: Product[];
  productsLoading: boolean;
  storeCurrency: string;
  onClose: () => void;
  onSave: (rule: CartOfferRule) => Promise<void>;
}) {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const [name, setName] = useState(rule?.name ?? "");
  const [variantId, setVariantId] = useState(rule?.variantId ?? "");
  // A rule is a percentage unless it carries a price of its own.
  const [kind, setKind] = useState<DiscountKind>(rule && !rule.discountPercent && rule.offerPriceAmount != null ? "price" : "percent");
  const [percent, setPercent] = useState(rule?.discountPercent ? String(rule.discountPercent) : "");
  const [price, setPrice] = useState(rule && rule.offerPriceAmount != null ? minorToMajorInput(rule.offerPriceAmount) : "");
  const [maxQuantity, setMaxQuantity] = useState(String(rule?.maxQuantity ?? 1));
  const [minAmount, setMinAmount] = useState(rule?.minSubtotal ? minorToMajorInput(rule.minSubtotal) : "");
  const [productIds, setProductIds] = useState<string[]>(rule?.productIds ?? []);
  const [startsAt, setStartsAt] = useState(localInputOf(rule?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(localInputOf(rule?.endsAt ?? null));
  const [active, setActive] = useState(rule?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const variants = useMemo(() => variantIndex(products), [products]);
  const chosen = variants.get(variantId);
  const currency = chosen?.variant.currency ?? storeCurrency;
  // The offered product can never show its own offer: it is left out of the condition's list.
  const triggerChoices = useMemo(() => products.filter((p) => p.id !== chosen?.product.id), [products, chosen]);
  const triggerIds = productIds.filter((id) => id !== chosen?.product.id);

  /** The discount as the API takes it, or the sentence that says what is wrong with it. */
  function discountOf(): Pick<CartOfferRule, "discountPercent" | "offerPriceAmount"> | string {
    if (kind === "percent") {
      const value = parseWholeNumber(percent, 1, 100);
      return value === null || Number.isNaN(value) ? t.percentInvalid : { discountPercent: value, offerPriceAmount: null };
    }
    const minor = typedAmount(price);
    if (!Number.isFinite(minor) || minor < 0) return t.priceInvalid;
    if (chosen && minor >= Number(chosen.variant.priceAmount)) {
      return fmt(t.priceNotLower, { price: formatMoney(chosen.variant.priceAmount, currency) });
    }
    return { discountPercent: null, offerPriceAmount: minor };
  }

  function check(): CartOfferRule | string {
    if (!name.trim()) return t.nameRequired;
    if (!variantId) return t.productRequired;
    const discount = discountOf();
    if (typeof discount === "string") return discount;
    const quantity = parseWholeNumber(maxQuantity, 1, CART_OFFER_MAX_QUANTITY);
    if (quantity === null || Number.isNaN(quantity)) return t.quantityInvalid;
    const amountMinor = minAmount.trim() ? typedAmount(minAmount) : null;
    if (amountMinor !== null && (!Number.isFinite(amountMinor) || amountMinor < 1)) return t.amountInvalid;
    if (amountMinor === null && triggerIds.length === 0) return t.conditionRequired;
    const from = isoOfLocalInput(startsAt);
    const to = isoOfLocalInput(endsAt);
    if (from && to && to <= from) return t.datesInvalid;
    return {
      ...(rule?.id ? { id: rule.id } : {}),
      name: name.trim(),
      variantId,
      ...discount,
      maxQuantity: quantity,
      minSubtotal: amountMinor,
      productIds: triggerIds.length ? triggerIds : null,
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

  // What the cart will say, on the numbers being typed.
  const liveDiscount = chosen ? discountOf() : null;
  const regular = chosen ? Number(chosen.variant.priceAmount) : 0;
  const previewPrice = liveDiscount && typeof liveDiscount !== "string" ? offerPriceOf(liveDiscount, regular) : null;

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={rule ? t.editTitle : t.createTitle}
      className="max-w-xl"
      footer={<SheetActions busy={busy} onCancel={onClose} onSave={() => void submit()} />}
    >
      {/* A message about the form goes once the form is touched again. */}
      <div className="space-y-4" onChange={() => setError(null)}>
        <TextField
          label={t.name}
          hint={t.nameHint}
          maxLength={120}
          placeholder={t.namePlaceholder}
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />

        <Field label={t.product} hint={t.productHint}>
          {(props) => (
            <Select {...props} className={TOUCH_FIELD} value={variantId} disabled={busy || productsLoading} onChange={(e) => setVariantId(e.target.value)}>
              <option value="">{t.productPick}</option>
              {variantId && !chosen && !productsLoading && <option value={variantId}>{t.productMissing}</option>}
              {products.map((product) => {
                const list = product.variants ?? [];
                if (list.length === 0) return null;
                const label = (variant: Variant) => {
                  const out = offeredState({ product, variant }) === "out" ? ` ${t.outOfStock}` : "";
                  const title = list.length > 1 ? formatOptions(variant.optionValues) || product.name : product.name;
                  return `${title} · ${formatMoney(variant.priceAmount, variant.currency)}${out}`;
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

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">{t.discountType}</p>
          <Segmented
            label={t.discountType}
            value={kind}
            onChange={(next) => {
              setKind(next);
              setError(null);
            }}
            options={[
              { value: "percent", label: t.typePercent, icon: IconPercent },
              { value: "price", label: t.typePrice, icon: IconCash },
            ]}
            className="w-full sm:w-auto"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {kind === "percent" ? (
            <Field label={t.percent}>
              {(props) => (
                // A number reads left to right in both languages, so the box is LTR and the sign follows the digits.
                <div className="relative" dir="ltr">
                  <Input
                    {...props}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={3}
                    value={percent}
                    disabled={busy}
                    onChange={(e) => setPercent(e.target.value)}
                    className="h-11 pe-9 text-base tabular-nums md:h-10 md:text-sm"
                  />
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-ink-soft">
                    %
                  </span>
                </div>
              )}
            </Field>
          ) : (
            <MoneyInput label={t.price} currency={currency} value={price} onChange={setPrice} disabled={busy} />
          )}
          <TextField
            label={t.maxQuantity}
            hint={t.maxQuantityHint}
            type="text"
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            maxLength={2}
            value={maxQuantity}
            disabled={busy}
            onChange={(e) => setMaxQuantity(e.target.value)}
          />
        </div>

        <fieldset data-slot="offer-tier" className="min-w-0 space-y-3 rounded-[1rem] bg-paper-raised p-3 ring-1 ring-line">
          <legend className="px-1 text-sm font-semibold text-ink">{t.whenTitle}</legend>
          <p className="text-xs text-ink-soft">{t.whenHint}</p>
          <ProductChecklist
            label={t.products}
            hint={t.productsHint}
            products={triggerChoices}
            value={triggerIds}
            onChange={setProductIds}
            disabled={busy}
            loading={productsLoading}
          />
          <MoneyInput label={t.minAmount} hint={t.minAmountHint} currency={storeCurrency} value={minAmount} onChange={setMinAmount} disabled={busy} />
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
                    className="h-11 min-w-0 flex-1 text-base md:text-sm"
                  />
                  {value && (
                    <Button type="button" variant="ghost" className="min-h-11 shrink-0 rounded-full" disabled={busy} onClick={() => set("")}>
                      {t.clearDate}
                    </Button>
                  )}
                </div>
              )}
            </Field>
          ))}
          <p className="-mt-2 text-xs text-ink-soft sm:col-span-2">{t.datesHint}</p>
        </div>

        <SettingsGroup>
          <SettingsSwitch checked={active} onChange={setActive} label={t.active} disabled={busy} />
        </SettingsGroup>

        <OfferPreview label={t.preview}>
          {chosen && previewPrice !== null && previewPrice < regular ? (
            <>
              <p className="font-medium text-ink">
                <bdi>{offeredName(chosen)}</bdi>
              </p>
              <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
                <span className="font-semibold text-success">
                  <bdi>{formatMoney(previewPrice, currency)}</bdi>
                </span>
                <s className="text-xs text-ink-soft">
                  <bdi>{fmt(t.insteadOf, { price: formatMoney(regular, currency) })}</bdi>
                </s>
              </p>
            </>
          ) : (
            <p className="text-ink-soft">{t.previewEmpty}</p>
          )}
        </OfferPreview>

        <FormProblem>{error}</FormProblem>
      </div>
    </Modal>
  );
}
