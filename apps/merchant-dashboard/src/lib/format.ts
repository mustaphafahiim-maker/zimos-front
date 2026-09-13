import { parseMoney } from "@store-builder/api-client";
import type { OrderAddressSnapshot, Variant } from "@store-builder/api-client";
import { getIntlLocale, getLocale } from "@/i18n/LocaleContext";

export { parseMoney };

/**
 * Formats integer minor units (piastres/cents; BIGINT strings accepted) as
 * money in the active dashboard language.
 *   en -> "EGP 1,234.00" (Latin digits, ISO code)
 *   ar -> "‏١٬٢٣٤٫٠٠ ج.م.‏" (Arabic digits, local symbol)
 */
export function formatMoney(amountMinorUnits: number | string | null | undefined, currency = "EGP"): string {
  const major = parseMoney(amountMinorUnits) / 100;
  const ar = getLocale() === "ar";
  try {
    return new Intl.NumberFormat(getIntlLocale(), {
      style: "currency",
      currency,
      currencyDisplay: ar ? "symbol" : "code",
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

/** Low–high minor-unit range, collapsing to a single value when equal. */
export function formatMoneyRange(
  lowMinorUnits: number | string | null | undefined,
  highMinorUnits: number | string | null | undefined,
  currency = "EGP"
): string {
  const low = parseMoney(lowMinorUnits);
  const high = parseMoney(highMinorUnits);
  if (low === high) return formatMoney(low, currency);
  return `${formatMoney(low, currency)} – ${formatMoney(high, currency)}`;
}

/** 12345.6 -> "12,345.6" (en) / "١٢٬٣٤٥٫٦" (ar). */
export function formatNumber(n: number | null | undefined, options?: Intl.NumberFormatOptions): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(getIntlLocale(), options).format(n);
}

/** 0.1234 -> "12.3%" in the active locale. */
export function formatPercentValue(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return new Intl.NumberFormat(getIntlLocale(), {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio);
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

/** "Mar 4" / "٤ مارس" — compact axis / list label. */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(getIntlLocale(), { month: "short", day: "numeric" });
}

/** "3 hours ago" / "منذ ٣ ساعات". */
export function formatRelativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffSec = Math.round((t - now) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(getIntlLocale(), { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), "month");
  return rtf.format(Math.round(diffSec / (86400 * 365)), "year");
}

/** { Size: "M", Color: "Red" } -> "Size: M · Color: Red" */
export function formatOptions(options: Record<string, string> | null | undefined): string {
  if (!options) return "";
  const entries = Object.entries(options);
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${k}: ${v}`).join(" · ");
}

export function formatAddress(address: OrderAddressSnapshot | null | undefined): string {
  if (!address) return getLocale() === "ar" ? "لا يوجد عنوان شحن" : "No shipping address";
  return [address.addressLine, address.city, address.province, address.postalCode, address.country]
    .filter(Boolean)
    .join(getLocale() === "ar" ? "، " : ", ");
}

/** Human label for a variant in a picker: options, or SKU, or a short id. */
export function variantLabel(variant: Variant): string {
  const opts = formatOptions(variant.optionValues);
  if (opts) return opts;
  if (variant.sku) return variant.sku;
  return `${getLocale() === "ar" ? "متغير" : "Variant"} ${variant.id.slice(0, 8)}`;
}

const HUMANIZE_EN: Record<string, string> = {
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
};

/** Arabic labels for every status the dashboard renders (StatusBadge tones + HUMANIZE_EN). */
const HUMANIZE_AR: Record<string, string> = {
  // product
  draft: "مسودة",
  active: "نشط",
  archived: "مؤرشف",
  // discount
  scheduled: "مجدول",
  expired: "منتهي",
  disabled: "معطّل",
  inactive: "غير نشط",
  // confirmation
  pending: "قيد الانتظار",
  confirmed: "مؤكَّد",
  rejected: "مرفوض",
  unreachable: "تعذّر الوصول",
  postponed: "مؤجَّل",
  // financial
  partially_paid: "مدفوع جزئيًا",
  paid: "مدفوع",
  failed: "فشل",
  refunded: "مُسترد",
  partially_refunded: "مُسترد جزئيًا",
  // fulfillment
  unfulfilled: "لم يُجهَّز",
  partially_fulfilled: "مُجهَّز جزئيًا",
  fulfilled: "مُجهَّز",
  returned: "مرتجع",
  // shipment
  created: "تم الإنشاء",
  picked_up: "تم الاستلام من المتجر",
  in_transit: "في الطريق",
  out_for_delivery: "خرج للتوصيل",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
  // return
  requested: "مطلوب",
  approved: "مقبول",
  received: "تم الاستلام",
  // return reasons / payment methods
  no_longer_wanted: "لم يعد مرغوبًا",
  not_as_described: "غير مطابق للوصف",
  wrong_item: "منتج خاطئ",
  arrived_late: "وصل متأخرًا",
  bank_transfer: "تحويل بنكي",
  cod: "الدفع عند الاستلام",
  // common extras seen across mock data
  published: "منشور",
  paused: "متوقف",
  ended: "منتهي",
  connected: "متصل",
  disconnected: "غير متصل",
  flagged: "مُعلَّم",
  blocked: "محظور",
  verified: "تم التحقق",
  pending_verification: "بانتظار التحقق",
  open: "مفتوح",
  closed: "مغلق",
  completed: "مكتمل",
  running: "قيد التشغيل",
  expected: "متوقع",
  discrepancy: "فرق في المبلغ",
  reconciled: "تمت التسوية",
  not_contacted: "لم يتم التواصل",
  contacted: "تم التواصل",
  recovered: "تم الاسترداد",
  lost: "مفقود",
};

/** "partially_paid" -> "Partially paid" / "مدفوع جزئيًا" */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  if (getLocale() === "ar" && HUMANIZE_AR[value]) return HUMANIZE_AR[value];
  if (HUMANIZE_EN[value]) return HUMANIZE_EN[value];
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
