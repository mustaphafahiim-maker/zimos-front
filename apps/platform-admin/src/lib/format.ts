/** Locale-aware formatting helpers. Money from the backend is integer minor units. */
import { getIntlLocale } from "@/i18n/LocaleContext";

function fractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** Minor units → localized currency string. */
export function formatMinor(amount: number, currency: string): string {
  const digits = fractionDigits(currency);
  const major = amount / 10 ** digits;
  try {
    return new Intl.NumberFormat(getIntlLocale(), { style: "currency", currency, maximumFractionDigits: digits }).format(major);
  } catch {
    return `${major.toFixed(digits)} ${currency}`;
  }
}

/** Major-unit input value → minor units. */
export function toMinor(major: number, currency: string): number {
  return Math.round(major * 10 ** fractionDigits(currency));
}

export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** fractionDigits(currency);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(getIntlLocale()).format(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(getIntlLocale(), { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(getIntlLocale(), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(getIntlLocale(), { numeric: "auto" });
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return rtf.format(0, "second");
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), "day");
  return formatDate(iso);
}

/** yyyy-mm-dd for <input type="date">. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

/** yyyy-mm-dd → ISO at end of that UTC day. */
export function fromDateInput(value: string): string {
  return new Date(`${value}T23:59:59.000Z`).toISOString();
}

export function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d ? `${d}d` : "", h ? `${h}h` : "", `${m}m`].filter(Boolean).join(" ");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}
