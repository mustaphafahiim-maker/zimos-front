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

function marginPercent(cost: number, price: number): number {
  if (price <= 0) return 0;
  return Math.round(((price - cost) / price) * 100);
}

function markupPercent(cost: number, price: number): number {
  if (cost <= 0) return 0;
  return Math.round(((price - cost) / cost) * 100);
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-3.5", i <= Math.round(rating) ? "fill-accent text-accent" : "text-line")} />
      ))}
      <span className="ml-1 text-xs tabular-nums text-ink-soft">{rating.toFixed(1)}</span>
    </span>
  );
}

export function SuppliersPage() {
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
      toast.success("Added to catalog as draft — open Catalog to publish it.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Suppliers marketplace" description="Local dropshipping: import products from Egyptian suppliers and sell them without holding stock." />

      <Alert variant="info" className="border-primary/30 bg-primary-soft text-primary-dark">
        <Truck />
        <span>
          Sell without stock: import a product, run ads, and the supplier ships each confirmed COD order directly. Zimos splits the COD payout: supplier cost → supplier, the rest → you.
        </span>
      </Alert>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="pt-4">
          <DataState loading={products.loading || suppliers.loading} error={products.error ?? suppliers.error} onRetry={() => { products.refresh(); suppliers.refresh(); }}>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
                <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 pl-8" dir="auto" />
              </div>
              <Select className="w-56" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} aria-label="Supplier">
                <option value="all">All suppliers</option>
                {supplierList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              <Toggle label="Ships direct only" checked={directOnly} onChange={setDirectOnly} className="items-center gap-2" />
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {["all", ...categories].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  dir="auto"
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    category === c ? "border-primary bg-primary-soft text-primary-dark" : "border-line text-ink-soft hover:bg-paper-raised"
                  )}
                >
                  {c === "all" ? "All categories" : c}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <EmptyState title="No products match" description="Try another category, supplier or search term." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((p) => {
                  const margin = marginPercent(p.costAmount, p.suggestedPriceAmount);
                  const direct = shipsDirect.has(p.supplierId);
                  const busy = busyId === p.id;
                  return (
                    <Card key={p.id} className="overflow-hidden p-0">
                      <div className="relative flex h-32 items-end p-3" style={{ background: p.imageColor }}>
                        <p className="font-display text-base font-medium leading-tight text-white drop-shadow" dir="auto">{p.name}</p>
                        {direct && (
                          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-ink">
                            <Truck className="size-3" /> Ships direct
                          </span>
                        )}
                      </div>
                      <div className="space-y-3 p-4">
                        <p className="truncate text-xs text-ink-soft" dir="auto">{p.supplierName} · {p.category}</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-ink-soft">Cost</p>
                            <p className="font-medium tabular-nums text-ink">{formatMoney(p.costAmount)}</p>
                          </div>
                          <div>
                            <p className="text-ink-soft">Suggested</p>
                            <p className="font-medium tabular-nums text-ink">{formatMoney(p.suggestedPriceAmount)}</p>
                          </div>
                          <div>
                            <p className="text-ink-soft">Margin</p>
                            <p className={cn("font-medium tabular-nums", margin >= 50 ? "text-success" : "text-ink")}>{margin}%</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-line pt-3">
                          <span className={cn("text-xs tabular-nums", p.stock < 100 ? "text-accent-dark" : "text-ink-soft")}>{p.stock.toLocaleString()} in stock</span>
                          {p.imported ? (
                            <Button size="sm" variant="outline" disabled>
                              <Check /> Imported
                            </Button>
                          ) : (
                            <Button size="sm" disabled={busy} onClick={() => setImporting(p)}>
                              {busy ? <Spinner className="size-4" /> : null}
                              {busy ? "Importing…" : "Import to my store"}
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
            <div className="grid gap-4 md:grid-cols-2">
              {supplierList.map((s) => (
                <SupplierCard key={s.id} supplier={s} onRequest={() => toast.success(`Catalog request sent to ${s.name}. They usually reply within a day.`)} />
              ))}
            </div>
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
          Imported products land as drafts in <Link to="/catalog" className="text-primary underline-offset-2 hover:underline">Catalog</Link>.
        </p>
      )}
    </div>
  );
}

function SupplierCard({ supplier, onRequest }: { supplier: Supplier; onRequest: () => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink" dir="auto">{supplier.name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft" dir="auto">
            <MapPin className="size-3" /> {supplier.city} · {supplier.category}
          </p>
        </div>
        {supplier.shipsDirect && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
            <Truck className="size-3" /> Ships direct
          </span>
        )}
      </div>
      <div className="mt-3">
        <RatingStars rating={supplier.rating} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-ink-soft">Products</dt>
          <dd className="font-medium tabular-nums text-ink">{supplier.products.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Lead time</dt>
          <dd className="font-medium tabular-nums text-ink">{supplier.leadTimeDays} day{supplier.leadTimeDays === 1 ? "" : "s"}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Min. order</dt>
          <dd className="font-medium tabular-nums text-ink">{supplier.minOrder} pc{supplier.minOrder === 1 ? "" : "s"}</dd>
        </div>
      </dl>
      <div className="mt-3 border-t border-line pt-3">
        <Button size="sm" variant="outline" onClick={onRequest}>
          Request catalog
        </Button>
      </div>
    </Card>
  );
}

function ImportModal({ product, shipsDirect, onCancel, onConfirm }: { product: SupplierProduct; shipsDirect: boolean; onCancel: () => void; onConfirm: () => void }) {
  const [price, setPrice] = useState(minorToMajorInput(product.suggestedPriceAmount));
  const [direct, setDirect] = useState(shipsDirect);
  const priceMinor = majorToMinor(price);
  const valid = Number.isFinite(priceMinor) && priceMinor > product.costAmount;
  const markup = valid ? markupPercent(product.costAmount, priceMinor) : null;
  const margin = valid ? marginPercent(product.costAmount, priceMinor) : null;

  return (
    <Modal
      open
      onClose={onCancel}
      title="Import to my store"
      description={product.name}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={!valid} onClick={onConfirm}>Import as draft</Button>
        </>
      }
    >
      <div className="space-y-4">
        <MoneyInput
          label="Your selling price"
          required
          value={price}
          onChange={setPrice}
          error={price.trim() !== "" && !valid ? `Must be above the supplier cost of ${formatMoney(product.costAmount)}.` : undefined}
          hint={`Supplier cost ${formatMoney(product.costAmount)} · suggested ${formatMoney(product.suggestedPriceAmount)}`}
        />
        <div className="grid grid-cols-2 gap-3 rounded-[var(--radius-card)] bg-paper-raised p-3 text-sm">
          <div>
            <p className="text-xs text-ink-soft">Markup</p>
            <p className="font-medium tabular-nums text-ink">{markup === null ? "—" : `${markup}%`}</p>
          </div>
          <div>
            <p className="text-xs text-ink-soft">Your share per delivered order</p>
            <p className="font-medium tabular-nums text-success">{valid ? formatMoney(priceMinor - product.costAmount) : "—"} {margin !== null && <span className="text-xs text-ink-soft">({margin}%)</span>}</p>
          </div>
        </div>
        <Toggle
          label="Let supplier ship directly to customer"
          description={shipsDirect ? "Confirmed COD orders are forwarded to the supplier; you never touch the parcel." : "This supplier doesn't ship direct — stock will be sent to you first."}
          checked={direct}
          onChange={setDirect}
          disabled={!shipsDirect}
        />
      </div>
    </Modal>
  );
}
