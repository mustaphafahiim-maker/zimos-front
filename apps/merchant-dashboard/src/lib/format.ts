import { formatMoney as formatMoneyIn, formatMoneyRange, parseMoney } from "@store-builder/api-client";
import type { OrderAddressSnapshot, Variant } from "@store-builder/api-client";
import { getIntlLocale, getLocale } from "@/i18n/LocaleContext";

export { formatMoneyRange, parseMoney };

/**
 * Integer minor units -> display string, in the app's language: Arabic
 * digits under "ar", Latin digits under "en". Both use the Egyptian region
 * (ar-EG / en-EG). An explicit `locale` still wins.
 */
export function formatMoney(
  amountMinorUnits: number | string | null | undefined,
  currency = "EGP",
  locale: string = getLocale() === "ar" ? "ar-EG" : "en-EG"
): string {
  return formatMoneyIn(amountMinorUnits, currency, locale);
}

const minorDigits = new Map<string, number>();

/** Decimal places of a currency's minor unit (EGP/USD 2, JPY 0, KWD 3), from Intl. */
function minorUnitDigits(currency: string): number {
  let digits = minorDigits.get(currency);
  if (digits === undefined) {
    try {
      digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      digits = 2;
    }
    minorDigits.set(currency, digits);
  }
  return digits;
}

/**
 * A plan price (minor units of its own currency, as the API sends every
 * amount) for display, divided by that currency's own unit rather than by a
 * fixed 100: "799 ج.م." / "EGP 799". Whole amounts show no decimals.
 */
export function formatMinorMoney(minor: number | string | null | undefined, currency: string): string {
  const value = parseMoney(minor) / 10 ** minorUnitDigits(currency);
  const locale = getLocale() === "ar" ? "ar-EG" : "en-EG";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(value) ? 0 : minorUnitDigits(currency),
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/**
 * Display form of a product's `productCode`, e.g. "#482910573". Returns null
 * when the field is absent (older responses / backend not deployed) so callers
 * can skip rendering the label entirely. Tolerates a value that already has a
 * leading "#".
 */
export function formatProductCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const digits = String(code).replace(/^#/, "").trim();
  return digits ? `#${digits}` : null;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(getIntlLocale(), { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(getIntlLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** { Size: "M", Color: "Red" } -> "Size: M · Color: Red" */
export function formatOptions(options: Record<string, string> | null | undefined): string {
  if (!options) return "";
  const entries = Object.entries(options);
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${k}: ${v}`).join(" · ");
}

export function formatAddress(address: OrderAddressSnapshot | null | undefined): string {
  if (!address) return getLocale() === "ar" ? "مفيش عنوان شحن" : "No shipping address";
  return [address.addressLine, address.city, address.province, address.postalCode, address.country]
    .filter(Boolean)
    .join(", ");
}

/** Human label for a variant in a picker: options, or SKU, or a short id. */
export function variantLabel(variant: Variant): string {
  const opts = formatOptions(variant.optionValues);
  if (opts) return opts;
  if (variant.sku) return variant.sku;
  return `${getLocale() === "ar" ? "نوع" : "Variant"} ${variant.id.slice(0, 8)}`;
}

const HUMANIZE: Record<string, string> = {
  partially_paid: "Partially paid",
  partially_refunded: "Partially refunded",
  partially_fulfilled: "Partially fulfilled",
  out_for_delivery: "Out for delivery",
  in_transit: "In transit",
  picked_up: "Picked up",
  no_longer_wanted: "No longer wanted",
  not_as_described: "Not as described",
  wrong_item: "Wrong item",
  arrived_late: "Arrived late",
  bank_transfer: "Bank transfer",
  cod: "Cash on delivery",
  valu: "valU",
};

/**
 * Arabic for every status value a badge can show without its own label
 * (StatusBadge falls back to humanize). Egyptian, short, one word per concept.
 */
const HUMANIZE_AR: Record<string, string> = {
  draft: "مسودة",
  active: "شغّال",
  archived: "مؤرشف",
  scheduled: "متجدول",
  expired: "خلص",
  disabled: "متوقف",
  inactive: "متوقف",
  pending: "مستني",
  confirmed: "متأكد",
  rejected: "مرفوض",
  unreachable: "مبيردش",
  postponed: "متأجل",
  partially_paid: "مدفوع جزء",
  paid: "مدفوع",
  unpaid: "مش مدفوع",
  failed: "فشل",
  refunded: "اترجّع",
  partially_refunded: "اترجّع جزء",
  unfulfilled: "لسه متشحنش",
  partially_fulfilled: "اتشحن جزء",
  fulfilled: "اتشحن",
  returned: "مرتجع",
  created: "اتعمل",
  picked_up: "المندوب استلم",
  in_transit: "في الطريق",
  out_for_delivery: "خرج للتوصيل",
  delivered: "اتسلّم",
  cancelled: "ملغي",
  requested: "متطلب",
  approved: "موافق عليه",
  received: "وصل",
  open: "مفتوح",
  closed: "مقفول",
  completed: "خلص",
  processing: "بيتعمل",
  matched: "متطابق",
  unmatched: "مش متطابق",
  no_longer_wanted: "مش عايزه",
  not_as_described: "مش زي الوصف",
  wrong_item: "منتج غلط",
  damaged: "تالف",
  arrived_late: "وصل متأخر",
  bank_transfer: "تحويل بنكي",
  cod: "دفع عند الاستلام",
  card: "كارت",
  wallet: "محفظة",
  instapay: "إنستاباي",
  valu: "valU",
};

/** "partially_paid" -> "Partially paid" (or its Arabic in the Arabic dashboard) */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  if (getLocale() === "ar" && HUMANIZE_AR[value]) return HUMANIZE_AR[value];
  if (HUMANIZE[value]) return HUMANIZE[value];
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

// --- Money input helpers: the API speaks integer minor units (piastres) -----

/** "199.50" (major units, as typed) -> 19950 (integer minor units). NaN if unparseable. */
export function majorToMinor(input: string): number {
  const trimmed = input.trim();
  if (trimmed === "") return NaN;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return NaN;
  return Math.round(value * 100);
}

/** 19950 (minor units, string or number) -> "199.50" for an editable field. */
export function minorToMajorInput(minor: string | number | null | undefined): string {
  if (minor === null || minor === undefined || minor === "") return "";
  const n = parseMoney(minor);
  return (n / 100).toFixed(2);
}

// --- Percentage helpers: the API speaks basis points where 100 = 1% --------
// (10% -> 1000, 100% -> 10000). Same maths as the money helpers above but a
// distinct name so call sites read correctly.

/** "10" or "12.5" (percent, as typed) -> 1000 / 1250 (integer basis points). NaN if unparseable. */
export function percentToBasisPoints(input: string): number {
  const trimmed = input.trim();
  if (trimmed === "") return NaN;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return NaN;
  return Math.round(value * 100);
}

/** 1000 (basis points, string or number) -> "10" for an editable percent field. */
export function basisPointsToPercentInput(bp: string | number | null | undefined): string {
  if (bp === null || bp === undefined || bp === "") return "";
  const n = typeof bp === "number" ? bp : Number(bp);
  if (!Number.isFinite(n)) return "";
  return String(n / 100);
}

/** 1000 (basis points, string or number) -> "10%" for display. */
export function formatPercent(bp: string | number | null | undefined): string {
  const text = basisPointsToPercentInput(bp);
  return text === "" ? "—" : `${text}%`;
}

/**
 * 0.1234 -> "12.3%". Takes a ratio (not basis points) — used for
 * period-over-period deltas on <KpiCard>, where the change is already a
 * fraction. `formatPercent` above is the basis-points variant the discount
 * and tax screens use.
 */
export function formatPercentValue(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return new Intl.NumberFormat(getIntlLocale(), {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio);
}
