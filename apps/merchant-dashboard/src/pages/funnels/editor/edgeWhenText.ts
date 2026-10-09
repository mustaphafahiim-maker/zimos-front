import type { FunnelEdgePaymentMethod, FunnelEdgeWhen } from "@store-builder/api-client";
import { fmt, type Locale, type Messages } from "@/i18n/LocaleContext";
import { formatMoney } from "@/lib/format";

/** Order conditions on a funnel path (handoff 376): the inspector's section, the labels on a path, the issue sentences. */
export const EDGE_WHEN_STRINGS = {
  en: {
    title: "Order conditions",
    hint: "These conditions check the visitor's order in this funnel. Keep one path without conditions as the last choice.",
    add: "Add condition",
    addProduct: "Bought a product",
    addTotal: "Order total",
    addPayment: "Payment method",
    remove: "Remove this condition",
    // product
    products: "Bought a product",
    chooseProducts: "Choose products",
    changeProducts: "Change",
    noProducts: "Pick at least one product, or remove this condition.",
    productGone: "A product that is no longer in the store",
    pickerTitle: "Which products?",
    pickerHint: "The path is taken when the order holds any of them.",
    pickerSearch: "Search products",
    pickerEmpty: "No product matches.",
    pickerNone: "The store has no products yet.",
    pickerLoading: "Loading the products…",
    pickerFailed: "The products could not be loaded.",
    wholeProduct: "Any variant",
    someVariants: "Specific variants",
    variantsOf: "Variants of {name}",
    selected_one: "1 chosen",
    selected_other: "{n} chosen",
    max: "Up to {n} products and {n} variants.",
    done: "Done",
    // total
    total: "Order total",
    atLeast: "At least",
    lessThan: "Less than",
    totalOrder: "“Less than” must be above “At least”.",
    totalWhole: "Type a whole amount, 0 or more.",
    // payment
    payment: "Payment method",
    pay_cod: "Cash on delivery",
    pay_card: "Card",
    pay_wallet: "Wallet",
    pay_valu: "valU",
    pay_kiosk: "Kiosk",
    pay_paypal: "PayPal",
    pay_bank_transfer: "Bank transfer",
    pay_on_account: "On account",
    // labels on a path
    labelBought: "If they bought {names}",
    labelBoughtSome: "If they bought chosen products",
    labelUnder: "If the order is under {amount}",
    labelAtLeast: "If the order is {amount} or more",
    labelBetween: "If the order is {min} or more and under {max}",
    labelPaid: "If they paid by {methods}",
    andMore: "{names} +{n}",
    // order among the ways out
    order: "Order among the ways out",
    moveUp: "Try this way earlier",
    moveDown: "Try this way later",
    orderHint: "The first way that fits is taken.",
    // issues
    issuePath: "Path: {from} → {to}",
    issueNoIds: "A path's condition names no product. Pick the products it checks, or remove the condition.",
    issueGone: "A product in a path's condition is no longer in this store. Pick another one.",
    issueTotals: "In a path's condition, “Less than” must be above “At least”.",
    issueEmpty: "A path has an empty order condition. Add what it checks, or remove it.",
    issueMethod: "A path's condition names a payment method the store does not know.",
  },
  ar: {
    title: "شروط على الطلب",
    hint: "الشروط دي بتتشيك على طلب الزائر في الفانل. خلّي مسار من غير شروط كآخر اختيار.",
    add: "أضف شرط",
    addProduct: "اشترى منتج",
    addTotal: "إجمالي الطلب",
    addPayment: "طريقة الدفع",
    remove: "شيل الشرط ده",
    products: "اشترى منتج",
    chooseProducts: "اختار المنتجات",
    changeProducts: "غيّر",
    noProducts: "اختار منتج واحد على الأقل، أو شيل الشرط ده.",
    productGone: "منتج مبقاش موجود في المتجر",
    pickerTitle: "أنهي منتجات؟",
    pickerHint: "المسار بيتاخد لو الطلب فيه أي واحد منهم.",
    pickerSearch: "دوّر في المنتجات",
    pickerEmpty: "مفيش منتج بالاسم ده.",
    pickerNone: "المتجر لسه مفيهوش منتجات.",
    pickerLoading: "بنحمّل المنتجات…",
    pickerFailed: "معرفناش نحمّل المنتجات.",
    wholeProduct: "أي نسخة",
    someVariants: "نسخ معينة",
    variantsOf: "نسخ {name}",
    selected_one: "واحد متحدد",
    selected_two: "اتنين متحددين",
    selected_few: "{n} متحددين",
    selected_other: "{n} متحدد",
    max: "لحد {n} منتج و{n} نسخة.",
    done: "تمام",
    total: "إجمالي الطلب",
    atLeast: "على الأقل",
    lessThan: "أقل من",
    totalOrder: "«أقل من» لازم يبقى أكبر من «على الأقل».",
    totalWhole: "اكتب مبلغ صحيح، 0 أو أكتر.",
    payment: "طريقة الدفع",
    pay_cod: "الدفع عند الاستلام",
    pay_card: "بطاقة",
    pay_wallet: "محفظة",
    pay_valu: "فاليو",
    pay_kiosk: "كشك",
    pay_paypal: "باي بال",
    pay_bank_transfer: "تحويل بنكي",
    pay_on_account: "على الحساب",
    labelBought: "لو اشترى {names}",
    labelBoughtSome: "لو اشترى منتجات محددة",
    labelUnder: "لو الطلب أقل من {amount}",
    labelAtLeast: "لو الطلب {amount} أو أكتر",
    labelBetween: "لو الطلب {min} أو أكتر وأقل من {max}",
    labelPaid: "لو دفع {methods}",
    andMore: "{names} +{n}",
    order: "الترتيب بين المسارات",
    moveUp: "جرّب المسار ده بدري",
    moveDown: "جرّب المسار ده بعدين",
    orderHint: "أول مسار ينفع هو اللي بيتاخد.",
    issuePath: "المسار: {from} ← {to}",
    issueNoIds: "فيه مسار شرطه مش محدد فيه منتجات. اختار المنتجات اللي بيتشيك عليها، أو شيل الشرط.",
    issueGone: "فيه منتج في شرط مسار مبقاش موجود في المتجر. اختار غيره.",
    issueTotals: "في شرط مسار، «أقل من» لازم يبقى أكبر من «على الأقل».",
    issueEmpty: "فيه مسار عليه شرط طلب فاضي. ضيف اللي بيتشيك عليه، أو شيله.",
    issueMethod: "فيه مسار شرطه فيه طريقة دفع المتجر مايعرفهاش.",
  },
} satisfies Messages;

export type EdgeWhenStrings = (typeof EDGE_WHEN_STRINGS)["en"];

/** True when the condition holds anything at all (an imported path's empty lists count: they show, to be filled). */
export function hasWhen(when: FunnelEdgeWhen | null | undefined): when is FunnelEdgeWhen {
  return Boolean(when && Object.keys(when).length > 0);
}

// Names the inspector has seen (product id or variant id → name), so the map can name them too.
const names = new Map<string, string>();

export function rememberWhenNames(entries: Iterable<readonly [string, string]>): void {
  for (const [id, name] of entries) names.set(id, name);
}

export function whenNameOf(id: string): string | undefined {
  return names.get(id);
}

const methodLabel = (t: EdgeWhenStrings, method: FunnelEdgePaymentMethod) => (t as unknown as Record<string, string>)[`pay_${method}`] ?? method;

/** The condition as sentences, one per kind: «لو اشترى …», «لو الطلب أقل من …», «لو دفع …». */
export function edgeWhenLabels(t: EdgeWhenStrings, when: FunnelEdgeWhen | null | undefined, currency: string, opts: { maxNames?: number } = {}): string[] {
  if (!hasWhen(when)) return [];
  const out: string[] = [];
  const ids = [...(when.productIds ?? []), ...(when.variantIds ?? [])];
  if (when.productIds || when.variantIds) {
    const known = ids.map((id) => names.get(id)).filter((name): name is string => Boolean(name));
    if (known.length === 0) out.push(t.labelBoughtSome);
    else {
      const max = opts.maxNames ?? 3;
      const shown = known.slice(0, max).join(t === EDGE_WHEN_STRINGS.ar ? "، " : ", ");
      const rest = ids.length - Math.min(known.length, max);
      out.push(fmt(t.labelBought, { names: rest > 0 ? fmt(t.andMore, { names: shown, n: rest }) : shown }));
    }
  }
  const { minTotal, maxTotal } = when;
  if (minTotal !== undefined && maxTotal !== undefined) out.push(fmt(t.labelBetween, { min: formatMoney(minTotal, currency), max: formatMoney(maxTotal, currency) }));
  else if (maxTotal !== undefined) out.push(fmt(t.labelUnder, { amount: formatMoney(maxTotal, currency) }));
  else if (minTotal !== undefined) out.push(fmt(t.labelAtLeast, { amount: formatMoney(minTotal, currency) }));
  if (when.paymentMethods && when.paymentMethods.length > 0) {
    out.push(fmt(t.labelPaid, { methods: when.paymentMethods.map((m) => methodLabel(t, m)).join(t === EDGE_WHEN_STRINGS.ar ? "، " : ", ") }));
  }
  return out;
}

/** The short label an arrow on the map carries for its order condition; null for a plain path. */
export function edgeWhenMapLabel(when: FunnelEdgeWhen | null | undefined, locale: Locale, currency = "EGP"): string | null {
  const labels = edgeWhenLabels(EDGE_WHEN_STRINGS[locale], when, currency, { maxNames: 1 });
  if (labels.length === 0) return null;
  // The pill is narrow: the first condition, and a mark that there are more (the inspector lists them all).
  return labels.length === 1 ? labels[0] : `${labels[0]} …`;
}

const EDGE_FIELD = /^edges\.([^.]+)\.condition$/;

/** The path an issue is about (`edges.<edgeId>.condition`), or null. */
export function issueEdgeId(field: string | null | undefined): string | null {
  return field ? (EDGE_FIELD.exec(field)?.[1] ?? null) : null;
}

/** The server's sentence about a path's order condition, in the dashboard's language; null for any other issue. */
export function whenIssueText(issue: { field?: string | null; message: string }, locale: Locale): string | null {
  if (!issueEdgeId(issue.field)) return null;
  const t = EDGE_WHEN_STRINGS[locale];
  const message = issue.message;
  if (/must list at least one id/i.test(message)) return t.issueNoIds;
  if (/is not in this store/i.test(message)) return t.issueGone;
  if (/must be above when\.minTotal/i.test(message)) return t.issueTotals;
  if (/when needs at least one of/i.test(message)) return t.issueEmpty;
  if (/unknown payment method/i.test(message)) return t.issueMethod;
  return null;
}
