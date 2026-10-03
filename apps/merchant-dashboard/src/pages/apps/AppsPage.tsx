import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, cn } from "@store-builder/ui";
import { LayoutGrid, Plug, Search } from "lucide-react";
import {
  appsInstall,
  appsList,
  appsUninstall,
  appsUninstallExternal,
  type AppDto,
  type ExternalAppDto,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const STRINGS = {
  en: {
    title: "Apps",
    description: "Switch on what your store needs and connect it to the tools you already use.",
    installed: "Installed",
    discover: "Discover",
    tabsLabel: "Show installed apps or all apps",
    search: "Search apps",
    allCategories: "All",
    categoriesLabel: "Filter apps by category",
    free: "Free",
    monthly: "{price} / month",
    once: "{price} once",
    comingSoon: "Coming soon",
    test: "Test",
    install: "Install",
    installing: "Installing…",
    open: "Open",
    uninstall: "Uninstall",
    installedBadge: "Installed",
    installedToast: "{name} is installed.",
    uninstalledToast: "{name} was uninstalled.",
    noInstalledTitle: "No apps installed yet",
    noInstalledBody: "Browse the apps and install the ones your store needs.",
    browse: "Browse apps",
    noMatchTitle: "No app matches",
    noMatchBody: "Try another word or category.",
    connectedTitle: "Connected by a link",
    connectedHint: "Outside services you approved. Uninstalling revokes their key and removes their webhooks.",
    scopes: "{count} permission(s)",
    hooks: "{count} webhook(s)",
    uninstallTitle: "Uninstall {name}?",
    uninstallBody: "Its API key stops working at once and its webhooks are removed.",
    uninstallFeatureBody: "You can install it again at any time.",
    cancel: "Cancel",
    working: "Working…",
  },
  ar: {
    title: "التطبيقات",
    description: "شغّل اللي متجرك محتاجه واربطه بالأدوات اللي بتستخدمها.",
    installed: "المثبّتة",
    discover: "استكشف",
    tabsLabel: "عرض التطبيقات المثبّتة أو كل التطبيقات",
    search: "دوّر على تطبيق",
    allCategories: "الكل",
    categoriesLabel: "فلترة التطبيقات بالتصنيف",
    free: "مجاني",
    monthly: "{price} / شهريًا",
    once: "{price} مرة واحدة",
    comingSoon: "قريبًا",
    test: "تجريبي",
    install: "تثبيت",
    installing: "جارٍ التثبيت…",
    open: "فتح",
    uninstall: "إلغاء التثبيت",
    installedBadge: "مثبّت",
    installedToast: "تم تثبيت {name}.",
    uninstalledToast: "تم إلغاء تثبيت {name}.",
    noInstalledTitle: "مفيش تطبيقات مثبّتة لسه",
    noInstalledBody: "تصفّح التطبيقات وثبّت اللي متجرك محتاجه.",
    browse: "تصفّح التطبيقات",
    noMatchTitle: "مفيش تطبيق مطابق",
    noMatchBody: "جرّب كلمة أو تصنيف تاني.",
    connectedTitle: "مربوطة عن طريق رابط",
    connectedHint: "خدمات خارجية وافقت عليها. إلغاء التثبيت بيوقف المفتاح بتاعها ويشيل الـ webhooks.",
    scopes: "{count} صلاحية",
    hooks: "{count} webhook",
    uninstallTitle: "إلغاء تثبيت {name}؟",
    uninstallBody: "مفتاح الـ API بتاعه هيقف فورًا والـ webhooks هتتشال.",
    uninstallFeatureBody: "تقدر تثبّته تاني في أي وقت.",
    cancel: "إلغاء",
    working: "جارٍ التنفيذ…",
  },
} satisfies Messages;

type Tab = "installed" | "discover";
type Removing = { kind: "app"; app: AppDto } | { kind: "external"; app: ExternalAppDto };

export function AppsPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => appsList(apiClient, workspaceId), [workspaceId]);
  const [tab, setTab] = useState<Tab>("discover");
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Removing | null>(null);

  const apps = list.data?.apps ?? [];
  const external = list.data?.external ?? [];
  const categories = list.data?.categories ?? [];

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return apps.filter((app) => {
      if (tab === "installed" && !app.installed) return false;
      if (tab === "discover" && category !== "all" && app.category !== category) return false;
      if (!needle) return true;
      return [app.name.en, app.name.ar, app.description.en, app.description.ar].some((text) => text.toLowerCase().includes(needle));
    });
  }, [apps, tab, category, query]);

  const priceLabel = (app: AppDto) => {
    if (!app.price) return t.free;
    const price = `${(Number(app.price.amount) / 100).toLocaleString()} ${app.price.currency ?? ""}`.trim();
    return fmt(app.price.billing === "monthly" ? t.monthly : t.once, { price });
  };

  async function install(app: AppDto) {
    setBusy(app.key);
    try {
      await appsInstall(apiClient, workspaceId, app.key);
      toast.success(fmt(t.installedToast, { name: app.name[locale] }));
      await list.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const nothingInstalled = tab === "installed" && shown.length === 0 && external.length === 0 && !query.trim();

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label={t.tabsLabel}
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "discover", label: t.discover },
            { value: "installed", label: t.installed },
          ]}
        />
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">{t.search}</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="h-10 w-full rounded-[0.5rem] border border-line-strong bg-paper-raised ps-9 pe-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </label>
      </div>

      {tab === "discover" && categories.length > 0 && (
        <FilterTabs
          className="mb-4"
          label={t.categoriesLabel}
          value={category}
          onChange={setCategory}
          tabs={[{ value: "all", label: t.allCategories }, ...categories.map((c) => ({ value: c.key, label: c.name[locale] }))]}
        />
      )}

      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {nothingInstalled ? (
          <EmptyState
            icon={<LayoutGrid />}
            title={t.noInstalledTitle}
            description={t.noInstalledBody}
            action={<Button onClick={() => setTab("discover")}>{t.browse}</Button>}
          />
        ) : shown.length === 0 && (tab === "discover" || query.trim()) ? (
          <EmptyState icon={<Search />} title={t.noMatchTitle} description={t.noMatchBody} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((app) => {
              const soon = app.availability === "coming_soon";
              return (
                <li key={app.key}>
                  <Card className={cn("flex h-full flex-col gap-3 p-4", soon && "opacity-75")}>
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                        {app.kind === "integration" ? <Plug className="size-5" aria-hidden /> : <LayoutGrid className="size-5" aria-hidden />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                          {app.name[locale]}
                          {app.isTest && <StatusBadge value="test" tone="warning" text={t.test} />}
                          {app.installed && <StatusBadge value="installed" tone="success" text={t.installedBadge} />}
                        </h2>
                        <p className="mt-0.5 text-xs text-ink-soft">{categories.find((c) => c.key === app.category)?.name[locale]}</p>
                      </div>
                    </div>
                    <p className="flex-1 text-sm text-ink-soft">{app.description[locale]}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-ink-soft">{soon ? t.comingSoon : priceLabel(app)}</span>
                      <div className="flex items-center gap-2">
                        {app.installed ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setRemoving({ kind: "app", app })}>
                              {t.uninstall}
                            </Button>
                            {app.openPath && (
                              <Button size="sm" asChild>
                                <Link to={app.openPath}>{t.open}</Link>
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button size="sm" disabled={soon || busy === app.key} onClick={() => install(app)}>
                            {busy === app.key ? t.installing : soon ? t.comingSoon : t.install}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "installed" && external.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-ink">{t.connectedTitle}</h2>
            <p className="mt-0.5 text-xs text-ink-soft">{t.connectedHint}</p>
            <ul className="mt-3 divide-y divide-line rounded-md border border-line bg-paper-raised">
              {external.map((app) => (
                <li key={app.id} className="flex flex-wrap items-center gap-3 p-3">
                  {app.icon ? (
                    <img src={app.icon} alt="" className="size-10 shrink-0 rounded-xl border border-line object-cover" />
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Plug className="size-5" aria-hidden />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{app.name}</p>
                    <p className="text-xs text-ink-soft">
                      {[app.description, fmt(t.scopes, { count: app.scopes.length }), fmt(t.hooks, { count: app.webhooks })].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setRemoving({ kind: "external", app })}>
                    {t.uninstall}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DataState>

      <ConfirmDialog
        open={removing !== null}
        title={fmt(t.uninstallTitle, { name: removing ? (removing.kind === "app" ? removing.app.name[locale] : removing.app.name) : "" })}
        description={removing?.kind === "external" ? t.uninstallBody : t.uninstallFeatureBody}
        confirmLabel={t.uninstall}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            const name = removing.kind === "app" ? removing.app.name[locale] : removing.app.name;
            if (removing.kind === "app") await appsUninstall(apiClient, workspaceId, removing.app.key);
            else await appsUninstallExternal(apiClient, workspaceId, removing.app.id);
            toast.success(fmt(t.uninstalledToast, { name }));
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          setRemoving(null);
          void list.refresh({ silent: true });
        }}
      />
    </div>
  );
}
