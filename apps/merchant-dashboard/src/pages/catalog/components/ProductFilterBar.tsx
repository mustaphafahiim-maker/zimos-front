import { useEffect, useMemo, useState } from "react";
import { Input } from "@store-builder/ui";
import type { ProductListParams } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";

const STRINGS = {
  en: {
    search: "Search all products by name",
    sku: "SKU",
    collection: "Collection",
    allCollections: "All collections",
    type: "Type",
    allTypes: "All types",
    physical: "Physical",
    digital: "Digital",
    service: "Service",
    stock: "Stock",
    anyStock: "Any stock",
    inStock: "Can be sold",
    outOfStock: "Out of stock",
    clear: "Clear filters",
  },
  ar: {
    search: "ابحث في كل المنتجات بالاسم",
    sku: "SKU",
    collection: "المجموعة",
    allCollections: "كل المجموعات",
    type: "النوع",
    allTypes: "كل الأنواع",
    physical: "منتج ملموس",
    digital: "منتج رقمي",
    service: "خدمة",
    stock: "المخزون",
    anyStock: "أي مخزون",
    inStock: "متاح للبيع",
    outOfStock: "نفد من المخزون",
    clear: "مسح الفلاتر",
  },
} satisfies Messages;

type Filters = { q: string; sku: string; collectionId: string; productType: string; stock: string };
const EMPTY: Filters = { q: "", sku: "", collectionId: "", productType: "", stock: "" };

/** Typing settles for this long before the server is asked again. */
const DEBOUNCE_MS = 350;

/**
 * The product list's filters, answered by the server (GET /catalog/products:
 * q, sku, collectionId, productType, stock) so they search the whole catalog,
 * not only the page that is loaded. `key` changes when the list must reload.
 */
export function useProductFilters() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const collections = useAsync(() => apiClient.listCollections(workspaceId).catch(() => []), [workspaceId]);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);

  useEffect(() => {
    const timer = window.setTimeout(() => setApplied(draft), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const set = (patch: Partial<Filters>) => setDraft((prev) => ({ ...prev, ...patch }));
  const active = Object.values(draft).some(Boolean);

  const params = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(applied)) if (value.trim()) out[key] = value.trim();
    return out as Partial<ProductListParams>;
  }, [applied]);

  const list = Array.isArray(collections.data) ? (collections.data as { id: string; name: string }[]) : [];

  const bar = (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="search" aria-label={t.search} placeholder={t.search} value={draft.q} onChange={(e) => set({ q: e.target.value })} className="min-h-11 w-56" />
      <Input aria-label={t.sku} placeholder={t.sku} dir="ltr" value={draft.sku} onChange={(e) => set({ sku: e.target.value })} className="min-h-11 w-28" />
      {list.length > 0 && (
        <Select aria-label={t.collection} value={draft.collectionId} onChange={(e) => set({ collectionId: e.target.value })} className="min-h-11 w-auto">
          <option value="">{t.allCollections}</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      <Select aria-label={t.type} value={draft.productType} onChange={(e) => set({ productType: e.target.value })} className="min-h-11 w-auto">
        <option value="">{t.allTypes}</option>
        <option value="physical">{t.physical}</option>
        <option value="digital">{t.digital}</option>
        <option value="service">{t.service}</option>
      </Select>
      <Select aria-label={t.stock} value={draft.stock} onChange={(e) => set({ stock: e.target.value })} className="min-h-11 w-auto">
        <option value="">{t.anyStock}</option>
        <option value="in">{t.inStock}</option>
        <option value="out">{t.outOfStock}</option>
      </Select>
      {active && (
        <button type="button" className="min-h-11 px-2 text-sm text-primary hover:underline" onClick={() => setDraft(EMPTY)}>
          {t.clear}
        </button>
      )}
    </div>
  );

  return { params, key: JSON.stringify(params), bar, active };
}
