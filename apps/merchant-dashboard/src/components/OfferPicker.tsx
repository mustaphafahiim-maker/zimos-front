import { useEffect, useId, useState } from "react";
import type { OrderBumpProblem, WorkspaceOfferOption } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { formatMoney } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "./Select";

const STRINGS = {
  en: {
    search: "Search offers",
    searchPlaceholder: "Product or offer name",
    none: "Choose an offer…",
    loading: "Loading offers…",
    empty: "No active offers yet. Add one on a product's page (Offers).",
    noMatch: "No offer matches this search.",
    failed: "Couldn't load the offers.",
    current: "The chosen offer",
    option: "{offer} — {price}",
    problem_not_found: "no longer exists",
    problem_inactive: "not active",
    problem_no_price: "no set price",
    problem_no_lines: "no active variants",
    problem_custom_fields: "asks the customer for details",
    unusable: "{offer} ({reason})",
    currentGone: "The chosen offer can no longer be offered. Choose another one.",
  },
  ar: {
    search: "بحث في العروض",
    searchPlaceholder: "اسم المنتج أو العرض",
    none: "اختر عرضًا…",
    loading: "بنحمّل العروض…",
    empty: "لا توجد عروض فعّالة بعد. أضف عرضًا من صفحة المنتج (العروض).",
    noMatch: "لا يوجد عرض يطابق البحث.",
    failed: "تعذّر تحميل العروض.",
    current: "العرض المختار",
    option: "{offer} — {price}",
    problem_not_found: "لم يعد موجودًا",
    problem_inactive: "غير فعّال",
    problem_no_price: "بلا سعر محدد",
    problem_no_lines: "بلا متغيرات فعّالة",
    problem_custom_fields: "يطلب بيانات من العميل",
    unusable: "{offer} ({reason})",
    currentGone: "لم يعد العرض المختار صالحًا للعرض. اختر عرضًا آخر.",
  },
} satisfies Messages;

/**
 * Picks one of the store's active offers (GET /catalog/offers), grouped by
 * product. Offers that can't be an order bump are listed but disabled, with
 * the reason — the server refuses them anyway.
 */
export function OfferPicker({
  workspaceId,
  value,
  onChange,
  disabled,
  label,
  hint,
}: {
  workspaceId: string;
  value: string | null;
  onChange: (offerId: string | null) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  const t = useT(STRINGS);
  const selectId = useId();
  const searchId = useId();
  const hintId = useId();
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const offers = useAsync(() => apiClient.listWorkspaceOffers(workspaceId, { q, limit: 100 }), [workspaceId, q]);
  const list = offers.data ?? [];
  const selected = list.find((o) => o.id === value) ?? null;

  const reason = (problem: OrderBumpProblem) => t[`problem_${problem}`];
  const text = (o: WorkspaceOfferOption) => {
    const base = fmt(t.option, { offer: o.name, price: formatMoney(o.priceAmount, o.currency) });
    return o.bumpProblem ? fmt(t.unusable, { offer: base, reason: reason(o.bumpProblem) }) : base;
  };

  const groups = new Map<string, { name: string; offers: WorkspaceOfferOption[] }>();
  for (const o of list) {
    const group = groups.get(o.productId) ?? { name: o.productName, offers: [] };
    group.offers.push(o);
    groups.set(o.productId, group);
  }

  const showSearch = q !== "" || list.length >= 12;
  // The saved offer was archived (it drops out of the active list) or can no
  // longer be a bump. Unknown while a search may be hiding it.
  const currentGone = Boolean(
    value && !offers.loading && offers.error == null && (selected ? selected.bumpProblem : q === "")
  );

  return (
    <div className="space-y-2">
      {showSearch && (
        <div className="space-y-1.5">
          <label htmlFor={searchId} className="text-sm font-medium text-ink">
            {t.search}
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            disabled={disabled}
            className="flex h-11 w-full rounded-[0.5rem] border border-line-strong bg-paper-raised px-3 text-sm text-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor={selectId} className="text-sm font-medium text-ink">
          {label}
        </label>
        <Select
          id={selectId}
          value={value ?? ""}
          disabled={disabled || offers.loading}
          aria-describedby={hint || currentGone ? hintId : undefined}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-11"
        >
          <option value="">{offers.loading ? t.loading : t.none}</option>
          {/* Keep the saved choice visible even when a search hides it. */}
          {value && !selected && <option value={value}>{t.current}</option>}
          {[...groups.entries()].map(([productId, group]) => (
            <optgroup key={productId} label={group.name}>
              {group.offers.map((o) => (
                <option key={o.id} value={o.id} disabled={Boolean(o.bumpProblem) && o.id !== value}>
                  {text(o)}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        {(hint || currentGone) && (
          <p id={hintId} className={cn("text-xs", currentGone ? "font-medium text-danger" : "text-ink-soft")}>
            {currentGone ? t.currentGone : hint}
          </p>
        )}
        {!offers.loading && offers.error != null && <p className="text-xs text-danger">{t.failed}</p>}
        {!offers.loading && offers.error == null && list.length === 0 && (
          <p className="text-xs text-ink-soft">{q ? t.noMatch : t.empty}</p>
        )}
      </div>
    </div>
  );
}
