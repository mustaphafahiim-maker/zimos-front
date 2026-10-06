import { useState } from "react";
import { Layers } from "lucide-react";
import { Alert, Button, Card, Input } from "@store-builder/ui";
import {
  bundlesDelete,
  bundlesGet,
  bundlesList,
  bundlesSetProducts,
  bundlesUpdate,
  type BundleDto,
  type BundleTierDto,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { BundleEditorDialog } from "./BundleEditorDialog";
import { OfferNumbers, useOfferStats } from "./OfferNumbers";

/**
 * Quantity bundles (SPEC §10.1): the list of the store's bundles, each with
 * its ladder and the products that use it.
 */

const STRINGS = {
  en: {
    title: "Bundles",
    description: "Quantity offers — buy more, pay less per piece. Build one and use it on any number of products.",
    back: "Offers",
    newBundle: "New bundle",
    emptyTitle: "No bundles yet",
    emptyDescription: "Offer 5% off two pieces and 10% off three, and raise the value of every order.",
    active: "Active",
    inactive: "Off",
    products: "{count} products",
    noProducts: "Not on any product yet",
    edit: "Edit",
    chooseProducts: "Products",
    turnOn: "Turn on",
    turnOff: "Turn off",
    delete: "Delete",
    deleteConfirm: "Delete “{name}”? Its products go back to their normal price.",
    deleted: "Bundle deleted.",
    tier_percentage: "{q} pcs · {v}% off",
    tier_fixed_price: "{q} pcs · {v}",
    tier_fixed_amount_off: "{q} pcs · {v} off",
    tier_buy_x_get_y: "{q} pcs · {v} free",
    tier_none: "{q} pcs",
    freeShipping: "free shipping",
    productsTitle: "Products using “{name}”",
    productsDescription: "A product has one bundle. Ticking a product here takes it off any other bundle.",
    search: "Search products",
    noMatch: "No products match.",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    productsSaved: "Products saved.",
  },
  ar: {
    title: "الباقات",
    description: "عروض الكمية — اشترِ أكثر وادفع أقل للقطعة. أنشئ باقة واستخدمها على أي عدد من المنتجات.",
    back: "العروض",
    newBundle: "باقة جديدة",
    emptyTitle: "مفيش باقات لسه",
    emptyDescription: "قدّم خصم 5% على قطعتين و10% على ثلاث، وارفع قيمة كل أوردر.",
    active: "مفعّلة",
    inactive: "متوقفة",
    products: "{count} منتج",
    noProducts: "غير مستخدمة على أي منتج بعد",
    edit: "تعديل",
    chooseProducts: "المنتجات",
    turnOn: "تفعيل",
    turnOff: "إيقاف",
    delete: "حذف",
    deleteConfirm: "حذف «{name}»؟ منتجاتها ترجع لسعرها العادي.",
    deleted: "تم حذف الباقة.",
    tier_percentage: "{q} قطع · خصم {v}%",
    tier_fixed_price: "{q} قطع · {v}",
    tier_fixed_amount_off: "{q} قطع · خصم {v}",
    tier_buy_x_get_y: "{q} قطع · {v} مجانًا",
    tier_none: "{q} قطع",
    freeShipping: "شحن مجاني",
    productsTitle: "المنتجات التي تستخدم «{name}»",
    productsDescription: "للمنتج باقة واحدة. تحديد منتج هنا ينقله من أي باقة أخرى.",
    search: "ابحث في المنتجات",
    noMatch: "مفيش منتجات مطابقة.",
    cancel: "إلغاء",
    save: "حفظ",
    saving: "بنحفظ…",
    productsSaved: "تم حفظ المنتجات.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

function tierText(tier: BundleTierDto, t: Strings): string {
  const q = tier.quantity;
  if (!tier.discountValue) return fmt(t.tier_none, { q });
  const v =
    tier.discountType === "percentage"
      ? String(tier.discountValue / 100)
      : tier.discountType === "buy_x_get_y"
        ? String(tier.discountValue)
        : formatMoney(tier.discountValue);
  return fmt(t[`tier_${tier.discountType}`], { q, v });
}

export function BundlesPage() {
  // Each offer's views, acceptances and added revenue (SPEC §10.11).
  const stats = useOfferStats();
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => bundlesList(apiClient, workspaceId), [workspaceId]);
  const [editing, setEditing] = useState<BundleDto | "new" | null>(null);
  const [assigning, setAssigning] = useState<BundleDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const bundles = list.data ?? [];
  const reload = () => list.refresh({ silent: true });

  async function act(bundle: BundleDto, run: () => Promise<unknown>, done?: string) {
    setBusyId(bundle.id);
    try {
      await run();
      if (done) toast.success(done);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const newButton = (
    <Button type="button" onClick={() => setEditing("new")}>
      {t.newBundle}
    </Button>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader title={t.title} description={t.description} back={{ to: "/offers", label: t.back }} actions={newButton} />

      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        {bundles.length === 0 ? (
          <EmptyState icon={<Layers />} title={t.emptyTitle} description={t.emptyDescription} action={newButton} />
        ) : (
          <div className="space-y-3">
            {bundles.map((bundle) => (
              <Card key={bundle.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-medium text-ink">{bundle.name}</h2>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {bundle.productCount > 0 ? fmt(t.products, { count: bundle.productCount }) : t.noProducts}
                    </p>
                    <OfferNumbers stat={stats?.bundles[bundle.id]} />
                  </div>
                  <StatusBadge
                    value={bundle.isActive ? "active" : "inactive"}
                    tone={bundle.isActive ? "success" : "neutral"}
                    text={bundle.isActive ? t.active : t.inactive}
                  />
                </div>
                <ul className="flex flex-wrap gap-2">
                  {bundle.tiers.map((tier) => (
                    <li key={tier.id} className="rounded-full border border-line bg-paper px-3 py-1 text-xs text-ink">
                      {tierText(tier, t)}
                      {tier.freeShipping ? ` · ${t.freeShipping}` : ""}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busyId === bundle.id} onClick={() => setEditing(bundle)}>
                    {t.edit}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busyId === bundle.id} onClick={() => setAssigning(bundle)}>
                    {t.chooseProducts}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === bundle.id}
                    onClick={() =>
                      void act(bundle, () => bundlesUpdate(apiClient, workspaceId, bundle.id, { isActive: !bundle.isActive }))
                    }
                  >
                    {bundle.isActive ? t.turnOff : t.turnOn}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ms-auto text-danger hover:bg-danger-soft"
                    disabled={busyId === bundle.id}
                    onClick={() => {
                      if (window.confirm(fmt(t.deleteConfirm, { name: bundle.name }))) {
                        void act(bundle, () => bundlesDelete(apiClient, workspaceId, bundle.id), t.deleted);
                      }
                    }}
                  >
                    {t.delete}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </DataState>

      {editing && (
        <BundleEditorDialog
          bundle={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            const wasNew = editing === "new";
            setEditing(null);
            void reload();
            // A new bundle does nothing until it is on a product: go there next.
            if (wasNew) setAssigning(saved);
          }}
        />
      )}
      {assigning && (
        <BundleProductsDialog
          bundle={assigning}
          onClose={() => setAssigning(null)}
          onSaved={() => {
            setAssigning(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function BundleProductsDialog({ bundle, onClose, onSaved }: { bundle: BundleDto; onClose: () => void; onSaved: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [selected, setSelected] = useState<ReadonlySet<string> | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = useAsync(async () => {
    const [full, products] = await Promise.all([
      bundlesGet(apiClient, workspaceId, bundle.id),
      apiClient.listProducts(workspaceId, { status: ["draft", "active"], limit: 200 }),
    ]);
    setSelected(new Set((full.products ?? []).map((p) => p.id)));
    return products.products;
  }, [workspaceId, bundle.id]);

  const q = search.trim().toLowerCase();
  const shown = (data.data ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));

  async function save() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await bundlesSetProducts(apiClient, workspaceId, bundle.id, [...selected]);
      toast.success(t.productsSaved);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={fmt(t.productsTitle, { name: bundle.name })}
      description={t.productsDescription}
      footer={
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" disabled={busy || !selected} onClick={() => void save()}>
            {busy ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input aria-label={t.search} placeholder={t.search} value={search} onChange={(e) => setSearch(e.target.value)} />
        <DataState loading={data.loading} error={data.error} onRetry={() => data.refresh()} empty={shown.length === 0} emptyMessage={t.noMatch}>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-[0.5rem] border border-line">
            {shown.map((product) => (
              <li key={product.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm text-ink hover:bg-paper">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={selected?.has(product.id) ?? false}
                    disabled={busy}
                    onChange={() =>
                      setSelected((current) => {
                        const next = new Set(current ?? []);
                        if (next.has(product.id)) next.delete(product.id);
                        else next.add(product.id);
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0 truncate">{product.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </DataState>
        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
