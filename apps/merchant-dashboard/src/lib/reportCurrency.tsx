import { useCallback, useSyncExternalStore } from "react";
import { currenciesGet, type CurrencyDashboard } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";

/**
 * The analytics currency switcher (SPEC §11.5: "analytics include a currency
 * switcher (EGP / USD / MAD…)"). Reports add up in the store's own currency
 * (backend currencies/baseAmounts.js); this only shows those amounts in
 * another one, at the store's current rates (GET /currencies → reportRates).
 * Nothing is stored converted.
 *
 * The choice is the teammate's, per store, in this browser, and every report
 * page shares it. A page formats an amount with `useReportMoney()`:
 *
 *   const inReport = useReportMoney();
 *   formatMoney(...inReport(amountMinor, data.currency));
 */

const KEY = (workspaceId: string) => `zimos.reportCurrency.${workspaceId}`;
const listeners = new Set<() => void>();
const rateCache = new Map<string, Promise<CurrencyDashboard | null>>();

function readChoice(workspaceId: string): string {
  try {
    return localStorage.getItem(KEY(workspaceId)) ?? "";
  } catch {
    return "";
  }
}

function writeChoice(workspaceId: string, currency: string) {
  try {
    if (currency) localStorage.setItem(KEY(workspaceId), currency);
    else localStorage.removeItem(KEY(workspaceId));
  } catch {
    /* the choice just isn't remembered */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The store's rates, fetched once per store and page load. */
function ratesOf(workspaceId: string): Promise<CurrencyDashboard | null> {
  let pending = rateCache.get(workspaceId);
  if (!pending) {
    pending = currenciesGet(apiClient, workspaceId).catch(() => null);
    rateCache.set(workspaceId, pending);
  }
  return pending;
}

const digitCache = new Map<string, number>();
function minorDigits(currency: string): number {
  let digits = digitCache.get(currency);
  if (digits === undefined) {
    try {
      digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      digits = 2;
    }
    digitCache.set(currency, digits);
  }
  return digits;
}

const EMPTY: Record<string, number> = {};

function useReportCurrencyState() {
  const workspaceId = useWorkspaceId();
  const rates = useAsync(() => ratesOf(workspaceId), [workspaceId]);
  const chosen = useSyncExternalStore(subscribe, () => readChoice(workspaceId), () => "");
  const table = rates.data?.reportRates ?? rates.data?.rates ?? EMPTY;
  return { workspaceId, chosen, table, base: rates.data?.baseCurrency ?? null, fetchedAt: rates.data?.ratesFetchedAt ?? null };
}

/**
 * `(amountMinor, currency) → [amount, currency]` in the chosen report
 * currency: converted from the report's own currency when it is the store's
 * and a rate is known (rounded half away from zero to the minor unit), and
 * left as it is otherwise.
 */
export function useReportMoney(): (amountMinor: number | null | undefined, currency: string) => [number, string] {
  const { chosen, table, base } = useReportCurrencyState();
  // Stable while the choice and the rates stay the same, so pages can memoize on it.
  return useCallback(
    (amountMinor: number | null | undefined, currency: string): [number, string] => {
      const amount = Number(amountMinor ?? 0);
      const rate = chosen && chosen !== currency && currency === base ? table[chosen] : undefined;
      if (!rate) return [amount, currency];
      const scaled = amount * rate * 10 ** (minorDigits(chosen) - minorDigits(currency));
      return [Math.sign(scaled) * Math.round(Math.abs(scaled)), chosen];
    },
    [chosen, table, base]
  );
}

const STRINGS = {
  en: {
    label: "Show amounts in",
    own: "{code} (store currency)",
    note: "Converted at the store's current rates, for viewing only. Orders are added up in {code}.",
  },
  ar: {
    label: "اعرض المبالغ بـ",
    own: "{code} (عملة المتجر)",
    note: "متحوّلة بأسعار الصرف الحالية للمتجر، للعرض بس. الطلبات بتتجمع بـ {code}.",
  },
} satisfies Messages;

/** The switcher for a report page's toolbar; nothing when the store has no rates to offer. */
export function ReportCurrencySelect() {
  const t = useT(STRINGS);
  const { workspaceId, chosen, table, base } = useReportCurrencyState();
  const codes = Object.keys(table).filter((c) => c !== base).sort();
  if (!base || codes.length === 0) return null;
  const value = chosen && table[chosen] ? chosen : "";
  return (
    <div className="flex flex-col gap-1">
      <Select
        aria-label={t.label}
        title={t.label}
        className="h-9 w-auto"
        value={value}
        onChange={(e) => writeChoice(workspaceId, e.target.value)}
      >
        <option value="">{t.own.replace("{code}", base)}</option>
        {codes.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </Select>
      {value && <span className="max-w-56 text-[11px] leading-tight text-ink-soft">{t.note.replace("{code}", base)}</span>}
    </div>
  );
}
