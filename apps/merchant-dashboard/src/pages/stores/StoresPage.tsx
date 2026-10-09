import { useEffect, useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { IconCheck, IconCopy, IconExternal, IconLink, IconPlus, IconStore, IconSuccess, IconWarning } from "@/components/icons";
import { Alert, Button, Card, Input, Label, cn } from "@store-builder/ui";
import { storesDuplicate, storesOverview, type StoreAlert, type StoreOverview } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, formatPercentValue } from "@/lib/format";
import { formatCount } from "@/lib/analytics";
import { countOf } from "@/lib/plural";
import { storeHost, storeUrl } from "@/lib/storeAddress";
import { useT, fmt, useCommon, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState, SkeletonBar } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { CreateStoreSheet } from "./createStore";

const STRINGS = {
  en: {
    title: "All my stores",
    description: "Today in every store you work in. Open one to manage it.",
    newStore: "New store",
    emptyTitle: "No stores yet",
    emptyDescription: "This is where every store you work in shows, with today's orders and sales. Create your first one to start selling.",
    current: "Open now",
    draft: "Draft",
    suspended: "Suspended",
    live: "Live",
    ordersToday: "Orders today",
    salesToday: "Sales today",
    confirmationRate: "Confirmation rate",
    confirmationHint: "Last 30 days",
    held: "With couriers",
    heldHint: "{orders} delivered, not settled yet",
    noData: "—",
    hidden: "Not for your role",
    open: "Open the store",
    visit: "Visit the store",
    copyLink: "Copy the store's link",
    linkCopied: "Link copied",
    duplicate: "Duplicate",
    menu: "Actions for {name}",
    allClear: "Nothing needs your attention.",
    alert_suspended: "This store is suspended. Contact support.",
    alert_billing_restricted: "The subscription has lapsed: the store is restricted.",
    alert_balance_exhausted: "Balance ran out — store stopped",
    alert_draft: "Not live yet — subscribe to publish it.",
    alert_pending_confirmation: "{orders} waiting for confirmation",
    alert_low_stock: "{items} running low on stock",
    role_owner: "Owner",
    role_workspace_manager: "Workspace Manager",
    role_editor: "Editor",
    role_order_operator: "Order Operator",
    role_confirmation_agent: "Confirmation Agent",
    role_fulfillment: "Fulfillment",
    role_accountant: "Accountant",
    duplicateTitle: "Duplicate “{name}”",
    duplicateDescription: "A new store that starts as a copy of this one. Orders, customers, team and integrations are never copied.",
    newName: "Name of the new store",
    nameShort: "Write a name of at least two letters.",
    copyOf: "{name} copy",
    include: "What to copy",
    includeProducts: "Products, variants, offers and collections",
    includeWebsite: "Website pages and theme (as drafts)",
    includeShipping: "Shipping zones, rates and tax",
    duplicating: "Copying…",
    duplicated: "Store copied: {products} and {pages} pages.",
    loading: "Loading your stores…",
  },
  ar: {
    title: "كل متاجري",
    description: "اللي حصل النهارده في كل متجر بتشتغل فيه. افتح أي متجر عشان تديره.",
    newStore: "متجر جديد",
    emptyTitle: "مفيش متاجر لسه",
    emptyDescription: "هنا بيظهر كل متجر بتشتغل فيه، بأوردرات ومبيعات النهارده. اعمل أول متجر عشان تبدأ تبيع.",
    current: "مفتوح دلوقتي",
    draft: "مسودة",
    suspended: "موقوف",
    live: "شغّال",
    ordersToday: "أوردرات النهارده",
    salesToday: "مبيعات النهارده",
    confirmationRate: "نسبة التأكيد",
    confirmationHint: "آخر ٣٠ يوم",
    held: "عند شركات الشحن",
    heldHint: "اتسلّم ولسه متحصّلش: {orders}",
    noData: "—",
    hidden: "مش ضمن صلاحياتك",
    open: "افتح المتجر",
    visit: "زور المتجر",
    copyLink: "انسخ لينك المتجر",
    linkCopied: "اللينك اتنسخ",
    duplicate: "كرّره",
    menu: "إجراءات {name}",
    allClear: "مفيش حاجة محتاجة منك حاجة.",
    alert_suspended: "المتجر ده موقوف. كلّم الدعم.",
    alert_billing_restricted: "الاشتراك خلص: المتجر متقيّد.",
    alert_balance_exhausted: "الرصيد خلص — المتجر واقف",
    alert_draft: "لسه ما اتنشرش — اشترك عشان تنشره.",
    alert_pending_confirmation: "مستني تأكيد: {orders}",
    alert_low_stock: "المخزون قرّب يخلص في {items}",
    role_owner: "صاحب المتجر",
    role_workspace_manager: "مدير المتجر",
    role_editor: "محرر",
    role_order_operator: "مسؤول الأوردرات",
    role_confirmation_agent: "موظف التأكيد",
    role_fulfillment: "موظف الشحن",
    role_accountant: "محاسب",
    duplicateTitle: "تكرّر «{name}»؟",
    duplicateDescription: "متجر جديد يبدأ نسخة من المتجر ده. الأوردرات والعملاء والفريق والربط مع الخدمات مش بيتنسخوا أبدًا.",
    newName: "اسم المتجر الجديد",
    nameShort: "اكتب اسم من حرفين على الأقل.",
    copyOf: "نسخة من {name}",
    include: "إيه اللي يتنسخ",
    includeProducts: "المنتجات والخيارات والعروض والتصنيفات",
    includeWebsite: "صفحات الموقع والثيم (كمسودات)",
    includeShipping: "مناطق وأسعار الشحن والضريبة",
    duplicating: "بننسخ…",
    duplicated: "المتجر اتنسخ: {products} و{pages} صفحة.",
    loading: "بنحمّل متاجرك…",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

function alertText(alert: StoreAlert, t: T): string {
  const count = alert.count ?? 0;
  return fmt(t[`alert_${alert.code}`] ?? alert.code, { orders: countOf("order", count), items: countOf("item", count) });
}

/** One figure of a store: a small well with its label over the number, and what the number covers under it. */
function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div data-slot="store-figure" className="min-w-0 rounded-[0.875rem] bg-paper-sunken/60 px-3 py-2.5">
      <dt className="truncate text-xs leading-4 text-ink-soft">{label}</dt>
      <dd className="mt-0.5 truncate text-[17px] leading-6 font-semibold text-ink tabular-nums">
        <bdi>{value}</bdi>
      </dd>
      {hint && <p className="truncate text-[11px] leading-4 text-ink-soft">{hint}</p>}
    </div>
  );
}

/** Two store cards while the list loads, in the cards' own shape: a header, four figures, a line, the action. */
function StoresSkeleton() {
  return (
    <div aria-hidden className="grid gap-[var(--bento-gap)] lg:grid-cols-2">
      {[0, 1].map((card) => (
        <div key={card} data-slot="skeleton-card" className="rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-5">
          <div className="flex items-center gap-3">
            <SkeletonBar className="size-11 shrink-0 rounded-[0.875rem]" />
            <div className="min-w-0 flex-1">
              <SkeletonBar className="h-4 w-2/5" />
              <SkeletonBar className="mt-2.5 h-2.5 w-3/5" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((figure) => (
              <SkeletonBar key={figure} className="h-[4.25rem] rounded-[0.875rem]" />
            ))}
          </div>
          <SkeletonBar className="mt-4 w-1/2" />
          <SkeletonBar className="mt-4 h-11 w-36" />
        </div>
      ))}
    </div>
  );
}

/** All my stores (SPEC §18.5): every store the user works in, with today's numbers. */
export function StoresPage() {
  const t = useT(STRINGS);
  const toast = useToast();
  const navigate = useNavigate();
  const { currentWorkspace, selectWorkspace, refresh } = useWorkspace();
  // Shown at once from the last visit, refreshed behind.
  const overview = useCachedAsync("stores:overview", () => storesOverview(apiClient), []);
  const stores = overview.data ?? [];
  const [duplicating, setDuplicating] = useState<StoreOverview | null>(null);
  const [creating, setCreating] = useState(false);
  // Stores whose logo did not load: they get the store icon, not the browser's broken image.
  const [failedLogos, setFailedLogos] = useState<ReadonlySet<string>>(new Set());
  const roleName = (role: StoreOverview["role"]) => (t as Record<string, string>)[`role_${role.key}`] ?? role.name;

  function open(storeId: string) {
    selectWorkspace(storeId);
    navigate("/");
  }

  async function copyLink(store: StoreOverview) {
    try {
      await navigator.clipboard.writeText(storeUrl(store.slug));
      toast.success(t.linkCopied);
    } catch {
      /* no clipboard here (an insecure origin): the address is on the card to copy by hand */
    }
  }

  const newStore = (
    <Button onClick={() => setCreating(true)} className="rounded-full px-5">
      <IconPlus weight="bold" className="size-4" aria-hidden />
      {t.newStore}
    </Button>
  );

  return (
    <div className="max-w-6xl">
      <PageHeader title={t.title} description={t.description} primaryAction={newStore} />

      <DataState
        loading={overview.loading}
        error={overview.data ? null : overview.error}
        onRetry={() => void overview.refresh()}
        skeleton={<StoresSkeleton />}
      >
        {stores.length === 0 ? (
          <EmptyState
            icon={<IconStore aria-hidden />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={
              <Button onClick={() => setCreating(true)} className="rounded-full px-5">
                <IconPlus weight="bold" className="size-4" aria-hidden />
                {t.newStore}
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-[var(--bento-gap)] lg:grid-cols-2">
            {stores.map((store) => {
              const value = (shown: string | null) => (shown === null ? t.hidden : shown);
              const isCurrent = store.id === currentWorkspace?.id;
              const suspended = store.status === "suspended";
              const menu: ContextMenuItem[] = [
                { id: "open", label: t.open, icon: IconStore, onSelect: () => open(store.id) },
                ...(store.draft
                  ? []
                  : [{ id: "visit", label: t.visit, icon: IconExternal, onSelect: () => void window.open(storeUrl(store.slug), "_blank", "noopener") }]),
                { id: "copy", label: t.copyLink, icon: IconLink, onSelect: () => void copyLink(store) },
                ...(store.isOwner
                  ? [{ id: "duplicate", label: t.duplicate, icon: IconCopy, onSelect: () => setDuplicating(store), separatorBefore: true }]
                  : []),
              ];
              return (
                <li key={store.id} className="min-w-0">
                  <ContextMenu items={menu} label={fmt(t.menu, { name: store.name })}>
                    <Card data-slot="card" data-store-card="" className="h-full gap-0 p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[0.875rem] bg-primary-soft text-primary">
                          {store.logoUrl && !failedLogos.has(store.id) ? (
                            <img
                              src={store.logoUrl}
                              alt=""
                              className="size-full object-contain"
                              onError={() => setFailedLogos((failed) => new Set(failed).add(store.id))}
                            />
                          ) : (
                            <IconStore className="size-5" weight="duotone" aria-hidden />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h2 dir="auto" className="min-w-0 truncate text-base leading-6 font-semibold text-ink">
                              {store.name}
                            </h2>
                            {suspended ? (
                              <StatusBadge value="suspended" tone="danger" text={t.suspended} />
                            ) : store.draft ? (
                              <StatusBadge value="draft" tone="warning" text={t.draft} />
                            ) : (
                              <StatusBadge value="active" tone="success" text={t.live} />
                            )}
                            {isCurrent && <StatusBadge value="current" tone="info" text={t.current} />}
                          </div>
                          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-ink-soft">
                            {store.draft ? (
                              <bdi dir="ltr" className="min-w-0 truncate">
                                {storeHost(store.slug)}
                              </bdi>
                            ) : (
                              <a
                                href={storeUrl(store.slug)}
                                target="_blank"
                                rel="noreferrer"
                                dir="ltr"
                                aria-label={t.visit}
                                className="relative inline-flex min-w-0 items-center gap-1 underline-offset-4 before:absolute before:-inset-x-1 before:-inset-y-3 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                              >
                                <span className="min-w-0 truncate">{storeHost(store.slug)}</span>
                                <IconExternal className="size-3.5 shrink-0" aria-hidden />
                              </a>
                            )}
                            <span aria-hidden>·</span>
                            <span className="shrink-0">{roleName(store.role)}</span>
                          </p>
                        </div>
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Figure label={t.ordersToday} value={value(store.ordersToday === null ? null : formatCount(store.ordersToday))} />
                        <Figure label={t.salesToday} value={value(store.salesToday === null ? null : formatMoney(store.salesToday, store.currency))} />
                        <Figure
                          label={t.confirmationRate}
                          value={
                            store.ordersToday === null
                              ? t.hidden
                              : store.confirmationRate === null
                                ? t.noData
                                : formatPercentValue(store.confirmationRate / 100, 0)
                          }
                          hint={t.confirmationHint}
                        />
                        <Figure
                          label={t.held}
                          value={store.heldByCouriers === null ? t.hidden : formatMoney(store.heldByCouriers.amount, store.currency)}
                          hint={
                            store.heldByCouriers && store.heldByCouriers.orders > 0
                              ? fmt(t.heldHint, { orders: countOf("order", store.heldByCouriers.orders) })
                              : undefined
                          }
                        />
                      </dl>

                      {store.alerts.length === 0 ? (
                        <p className="mt-3 flex items-center gap-2 text-[13px] leading-5 text-ink-soft">
                          <IconSuccess className="size-4 shrink-0 text-success" aria-hidden />
                          {t.allClear}
                        </p>
                      ) : (
                        <ul className="mt-3 flex flex-wrap gap-1.5">
                          {store.alerts.map((alert) => (
                            <li
                              key={alert.code}
                              data-slot="store-alert"
                              className="inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[13px] leading-5 font-medium text-ink"
                            >
                              <IconWarning className="size-4 shrink-0 text-accent-dark" aria-hidden />
                              <span className="min-w-0">{alertText(alert, t)}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-auto flex flex-wrap gap-2 pt-4">
                        <Button className="min-h-11 flex-1 rounded-full px-5 sm:flex-none" onClick={() => open(store.id)}>
                          {t.open}
                        </Button>
                        {store.isOwner && (
                          <Button variant="outline" className="min-h-11 rounded-full px-4" onClick={() => setDuplicating(store)}>
                            <IconCopy className="size-4" aria-hidden />
                            {t.duplicate}
                          </Button>
                        )}
                      </div>
                    </Card>
                  </ContextMenu>
                </li>
              );
            })}
          </ul>
        )}
      </DataState>

      <CreateStoreSheet
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => void overview.refresh({ silent: true })}
        onOpenDashboard={open}
      />

      <DuplicateStoreSheet
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

type Include = { products: boolean; website: boolean; shipping: boolean };

/** A copy of a store, in a sheet: its name and what comes along. */
function DuplicateStoreSheet({ store, onClose, onDone }: { store: StoreOverview | null; onClose: () => void; onDone: () => Promise<void> }) {
  const t = useT(STRINGS);
  const common = useCommon();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const nameId = useId();
  // The store stays while the sheet closes, so its title does not empty on the way out.
  const [shown, setShown] = useState<StoreOverview | null>(store);
  const [name, setName] = useState("");
  const [include, setInclude] = useState<Include>({ products: true, website: true, shipping: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (!store) return;
    setShown(store);
    setName(fmt(t.copyOf, { name: store.name }));
    setInclude({ products: true, website: true, shipping: true });
    setError(null);
    setNameError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!store) return;
    if (name.trim().length < 2) {
      setNameError(true);
      document.getElementById(nameId)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await storesDuplicate(apiClient, store.id, { name: name.trim(), include });
      toast.success(fmt(t.duplicated, { products: countOf("item", result.copied.products), pages: result.copied.pages }));
      await onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const option = (key: keyof Include, label: string) => (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-[0.875rem] px-3 py-2 text-sm leading-5 text-ink ring-1 ring-inset",
        "transition-[background-color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
        "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-primary",
        include[key] ? "bg-primary-soft ring-primary/40" : "bg-paper-raised ring-line"
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={include[key]}
        disabled={busy}
        onChange={(e) => setInclude({ ...include, [key]: e.target.checked })}
      />
      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-[6px]",
          include[key] ? "bg-primary text-primary-foreground" : "ring-1 ring-line-strong ring-inset"
        )}
      >
        {include[key] && <IconCheck className="size-3.5" weight="bold" />}
      </span>
      <span className="min-w-0">{label}</span>
    </label>
  );

  return (
    <Sheet
      open={store !== null}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
      title={shown ? fmt(t.duplicateTitle, { name: shown.name }) : ""}
      description={t.duplicateDescription}
      size="sm"
      footer={
        <>
          <Button type="button" variant="ghost" className="rounded-full px-4 text-ink-soft hover:text-ink" disabled={busy} onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy}>
            {busy ? t.duplicating : t.duplicate}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="space-y-1.5">
          <Label htmlFor={nameId}>{t.newName}</Label>
          <Input
            id={nameId}
            required
            value={name}
            disabled={busy}
            minLength={2}
            maxLength={200}
            enterKeyHint="done"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${nameId}-error` : undefined}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(false);
            }}
            className={cn("min-h-11 text-base md:text-base", nameError && "border-danger")}
          />
          {nameError && (
            <p id={`${nameId}-error`} role="alert" className="text-[13px] leading-5 font-medium text-danger">
              {t.nameShort}
            </p>
          )}
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-ink">{t.include}</legend>
          {option("products", t.includeProducts)}
          {option("website", t.includeWebsite)}
          {option("shipping", t.includeShipping)}
        </fieldset>
      </form>
    </Sheet>
  );
}
