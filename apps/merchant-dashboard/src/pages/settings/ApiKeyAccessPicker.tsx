import type { ApiKeyScope } from "@store-builder/api-client";
import { useT } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";

/**
 * What a new API key may touch besides orders (SPEC §16.2): one row per kind
 * of data, each "no access / read / read and change". The fine-grained scopes
 * the public API checks are derived from the level, so the merchant never has
 * to read a list of twenty scope names.
 */

export type AccessLevel = "none" | "read" | "write";

export type AccessResource = "products" | "categories" | "customers" | "discounts" | "shipping" | "webhooks" | "analytics";

export type AccessMap = Record<AccessResource, AccessLevel>;

export const EMPTY_ACCESS: AccessMap = {
  products: "none",
  categories: "none",
  customers: "none",
  discounts: "none",
  shipping: "none",
  webhooks: "none",
  analytics: "none",
};

const SCOPES: Record<AccessResource, { read: ApiKeyScope[]; write?: ApiKeyScope[] }> = {
  products: { read: ["products:read"], write: ["products:read", "products:create", "products:update", "products:delete"] },
  categories: {
    read: ["categories:read"],
    write: ["categories:read", "categories:create", "categories:update", "categories:delete"],
  },
  customers: { read: ["customers:read"] },
  discounts: { read: ["discounts:read"], write: ["discounts:read", "discounts:write"] },
  shipping: { read: ["shipping_areas:read"], write: ["shipping_areas:read", "shipping_areas:write"] },
  // Registering an endpoint is the only thing a key does with webhooks.
  webhooks: { read: [], write: ["webhooks:write"] },
  analytics: { read: ["analytics:read"] },
};

const ORDER: AccessResource[] = ["products", "categories", "customers", "discounts", "shipping", "webhooks", "analytics"];

/** The scopes the chosen levels stand for, without duplicates. */
export function scopesForAccess(access: AccessMap): ApiKeyScope[] {
  const out = new Set<ApiKeyScope>();
  for (const resource of ORDER) {
    const level = access[resource];
    if (level === "none") continue;
    const scopes = level === "write" ? SCOPES[resource].write ?? SCOPES[resource].read : SCOPES[resource].read;
    scopes.forEach((scope) => out.add(scope));
  }
  return [...out];
}

/** How many kinds of data, other than orders, a key's scopes reach. */
export function countExtraResources(scopes: readonly string[]): number {
  const prefixes = new Set(scopes.filter((scope) => !scope.startsWith("orders:")).map((scope) => scope.split(":")[0]));
  return prefixes.size;
}

const STRINGS = {
  en: {
    title: "Other store data",
    hint: "Leave on “No access” anything this integration does not need.",
    none: "No access",
    read: "Read",
    write: "Read and change",
    manage: "Manage",
    products: "Products and stock",
    categories: "Categories",
    customers: "Customers",
    discounts: "Discount codes",
    shipping: "Shipping areas and prices",
    webhooks: "Webhooks",
    analytics: "Sales reports",
  },
  ar: {
    title: "باقي بيانات المتجر",
    hint: "سيب «بدون صلاحية» على أي حاجة الربط ده مش محتاجها.",
    none: "بدون صلاحية",
    read: "قراءة",
    write: "قراءة وتعديل",
    manage: "إدارة",
    products: "المنتجات والمخزون",
    categories: "التصنيفات",
    customers: "العملاء",
    discounts: "أكواد الخصم",
    shipping: "مناطق وأسعار الشحن",
    webhooks: "الـ Webhooks",
    analytics: "تقارير المبيعات",
  },
};

export function ApiKeyAccessPicker({ value, onChange }: { value: AccessMap; onChange: (next: AccessMap) => void }) {
  const t = useT(STRINGS);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">{t.title}</legend>
      <p className="text-xs text-ink-soft">{t.hint}</p>
      <ul className="divide-y divide-line rounded-md border border-line">
        {ORDER.map((resource) => {
          const id = `api-key-access-${resource}`;
          const { read, write } = SCOPES[resource];
          return (
            <li key={resource} className="flex items-center justify-between gap-3 px-3 py-2">
              <label htmlFor={id} className="text-sm text-ink">
                {t[resource]}
              </label>
              <Select
                id={id}
                className="h-9 w-44 shrink-0"
                value={value[resource]}
                onChange={(e) => onChange({ ...value, [resource]: e.target.value as AccessLevel })}
              >
                <option value="none">{t.none}</option>
                {read.length > 0 && <option value="read">{t.read}</option>}
                {write && <option value="write">{read.length > 0 ? t.write : t.manage}</option>}
              </Select>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
