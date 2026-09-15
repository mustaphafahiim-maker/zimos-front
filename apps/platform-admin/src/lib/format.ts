/**
 * Formatting helpers. Plan prices carry their own currency (`plans.currency`),
 * so money formatters take one rather than assuming a single platform
 * currency; the fallback only applies where no currency is known.
 */
export const PLATFORM_CURRENCY = "EGP";

// Intl formatters are expensive to construct — one per currency, reused.
const moneyFmts = new Map<string, Intl.NumberFormat>();
const compactMoneyFmts = new Map<string, Intl.NumberFormat>();

function moneyFmt(currency: string): Intl.NumberFormat {
  let f = moneyFmts.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 });
    moneyFmts.set(currency, f);
  }
  return f;
}

function compactMoneyFmt(currency: string): Intl.NumberFormat {
  let f = compactMoneyFmts.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    });
    compactMoneyFmts.set(currency, f);
  }
  return f;
}

const numberFmt = new Intl.NumberFormat("en");
const compactFmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function formatMoney(value: number, currency: string = PLATFORM_CURRENCY): string {
  return moneyFmt(currency).format(value);
}

export function formatMoneyCompact(value: number, currency: string = PLATFORM_CURRENCY): string {
  return compactMoneyFmt(currency).format(value);
}

export function formatNumber(value: number): string {
  return numberFmt.format(value);
}

export function formatCompact(value: number): string {
  return compactFmt.format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** Basis points → "2.50%". */
export function formatBp(bp: number): string {
  return `${(bp / 100).toFixed(2)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return "just now";
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

/** yyyy-mm-ddThh:mm (local) for <input type="datetime-local">. */
export function toDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}
