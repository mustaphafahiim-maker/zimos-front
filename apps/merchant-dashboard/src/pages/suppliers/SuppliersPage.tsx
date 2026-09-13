import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, MapPin, Search, Star, Truck } from "lucide-react";
import { Alert, Button, Card, Input, Spinner, Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { Supplier, SupplierProduct } from "@/mock/types2";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Toggle } from "@/components/Toggle";
import { Modal } from "@/components/Modal";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Suppliers marketplace",
    description: "Local dropshipping: import products from Egyptian suppliers and sell them without holding stock.",
    banner:
      "Sell without stock: import a product, run ads, and the supplier ships each confirmed COD order directly. ZIMOS splits the COD payout: supplier cost goes to the supplier, the rest goes to you.",
    tabProducts: "Products",
    tabSuppliers: "Suppliers",
    searchPlaceholder: "Search products…",
    supplierAria: "Supplier",
    allSuppliers: "All suppliers",
    shipsDirectOnly: "Ships direct only",
    allCategories: "All categories",
    emptyTitle: "No products match",
    emptyDescription: "Try another category, supplier or search term.",
    noSuppliersTitle: "No suppliers yet",
    noSuppliersDescription: "Suppliers will appear here once they join the marketplace.",
    shipsDirect: "Ships direct",
    cost: "Cost",
    suggested: "Suggested",
    margin: "Margin",
    inStock: "{n} in stock",
    imported: "Imported",
    importing: "Importing…",
    importToStore: "Import to my store",
    importedToast: "Added to catalog as draft — open Catalog to publish it.",
    catalogRequested: "Catalog request sent to {name}. They usually reply within a day.",
    importedNoteBefore: "Imported products land as drafts in",
    catalog: "Catalog",
    ratingAria: "{rating} out of 5",
    products: "Products",
    leadTime: "Lead time",
    leadTimeDays: "{n} days",
    leadTimeDay: "1 day",
    minOrder: "Min. order",
    minOrderPcs: "{n} pcs",
    minOrderPc: "1 pc",
    requestCatalog: "Request catalog",
    importAsDraft: "Import as draft",
    sellingPrice: "Your selling price",
    priceError: "Must be above the supplier cost of {cost}.",
    priceHint: "Supplier cost {cost} · suggested {suggested}",
    markup: "Markup",
    yourShare: "Your share per delivered order",
    directLabel: "Let supplier ship directly to customer",
    directOn: "Confirmed COD orders are forwarded to the supplier; you never touch the parcel.",
    directOff: "This supplier doesn't ship direct — stock will be sent to you first.",
  },
  ar: {
    title: "سوق المورّدين",
    description: "دروبشيبينج محلي: استورد منتجات من مورّدين مصريين وبِعها بدون ما تشيل مخزون.",
    banner:
      "بيع بدون مخزون: استورد منتجًا، شغّل إعلاناتك، والمورّد يشحن كل طلب دفع عند الاستلام مؤكَّد مباشرةً. ZIMOS تقسّم مبلغ التحصيل: تكلفة المورّد تذهب للمورّد، والباقي لك.",
    tabProducts: "المنتجات",
    tabSuppliers: "المورّدون",
    searchPlaceholder: "ابحث في المنتجات…",
    supplierAria: "المورّد",
    allSuppliers: "كل المورّدين",
    shipsDirectOnly: "الشحن المباشر فقط",
    allCategories: "كل الفئات",
    emptyTitle: "لا توجد منتجات مطابقة",
    emptyDescription: "جرّب فئة أو مورّدًا أو كلمة بحث أخرى.",
    noSuppliersTitle: "لا يوجد مورّدون بعد",
    noSuppliersDescription: "سيظهر المورّدون هنا عند انضمامهم إلى السوق.",
    shipsDirect: "شحن مباشر",
    cost: "التكلفة",
    suggested: "السعر المقترح",
    margin: "هامش الربح",
    inStock: "{n} متوفر",
    imported: "تم الاستيراد",
    importing: "جارٍ الاستيراد…",
    importToStore: "استيراد إلى متجري",
    importedToast: "تمت الإضافة إلى الكتالوج كمسودة — افتح الكتالوج لنشره.",
    catalogRequested: "تم إرسال طلب الكتالوج إلى {name}. عادةً يردّون خلال يوم.",
    importedNoteBefore: "المنتجات المستوردة تُضاف كمسودات في",
    catalog: "الكتالوج",
    ratingAria: "{rating} من 5",
    products: "المنتجات",
    leadTime: "مدة التجهيز",
    leadTimeDays: "{n} أيام",
    leadTimeDay: "يوم واحد",
    minOrder: "الحد الأدنى للطلب",
    minOrderPcs: "{n} قطع",
    minOrderPc: "قطعة واحدة",
    requestCatalog: "طلب الكتالوج",
    importAsDraft: "استيراد كمسودة",
    sellingPrice: "سعر البيع الخاص بك",
    priceError: "يجب أن يكون أعلى من تكلفة المورّد ({cost}).",
    priceHint: "تكلفة المورّد {cost} · المقترح {suggested}",
    markup: "نسبة الزيادة",
    yourShare: "نصيبك من كل طلب مُسلَّم",
    directLabel: "اسمح للمورّد بالشحن مباشرةً للعميل",
    directOn: "طلبات الدفع عند الاستلام المؤكدة تُحوَّل إلى المورّد؛ ولن تتعامل مع الشحنة بنفسك.",
    directOff: "هذا المورّد لا يشحن مباشرةً — سيُرسَل المخزون إليك أولًا.",
  },
} satisfies Messages;

function marginPercent(cost: number, price: number): number {
  if (price <= 0) return 0;
  return Math.round(((price - cost) / price) * 100);
}

function markupPercent(cost: number, price: number): number {
  if (cost <= 0) return 0;
  return Math.round(((price - cost) / cost) * 100);
}

function Money({ value }: { value: number }) {
  return <bdi dir="ltr">{formatMoney(value)}</bdi>;
}

function RatingStars({ rating }: { rating: number }) {
  const t = useT(STRINGS);
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={fmt(t.ratingAria, { rating })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-3.5", i <= Math.round(rating) ? "fill-warning text-warning" : "text-line")} />
      ))}
      <span className="ms-1 text-xs tabular-nums text-ink-soft">{rating.toFixed(1)}</span>
    </span>
  );
}

export function SuppliersPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const products = useAsync(() => mockApi.listSupplierProducts(workspaceId), [workspaceId]);
  const suppliers = useAsync(() => mockApi.listSuppliers(), []);

  const [tab, setTab] = useState("products");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [supplierId, setSupplierId] = useState<string>("all");
  const [directOnly, setDirectOnly] = useState(false);
  const [importing, setImporting] = useState<SupplierProduct | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const productList = products.data ?? [];
  const supplierList = suppliers.data ?? [];
  const shipsDirect = useMemo(() => new Set(supplierList.filter((s) => s.shipsDirect).map((s) => s.id)), [supplierList]);
  const categories = useMemo(() => Array.from(new Set(productList.map((p) => p.category))), [productList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productList.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (supplierId !== "all" && p.supplierId !== supplierId) return false;
      if (directOnly && !shipsDirect.has(p.supplierId)) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.supplierName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [productList, search, category, supplierId, directOnly, shipsDirect]);

  async function confirmImport(product: SupplierProduct) {
    setImporting(null);
    setBusyId(product.id);
    try {
      await mockApi.importSupplierProduct(workspaceId, product.id);
      products.setData((prev) => (prev ?? []).map((p) => (p.id === product.id ? { ...p, imported: true } : p)));
      toast.success(t.importedToast);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title={t.title} description={t.description} />

      <Alert variant="info" className="rounded-2xl border-primary/30 bg-primary-soft text-primary-dark">
        <Truck />
        <span>{t.banner}</span>
      </Alert>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList>
          <TabsTrigger value="products">{t.tabProducts}</TabsTrigger>
          <TabsTrigger value="suppliers">{t.tabSuppliers}</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="pt-4">
          <DataState loading={products.loading || suppliers.loading} error={products.error ?? suppliers.error} onRetry={() => { products.refresh(); suppliers.refresh(); }}>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
                <Input placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full ps-8" dir="auto" />
              </div>
              <Select className="w-full sm:w-56" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} aria-label={t.supplierAria}>
                <option value="all">{t.allSuppliers}</option>
                {supplierList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              <Toggle label={t.shipsDirectOnly} checked={directOnly} onChange={setDirectOnly} className="items-center gap-2" />
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {["all", ...categories].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  dir="auto"
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    category === cat ? "border-primary bg-primary-soft text-primary-dark" : "border-line text-ink-soft hover:bg-paper-raised"
                  )}
                >
                  {cat === "all" ? t.allCategories : cat}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <EmptyState title={t.emptyTitle} description={t.emptyDescription} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((p) => {
                  const margin = marginPercent(p.costAmount, p.suggestedPriceAmount);
                  const direct = shipsDirect.has(p.supplierId);
                  const busy = busyId === p.id;
                  return (
                    <Card key={p.id} className="overflow-hidden rounded-2xl p-0">
                      <div className="relative flex h-32 items-end p-3" style={{ background: p.imageColor }}>
                        <p className="font-display text-base font-semibold leading-tight text-white drop-shadow" dir="auto">{p.name}</p>
                        {direct && (
                          <span className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-ink">
                            <Truck className="size-3" /> {t.shipsDirect}
                          </span>
                        )}
                      </div>
                      <div className="space-y-3 p-4">
                        <p className="truncate text-xs text-ink-soft" dir="auto">{p.supplierName} · {p.category}</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-ink-soft">{t.cost}</p>
                            <p className="font-medium tabular-nums text-ink"><Money value={p.costAmount} /></p>
                          </div>
                          <div>
                            <p className="text-ink-soft">{t.suggested}</p>
                            <p className="font-medium tabular-nums text-ink"><Money value={p.suggestedPriceAmount} /></p>
                          </div>
                          <div>
                            <p className="text-ink-soft">{t.margin}</p>
                            <p className={cn("font-medium tabular-nums", margin >= 50 ? "text-success" : "text-ink")}><bdi dir="ltr">{margin}%</bdi></p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                          <span className={cn("text-xs tabular-nums", p.stock < 100 ? "text-warning" : "text-ink-soft")}>{fmt(t.inStock, { n: p.stock.toLocaleString() })}</span>
                          {p.imported ? (
                            <Button size="sm" variant="outline" disabled>
                              <Check /> {t.imported}
                            </Button>
                          ) : (
                            <Button size="sm" disabled={busy} onClick={() => setImporting(p)}>
                              {busy ? <Spinner className="size-4" /> : null}
                              {busy ? t.importing : t.importToStore}
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </DataState>
        </TabsContent>

        <TabsContent value="suppliers" className="pt-4">
          <DataState loading={suppliers.loading} error={suppliers.error} onRetry={() => suppliers.refresh()}>
            {supplierList.length === 0 ? (
              <EmptyState title={t.noSuppliersTitle} description={t.noSuppliersDescription} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {supplierList.map((s) => (
                  <SupplierCard key={s.id} supplier={s} onRequest={() => toast.success(fmt(t.catalogRequested, { name: s.name }))} />
                ))}
              </div>
            )}
          </DataState>
        </TabsContent>
      </Tabs>

      {importing && (
        <ImportModal
          key={importing.id}
          product={importing}
          shipsDirect={shipsDirect.has(importing.supplierId)}
          onCancel={() => setImporting(null)}
          onConfirm={() => confirmImport(importing)}
        />
      )}

      {productList.some((p) => p.imported) && (
        <p className="text-xs text-ink-soft">
          {t.importedNoteBefore} <Link to="/catalog" className="text-primary underline-offset-2 hover:underline">{t.catalog}</Link>.
        </p>
      )}
    </div>
  );
}

function SupplierCard({ supplier, onRequest }: { supplier: Supplier; onRequest: () => void }) {
  const t = useT(STRINGS);
  return (
    <Card className="rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink" dir="auto">{supplier.name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft" dir="auto">
            <MapPin className="size-3" /> {supplier.city} · {supplier.category}
          </p>
        </div>
        {supplier.shipsDirect && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
            <Truck className="size-3" /> {t.shipsDirect}
          </span>
        )}
      </div>
      <div className="mt-3">
        <RatingStars rating={supplier.rating} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-ink-soft">{t.products}</dt>
          <dd className="font-medium tabular-nums text-ink">{supplier.products.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">{t.leadTime}</dt>
          <dd className="font-medium tabular-nums text-ink">{supplier.leadTimeDays === 1 ? t.leadTimeDay : fmt(t.leadTimeDays, { n: supplier.leadTimeDays })}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">{t.minOrder}</dt>
          <dd className="font-medium tabular-nums text-ink">{supplier.minOrder === 1 ? t.minOrderPc : fmt(t.minOrderPcs, { n: supplier.minOrder })}</dd>
        </div>
      </dl>
      <div className="mt-3 border-t border-line pt-3">
        <Button size="sm" variant="outline" onClick={onRequest}>
          {t.requestCatalog}
        </Button>
      </div>
    </Card>
  );
}

function ImportModal({ product, shipsDirect, onCancel, onConfirm }: { product: SupplierProduct; shipsDirect: boolean; onCancel: () => void; onConfirm: () => void }) {
  const t = useT(STRINGS);
  const c = useCommon();
  const [price, setPrice] = useState(minorToMajorInput(product.suggestedPriceAmount));
  const [direct, setDirect] = useState(shipsDirect);
  const priceMinor = majorToMinor(price);
  const valid = Number.isFinite(priceMinor) && priceMinor > product.costAmount;
  const markup = valid ? markupPercent(product.costAmount, priceMinor) : null;
  const margin = valid ? marginPercent(product.costAmount, priceMinor) : null;

  // Money strings get LTR isolation marks so they don't reorder inside Arabic text.
  const cost = `⁦${formatMoney(product.costAmount)}⁩`;
  const suggested = `⁦${formatMoney(product.suggestedPriceAmount)}⁩`;

  return (
    <Modal
      open
      onClose={onCancel}
      title={t.importToStore}
      description={product.name}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>{c.cancel}</Button>
          <Button disabled={!valid} onClick={onConfirm}>{t.importAsDraft}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <MoneyInput
          label={t.sellingPrice}
          required
          value={price}
          onChange={setPrice}
          error={price.trim() !== "" && !valid ? fmt(t.priceError, { cost }) : undefined}
          hint={fmt(t.priceHint, { cost, suggested })}
        />
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-paper p-3 text-sm">
          <div>
            <p className="text-xs text-ink-soft">{t.markup}</p>
            <p className="font-medium tabular-nums text-ink"><bdi dir="ltr">{markup === null ? "—" : `${markup}%`}</bdi></p>
          </div>
          <div>
            <p className="text-xs text-ink-soft">{t.yourShare}</p>
            <p className="font-medium tabular-nums text-success">
              {valid ? <Money value={priceMinor - product.costAmount} /> : "—"}{" "}
              {margin !== null && <span className="text-xs text-ink-soft"><bdi dir="ltr">({margin}%)</bdi></span>}
            </p>
          </div>
        </div>
        <Toggle
          label={t.directLabel}
          description={shipsDirect ? t.directOn : t.directOff}
          checked={direct}
          onChange={setDirect}
          disabled={!shipsDirect}
        />
      </div>
    </Modal>
  );
}
