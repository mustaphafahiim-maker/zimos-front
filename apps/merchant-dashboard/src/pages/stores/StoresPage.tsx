import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Copy, Plus, Store } from "lucide-react";
import { Alert, Button, Card } from "@store-builder/ui";
import { storesDuplicate, storesOverview, type StoreAlert, type StoreOverview } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney } from "@/lib/format";
import { useT, fmt, useCommon, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "All my stores",
    description: "Today in every store you work in. Open one to manage it.",
    newStore: "New store",
    emptyTitle: "No stores yet",
    emptyDescription: "Create your first store to start selling.",
    current: "Open now",
    draft: "Draft",
    suspended: "Suspended",
    ordersToday: "Orders today",
    salesToday: "Sales today",
    confirmationRate: "Confirmation rate",
    confirmationHint: "Last 30 days",
    held: "With couriers",
    heldHint: "{count} delivered orders not settled",
    noData: "—",
    hidden: "Not shown for your role",
    open: "Open store",
    duplicate: "Duplicate",
    allClear: "Nothing needs attention.",
    alert_suspended: "This store is suspended. Contact support.",
    alert_billing_restricted: "The subscription has lapsed: the store is restricted.",
    alert_draft: "Not live yet — subscribe to publish it.",
    alert_pending_confirmation: "{count} orders waiting for confirmation",
    alert_low_stock: "{count} products running low on stock",
    duplicateTitle: "Duplicate “{name}”",
    duplicateDescription: "A new store that starts as a copy of this one. Orders, customers, team and integrations are never copied.",
    newName: "Name of the new store",
    copyOf: "{name} copy",
    include: "What to copy",
    includeProducts: "Products, variants, offers and collections",
    includeWebsite: "Website pages and theme (as drafts)",
    includeShipping: "Shipping zones, rates and tax",
    duplicating: "Copying…",
    duplicated: "Store copied: {products} products and {pages} pages.",
  },
  ar: {
    title: "كل متاجري",
    description: "ما حدث اليوم في كل متجر تعمل فيه. افتح أي متجر لإدارته.",
    newStore: "متجر جديد",
    emptyTitle: "مفيش متاجر لسه",
    emptyDescription: "أنشئ أول متجر لتبدأ البيع.",
    current: "مفتوح الآن",
    draft: "مسودة",
    suspended: "موقوف",
    ordersToday: "طلبات اليوم",
    salesToday: "مبيعات اليوم",
    confirmationRate: "نسبة التأكيد",
    confirmationHint: "آخر 30 يوم",
    held: "عند شركات الشحن",
    heldHint: "{count} طلب مُسلَّم لم يُحصَّل",
    noData: "—",
    hidden: "غير متاح لدورك",
    open: "فتح المتجر",
    duplicate: "تكرار",
    allClear: "لا شيء يحتاج انتباهك.",
    alert_suspended: "هذا المتجر موقوف. تواصل مع الدعم.",
    alert_billing_restricted: "انتهى الاشتراك: المتجر مقيَّد.",
    alert_draft: "لم يُنشر بعد — اشترك لنشره.",
    alert_pending_confirmation: "{count} طلب في انتظار التأكيد",
    alert_low_stock: "{count} منتج قارب مخزونه على النفاد",
    duplicateTitle: "تكرار «{name}»",
    duplicateDescription: "متجر جديد يبدأ كنسخة من هذا المتجر. الطلبات والعملاء والفريق والربط مع الخدمات لا تُنسخ أبدًا.",
    newName: "اسم المتجر الجديد",
    copyOf: "نسخة من {name}",
    include: "ما الذي يُنسخ",
    includeProducts: "المنتجات والخيارات والعروض والتصنيفات",
    includeWebsite: "صفحات الموقع والثيم (كمسودات)",
    includeShipping: "مناطق وأسعار الشحن والضريبة",
    duplicating: "بننسخ…",
    duplicated: "تم نسخ المتجر: {products} منتج و{pages} صفحة.",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

function alertText(alert: StoreAlert, t: T): string {
  return fmt(t[`alert_${alert.code}`] ?? alert.code, { count: alert.count ?? 0 });
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="tabular-nums mt-0.5 truncate text-lg font-semibold text-ink">{value}</dd>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

/** All my stores (SPEC §18.5): every store the user works in, with today's numbers. */
export function StoresPage() {
  const t = useT(STRINGS);
  const navigate = useNavigate();
  const { currentWorkspace, selectWorkspace, refresh } = useWorkspace();
  const overview = useAsync(() => storesOverview(apiClient), []);
  const stores = overview.data ?? [];
  const [duplicating, setDuplicating] = useState<StoreOverview | null>(null);

  function open(store: StoreOverview) {
    selectWorkspace(store.id);
    navigate("/");
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => navigate("/workspaces")}>
            <Plus className="size-4" aria-hidden />
            {t.newStore}
          </Button>
        }
      />

      <DataState loading={overview.loading} error={overview.error} onRetry={() => void overview.refresh()}>
        {stores.length === 0 ? (
          <EmptyState
            icon={<Store className="size-6" aria-hidden />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={<Button onClick={() => navigate("/workspaces")}>{t.newStore}</Button>}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {stores.map((store) => {
              const value = (shown: string | null) => (shown === null ? t.hidden : shown);
              return (
                <Card key={store.id} className="gap-0 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary">
                        {store.logoUrl ? <img src={store.logoUrl} alt="" className="size-full object-contain" /> : <Store className="size-5" aria-hidden />}
                      </div>
                      <div className="min-w-0">
                        <h2 dir="auto" className="truncate text-base font-semibold text-ink">
                          {store.name}
                        </h2>
                        <p className="truncate text-xs text-ink-soft">
                          <bdi dir="ltr">{store.slug}</bdi> · {store.role.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {store.id === currentWorkspace?.id && <StatusBadge value="current" tone="info" text={t.current} />}
                      {store.draft && <StatusBadge value="draft" tone="warning" text={t.draft} />}
                      {store.status === "suspended" && <StatusBadge value="suspended" tone="danger" text={t.suspended} />}
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Figure label={t.ordersToday} value={value(store.ordersToday === null ? null : String(store.ordersToday))} />
                    <Figure label={t.salesToday} value={value(store.salesToday === null ? null : formatMoney(store.salesToday, store.currency))} />
                    <Figure
                      label={t.confirmationRate}
                      value={store.ordersToday === null ? t.hidden : store.confirmationRate === null ? t.noData : `${store.confirmationRate}%`}
                      hint={t.confirmationHint}
                    />
                    <Figure
                      label={t.held}
                      value={store.heldByCouriers === null ? t.hidden : formatMoney(store.heldByCouriers.amount, store.currency)}
                      hint={store.heldByCouriers ? fmt(t.heldHint, { count: store.heldByCouriers.orders }) : undefined}
                    />
                  </dl>

                  <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
                    {store.alerts.length === 0 && <li className="text-ink-soft">{t.allClear}</li>}
                    {store.alerts.map((alert) => (
                      <li key={alert.code} className="flex items-start gap-2 text-ink">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-dark" aria-hidden />
                        {alertText(alert, t)}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" className="min-h-9" onClick={() => open(store)}>
                      {t.open}
                    </Button>
                    {store.isOwner && (
                      <Button size="sm" variant="outline" className="min-h-9" onClick={() => setDuplicating(store)}>
                        <Copy className="size-4" aria-hidden />
                        {t.duplicate}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </DataState>

      <DuplicateStoreModal
        store={duplicating}
        onClose={() => setDuplicating(null)}
        onDone={async () => {
          setDuplicating(null);
          await refresh({ silent: true });
          void overview.refresh({ silent: true });
        }}
      />
    </div>
  );
}

function DuplicateStoreModal({ store, onClose, onDone }: { store: StoreOverview | null; onClose: () => void; onDone: () => Promise<void> }) {
  const t = useT(STRINGS);
  const common = useCommon();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [include, setInclude] = useState({ products: true, website: true, shipping: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    setName(fmt(t.copyOf, { name: store.name }));
    setInclude({ products: true, website: true, shipping: true });
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!store) return;
    setBusy(true);
    setError(null);
    try {
      const result = await storesDuplicate(apiClient, store.id, { name: name.trim(), include });
      toast.success(fmt(t.duplicated, { products: result.copied.products, pages: result.copied.pages }));
      await onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const option = (key: keyof typeof include, label: string) => (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input type="checkbox" checked={include[key]} onChange={(e) => setInclude({ ...include, [key]: e.target.checked })} />
      {label}
    </label>
  );

  return (
    <Modal
      open={store !== null}
      onClose={busy ? () => undefined : onClose}
      title={store ? fmt(t.duplicateTitle, { name: store.name }) : ""}
      description={t.duplicateDescription}
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField label={t.newName} required value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={200} />
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t.include}</legend>
          {option("products", t.includeProducts)}
          {option("website", t.includeWebsite)}
          {option("shipping", t.includeShipping)}
        </fieldset>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" disabled={busy || name.trim().length < 2}>
            {busy ? t.duplicating : t.duplicate}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
