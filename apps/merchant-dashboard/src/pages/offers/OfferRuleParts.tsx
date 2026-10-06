import { useState, type ReactNode } from "react";
import { Button, Card, Input, Label } from "@store-builder/ui";
import type { Product } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";

/** Pieces the offer-rule screens share: product pickers and the rule card. */

const STRINGS = {
  en: {
    anyProduct: "Every product",
    search: "Search products",
    noMatch: "No products match.",
    selected: "{count} selected",
    active: "Active",
    inactive: "Off",
    edit: "Edit",
    delete: "Delete",
    turnOn: "Turn on",
    turnOff: "Turn off",
  },
  ar: {
    anyProduct: "كل المنتجات",
    search: "ابحث في المنتجات",
    noMatch: "مفيش منتجات مطابقة.",
    selected: "اخترت {count}",
    active: "مفعّل",
    inactive: "متوقف",
    edit: "تعديل",
    delete: "حذف",
    turnOn: "تفعيل",
    turnOff: "إيقاف",
  },
} satisfies Messages;

/** The store's sellable products (first 200), loaded once per screen. */
export function useStoreProducts() {
  const workspaceId = useWorkspaceId();
  return useAsync(
    () => apiClient.listProducts(workspaceId, { status: ["draft", "active"], limit: 200 }).then((r) => r.products),
    [workspaceId]
  );
}

/** One product, or "every product" (null). */
export function ProductSelect({
  id,
  label,
  hint,
  products,
  value,
  onChange,
  disabled,
  anyLabel,
}: {
  id: string;
  label: string;
  hint?: string;
  products: Product[];
  value: string | null;
  onChange: (productId: string | null) => void;
  disabled?: boolean;
  anyLabel?: string;
}) {
  const t = useT(STRINGS);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{anyLabel ?? t.anyProduct}</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

/** Several products, as a searchable checklist. */
export function ProductChecklist({
  label,
  hint,
  products,
  value,
  onChange,
  disabled,
  max,
}: {
  label: string;
  hint?: string;
  products: Product[];
  value: string[];
  onChange: (productIds: string[]) => void;
  disabled?: boolean;
  max?: number;
}) {
  const t = useT(STRINGS);
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const shown = products.filter((p) => !q || p.name.toLowerCase().includes(q));
  const full = max !== undefined && value.length >= max;
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium text-ink">
        {label}
        {value.length > 0 && <span className="ms-2 text-xs font-normal text-ink-soft">{fmt(t.selected, { count: value.length })}</span>}
      </legend>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
      <Input aria-label={t.search} placeholder={t.search} value={search} disabled={disabled} onChange={(e) => setSearch(e.target.value)} />
      <ul className="max-h-44 divide-y divide-line overflow-y-auto rounded-[0.5rem] border border-line">
        {shown.length === 0 && <li className="px-3 py-2 text-sm text-ink-soft">{t.noMatch}</li>}
        {shown.map((p) => {
          const checked = value.includes(p.id);
          return (
            <li key={p.id}>
              <label className="flex min-h-10 cursor-pointer items-center gap-3 px-3 py-1.5 text-sm text-ink hover:bg-paper">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={checked}
                  disabled={disabled || (!checked && full)}
                  onChange={() => onChange(checked ? value.filter((x) => x !== p.id) : [...value, p.id])}
                />
                <span className="min-w-0 truncate">{p.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/** A rule in a list: title, a line under it, extra detail, and its actions. */
export function RuleCard({
  title,
  subtitle,
  isActive,
  warning,
  busy,
  onEdit,
  onToggle,
  onDelete,
  children,
}: {
  title: string;
  subtitle?: string;
  isActive: boolean;
  /** Shown instead of the status when the rule cannot show anything (its offer is gone). */
  warning?: string;
  busy?: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  children?: ReactNode;
}) {
  const t = useT(STRINGS);
  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-medium text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
        </div>
        {warning ? (
          <StatusBadge value="warning" tone="warning" text={warning} />
        ) : (
          <StatusBadge value={isActive ? "active" : "inactive"} tone={isActive ? "success" : "neutral"} text={isActive ? t.active : t.inactive} />
        )}
      </div>
      {children}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={onEdit}>
          {t.edit}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onToggle}>
          {isActive ? t.turnOff : t.turnOn}
        </Button>
        <Button size="sm" variant="ghost" className="ms-auto text-danger hover:bg-danger-soft" disabled={busy} onClick={onDelete}>
          {t.delete}
        </Button>
      </div>
    </Card>
  );
}
