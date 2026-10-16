import { cache } from "react";
import { parseMoney } from "@store-builder/api-client";

/**
 * The store's currency format (dashboard → currencies, SPEC §11.5): where the
 * symbol goes and whether decimals show. "auto" leaves both to the language,
 * as prices have always been written.
 *
 * Client components pass the format explicitly (StoreContext's `money`, from
 * the store's own settings), so the server HTML and the browser agree. The
 * page renderer's server components read it from a per-request slot the
 * renderer fills (setRequestMoneyFormat): React's `cache` keeps it to one
 * request on the server, and outside server components it never holds
 * anything.
 */
export interface MoneyFormat {
  symbolPosition?: "auto" | "before" | "after" | string;
  decimals?: "auto" | "always" | "never" | string;
}

const requestSlot = cache((): { value: MoneyFormat | null } => ({ value: null }));

export function setRequestMoneyFormat(format: MoneyFormat | null | undefined) {
  requestSlot().value = format ?? null;
}

export function requestMoneyFormat(): MoneyFormat | null {
  return requestSlot().value;
}

/** Whether the format changes anything at all. */
export function isCustomFormat(format: MoneyFormat | null | undefined): format is MoneyFormat {
  return Boolean(format && ((format.symbolPosition && format.symbolPosition !== "auto") || (format.decimals && format.decimals !== "auto")));
}

/** An amount in minor units, written the store's way. */
export function formatWithFormat(amountMinor: number | string | null | undefined, currency: string, intlLocale: string, format: MoneyFormat): string {
  const major = parseMoney(amountMinor) / 100;
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    const fraction =
      format.decimals === "never"
        ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        : format.decimals === "always"
          ? { minimumFractionDigits: digits, maximumFractionDigits: digits }
          : {};
    const nf = new Intl.NumberFormat(intlLocale, { style: "currency", currency, ...fraction });
    if (format.symbolPosition !== "before" && format.symbolPosition !== "after") return nf.format(major);
    const parts = nf.formatToParts(major);
    const symbol = parts.filter((p) => p.type === "currency").map((p) => p.value).join("");
    const number = parts
      .filter((p) => p.type !== "currency" && p.type !== "literal")
      .map((p) => p.value)
      .join("");
    // Each side keeps reading order in either direction: an isolate around the number.
    return format.symbolPosition === "before" ? `${symbol} ⁨${number}⁩` : `⁨${number}⁩ ${symbol}`;
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}
