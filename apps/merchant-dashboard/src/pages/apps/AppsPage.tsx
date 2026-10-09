import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { IconApps, IconDelete, IconExternal, IconInfo, IconLock, IconPlug, IconPlus } from "@/components/icons";
import {
  appsInstall,
  appsList,
  appsUninstall,
  appsUninstallExternal,
  type AppDto,
  type AppsList,
  type ExternalAppDto,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { formatDate, formatMinorMoney } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { useViewNavigate } from "@/lib/viewTransition";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { DataState, StateMessage } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Sheet } from "@/components/Sheet";
import { ViewLink } from "@/components/ViewLink";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { ChipRow, ListToolbar, type ChipItem } from "@/components/list";
import { automationGuidePath } from "./automationApps";
import { APP_PILL, AppCard, AppGrid, AppGridSkeleton, AppTile } from "./AppCard";
import { PartnerAppIcon } from "@/pages/partnerApps/PartnerAppIcon";
import { PartnerAppOpenButton } from "@/pages/partnerApps/PartnerAppOpenButton";
import { SCOPE_STRINGS, scopeLabel } from "@/pages/partnerApps/scopeStrings";

const STRINGS = {
  en: {
    title: "Apps",
    search: "Search by an app's name or what it does",
    searchLabel: "Search apps",
    allCategories: "All",
    installed: "Installed",
    categoriesLabel: "Show all apps, the installed ones, or one category",
    yours: "Your apps",
    discover: "Discover",
    free: "Free",
    monthly: "{price} / month",
    once: "{price} once",
    comingSoon: "Coming soon",
    test: "Test",
    install: "Install",
    installing: "Installing…",
    open: "Open",
    openApp: "Open {name}",
    details: "Details",
    detailsOf: "Details of {name}",
    uninstall: "Uninstall",
    actionsOf: "Actions for {name}",
    installedBadge: "Installed",
    installedToast: "{name} is installed.",
    uninstalledToast: "{name} was uninstalled.",
    noInstalledTitle: "No apps installed yet",
    noInstalledBody: "Browse the apps and install the ones your store needs.",
    browse: "Browse apps",
    noMatch: "No app matches.",
    clear: "Clear search",
    showAll: "Show all apps",
    connectedTitle: "Connected by a link",
    connectedHint: "Outside services you approved. Uninstalling revokes their key and removes their webhooks.",
    connectedMeta: "Connected by a link",
    perm_one: "1 permission",
    perm_other: "{n} permissions",
    hook_one: "1 webhook",
    hook_other: "{n} webhooks",
    uninstallTitle: "Uninstall {name}?",
    uninstallBody: "Its API key stops working at once and its webhooks are removed.",
    uninstallFeatureBody: "It stops working in your store and dashboard until you install it again. What you set up is kept.",
    cancel: "Cancel",
    working: "Working…",
    noPermissionTitle: "Apps aren't part of your role",
    noPermission: "Installing and removing apps is for the store owner or someone with the apps permission. Ask the owner to give it to you from Settings → Team.",
    kind: "Type",
    kindFeature: "A feature inside your store",
    kindIntegration: "Connects an outside service",
    category: "Category",
    price: "Price",
    installedOn: "Installed on",
    renewsOn: "Renews on",
    soonNote: "Not available to install yet.",
    testNote: "A test app: for trying things out only.",
    whatItDoes: "What it does",
    canDo: "It can",
    noScopes: "It asked for no permissions.",
    webhooks: "Webhooks",
    removeHint: "Don't need it any more?",
  },
  ar: {
    title: "التطبيقات",
    search: "دوّر باسم التطبيق أو اللي بيعمله",
    searchLabel: "دوّر على تطبيق",
    allCategories: "الكل",
    installed: "المتثبّتة",
    categoriesLabel: "اعرض كل التطبيقات أو المتثبّتة أو تصنيف واحد",
    yours: "تطبيقاتك",
    discover: "اكتشف",
    free: "مجاني",
    monthly: "{price} / شهريًا",
    once: "{price} مرة واحدة",
    comingSoon: "قريب",
    test: "تجريبي",
    install: "ثبّت",
    installing: "بنثبّت…",
    open: "افتح",
    openApp: "افتح {name}",
    details: "التفاصيل",
    detailsOf: "تفاصيل {name}",
    uninstall: "شيل التطبيق",
    actionsOf: "إجراءات {name}",
    installedBadge: "متثبّت",
    installedToast: "{name} اتثبّت.",
    uninstalledToast: "{name} اتشال.",
    noInstalledTitle: "لسه مثبّتش تطبيقات",
    noInstalledBody: "شوف التطبيقات وثبّت اللي متجرك محتاجه.",
    browse: "شوف التطبيقات",
    noMatch: "مفيش تطبيق بالاسم ده.",
    clear: "امسح البحث",
    showAll: "اعرض كل التطبيقات",
    connectedTitle: "مربوطة برابط",
    connectedHint: "خدمات برّه وافقت عليها. لما تشيلها المفتاح بتاعها بيقف والـ webhooks بتتشال.",
    connectedMeta: "مربوط برابط",
    perm_one: "صلاحية واحدة",
    perm_two: "صلاحيتين",
    perm_few: "{n} صلاحيات",
    perm_other: "{n} صلاحية",
    hook_one: "webhook واحد",
    hook_other: "{n} webhook",
    uninstallTitle: "تشيل {name}؟",
    uninstallBody: "مفتاح الـ API بتاعه هيقف على طول والـ webhooks بتاعته هتتشال.",
    uninstallFeatureBody: "هيقف في متجرك ولوحة التحكم لحد ما تثبّته تاني. اللي ظبّطته محفوظ.",
    cancel: "إلغاء",
    working: "ثانية واحدة…",
    noPermissionTitle: "التطبيقات مش ضمن صلاحياتك",
    noPermission: "تثبيت التطبيقات وشيلها لصاحب المتجر أو اللي معاه صلاحية التطبيقات. اطلب من صاحب المتجر يدّيهالك من الإعدادات ← الفريق.",
    kind: "النوع",
    kindFeature: "ميزة جوه متجرك",
    kindIntegration: "ربط مع خدمة برّه",
    category: "التصنيف",
    price: "السعر",
    installedOn: "اتثبّت يوم",
    renewsOn: "بيتجدد يوم",
    soonNote: "لسه مش متاح للتثبيت.",
    testNote: "تطبيق تجريبي: للتجربة بس.",
    whatItDoes: "بيعمل إيه",
    canDo: "يقدر",
    noScopes: "مطلبش أي صلاحيات.",
    webhooks: "الـ webhooks",
    removeHint: "مش محتاجه تاني؟",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

/** The chip in effect: everything, the installed ones, or one category (`c:<key>`). */
type Chip = string;
const ALL: Chip = "all";
const INSTALLED: Chip = "installed";
const categoryChip = (key: string): Chip => `c:${key}`;

const EMPTY: AppsList = { categories: [], apps: [], external: [] };

type Removing = { kind: "app"; app: AppDto } | { kind: "external"; app: ExternalAppDto };
type Detail = { kind: "app"; key: string } | { kind: "external"; id: string };

/**
 * Search the way people type Arabic: hamzas, the ta marbuta, the alef maqsura
 * and the diacritics are not worth a miss (the same folding as the settings
 * list and Spotlight).
 */
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\p{Mn}ـ]/gu, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

/** Installed first, what can be installed next, coming-soon last — never the first thing in a block. */
function rank(app: AppDto): number {
  if (app.installed) return 0;
  return app.availability === "coming_soon" ? 2 : 1;
}

function byRank(apps: AppDto[]): AppDto[] {
  return apps
    .map((app, index) => ({ app, index }))
    .sort((a, b) => rank(a.app) - rank(b.app) || a.index - b.index)
    .map((entry) => entry.app);
}

/** Where «افتح» goes: the guide page for Zapier and Make, the app's own path otherwise. */
function pathOf(app: AppDto): string | null {
  return automationGuidePath(app.key) ?? app.openPath;
}

/**
 * Apps: a catalogue. Search, ONE scrolling row of chips (all, the installed
 * ones, then the categories — the chip lives in `?view=installed` or
 * `?category=<key>`, so it can be linked), then the apps: the installed ones
 * first under «تطبيقاتك», the rest under «اكتشف». A row on a phone, a card
 * from md. An installed app's card opens its page; any other opens its
 * details in a sheet, with the one action that fits its state.
 */
export function AppsPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const navigate = useViewNavigate();
  const [params, setParams] = useSearchParams();
  const list = useCachedAsync<AppsList>(`apps:${workspaceId}`, () => appsList(apiClient, workspaceId), [workspaceId]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Removing | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const apps = useMemo(() => list.data?.apps ?? [], [list.data]);
  const external = useMemo(() => list.data?.external ?? [], [list.data]);
  const categories = useMemo(() => list.data?.categories ?? [], [list.data]);

  // The chip from the address. An unknown category (or one still loading) reads as "all".
  const categoryParam = params.get("category");
  const chip: Chip =
    params.get("view") === "installed"
      ? INSTALLED
      : categoryParam && categories.some((c) => c.key === categoryParam)
        ? categoryChip(categoryParam)
        : ALL;

  function setChip(next: Chip) {
    const nextParams = new URLSearchParams(params);
    nextParams.delete("view");
    nextParams.delete("category");
    if (next === INSTALLED) nextParams.set("view", "installed");
    else if (next !== ALL) nextParams.set("category", next.slice(2));
    setParams(nextParams, { replace: true });
  }

  const categoryName = (key: string) => categories.find((c) => c.key === key)?.name[locale] ?? "";

  const priceLabel = (app: AppDto) => {
    if (!app.price) return t.free;
    const price = formatMinorMoney(app.price.amount, app.price.currency ?? "EGP");
    return fmt(app.price.billing === "monthly" ? t.monthly : t.once, { price });
  };

  const needle = fold(query);
  const searching = needle !== "";
  const matchesApp = (app: AppDto) =>
    !searching || [app.name.en, app.name.ar, app.description.en, app.description.ar].some((text) => fold(text).includes(needle));
  const matchesExternal = (app: ExternalAppDto) => !searching || [app.name, app.description ?? ""].some((text) => fold(text).includes(needle));

  const installedCount = apps.filter((app) => app.installed).length + external.length;

  const chips: ChipItem<Chip>[] = [
    { value: ALL, label: t.allCategories, count: apps.length + external.length },
    { value: INSTALLED, label: t.installed, count: installedCount, tone: "success" },
    ...categories.map((c) => ({
      value: categoryChip(c.key),
      label: c.name[locale],
      count: apps.filter((app) => app.category === c.key).length,
    })),
  ];

  // What the page shows: the apps of the chip that match the search, and the outside apps beside them.
  const inChip = apps.filter((app) => {
    if (chip === INSTALLED) return app.installed;
    if (chip !== ALL) return categoryChip(app.category) === chip;
    return true;
  });
  const shownApps = byRank(inChip.filter(matchesApp));
  const shownExternal = chip === ALL || chip === INSTALLED ? external.filter(matchesExternal) : [];
  // Installed first, as a block of its own, only on the plain page: no search, no chip.
  const split = chip === ALL && !searching && installedCount > 0;
  const nothing = shownApps.length === 0 && shownExternal.length === 0;

  function openDetail(next: Detail) {
    setDetail(next);
    setDetailOpen(true);
  }

  function patch(key: string, change: Partial<AppDto>) {
    list.setData((prev) => {
      const data = prev ?? EMPTY;
      return { ...data, apps: data.apps.map((app) => (app.key === key ? { ...app, ...change } : app)) };
    });
  }

  async function install(app: AppDto) {
    setBusy(app.key);
    // The chip turns to «متثبّت» at once; a refusal puts it back.
    patch(app.key, { installed: true });
    try {
      await appsInstall(apiClient, workspaceId, app.key);
      toast.success(fmt(t.installedToast, { name: app.name[locale] }));
    } catch (err) {
      patch(app.key, { installed: false });
      toast.error(isPermissionError(err) ? t.noPermission : errorMessage(err));
    } finally {
      setBusy(null);
    }
    await list.refresh({ silent: true });
  }

  async function uninstall(target: Removing) {
    const name = target.kind === "app" ? target.app.name[locale] : target.app.name;
    try {
      if (target.kind === "app") await appsUninstall(apiClient, workspaceId, target.app.key);
      else await appsUninstallExternal(apiClient, workspaceId, target.app.id);
    } catch (err) {
      // Thrown to the dialog: it says why and stays open.
      throw new Error(isPermissionError(err) ? t.noPermission : errorMessage(err));
    }
    setRemoving(null);
    setDetailOpen(false);
    if (target.kind === "app") patch(target.app.key, { installed: false, installedAt: null, renewsAt: null });
    else {
      const id = target.app.id;
      list.setData((prev) => {
        const data = prev ?? EMPTY;
        return { ...data, external: data.external.filter((app) => app.id !== id) };
      });
    }
    const message = fmt(t.uninstalledToast, { name });
    // Undo only where putting it back is one plain call: a free app of ours. A paid app would be
    // charged again, and an outside app needs its install link and its own approval.
    if (target.kind === "app" && !target.app.price) {
      const key = target.app.key;
      toast.undo(message, async () => {
        patch(key, { installed: true });
        try {
          await appsInstall(apiClient, workspaceId, key);
        } finally {
          await list.refresh({ silent: true });
        }
      });
    } else {
      toast.success(message);
    }
    void list.refresh({ silent: true });
  }

  function appMenu(app: AppDto): ContextMenuItem[] {
    const path = pathOf(app);
    const soon = app.availability === "coming_soon";
    const items: ContextMenuItem[] = [];
    if (app.installed && path) items.push({ id: "open", label: t.open, icon: IconExternal, onSelect: () => navigate(path) });
    items.push({ id: "details", label: t.details, icon: IconInfo, onSelect: () => openDetail({ kind: "app", key: app.key }) });
    if (!app.installed && !soon) {
      items.push({
        id: "install",
        label: t.install,
        icon: IconPlus,
        disabled: busy === app.key,
        // A paid app shows its price first: the sheet holds the button.
        onSelect: () => (app.price ? openDetail({ kind: "app", key: app.key }) : void install(app)),
      });
    }
    if (app.installed) {
      items.push({ id: "uninstall", label: t.uninstall, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setRemoving({ kind: "app", app }) });
    }
    return items;
  }

  function appAction(app: AppDto): ReactNode {
    const path = pathOf(app);
    if (app.installed) {
      if (!path) return null;
      return (
        <Button asChild variant="outline" className={APP_PILL}>
          <ViewLink to={path}>{t.open}</ViewLink>
        </Button>
      );
    }
    if (app.availability === "coming_soon") {
      return <span className="px-2 text-xs font-medium whitespace-nowrap text-ink-soft">{t.comingSoon}</span>;
    }
    return (
      <Button
        className={APP_PILL}
        disabled={busy === app.key}
        onClick={() => (app.price ? openDetail({ kind: "app", key: app.key }) : void install(app))}
      >
        {busy === app.key ? t.installing : t.install}
      </Button>
    );
  }

  const appCard = (app: AppDto) => {
    const soon = app.availability === "coming_soon";
    const name = app.name[locale];
    const path = app.installed ? pathOf(app) : null;
    return (
      <AppCard
        key={app.key}
        icon={<AppTile quiet={soon && !app.installed}>{app.kind === "integration" ? <IconPlug /> : <IconApps />}</AppTile>}
        name={name}
        description={app.description[locale]}
        meta={[categoryName(app.category), soon && !app.installed ? null : priceLabel(app)].filter(Boolean).join(" · ")}
        state={app.installed ? "installed" : soon ? "soon" : "available"}
        installedLabel={t.installedBadge}
        testLabel={app.isTest ? t.test : undefined}
        to={path}
        onOpen={() => openDetail({ kind: "app", key: app.key })}
        openLabel={fmt(path ? t.openApp : t.detailsOf, { name })}
        action={appAction(app)}
        menu={appMenu(app)}
        menuLabel={fmt(t.actionsOf, { name })}
        showMenuButton={app.installed}
      />
    );
  };

  const externalFacts = (app: ExternalAppDto) => `${pluralOf(t, "perm", app.scopes.length)} · ${pluralOf(t, "hook", app.webhooks)}`;

  const externalCard = (app: ExternalAppDto) => (
    <AppCard
      key={`x:${app.id}`}
      icon={<PartnerAppIcon url={app.icon} className="size-11" />}
      name={app.name}
      description={app.description ?? externalFacts(app)}
      meta={t.connectedMeta}
      state="installed"
      installedLabel={t.installedBadge}
      onOpen={() => openDetail({ kind: "external", id: app.id })}
      openLabel={fmt(t.detailsOf, { name: app.name })}
      // Drawn only for an install that has a page inside the dashboard (handoff 265).
      action={<PartnerAppOpenButton app={app} />}
      menu={[
        { id: "details", label: t.details, icon: IconInfo, onSelect: () => openDetail({ kind: "external", id: app.id }) },
        { id: "uninstall", label: t.uninstall, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setRemoving({ kind: "external", app }) },
      ]}
      menuLabel={fmt(t.actionsOf, { name: app.name })}
      showMenuButton
    />
  );

  const detailApp = detail?.kind === "app" ? (apps.find((app) => app.key === detail.key) ?? null) : null;
  const detailExternal = detail?.kind === "external" ? (external.find((app) => app.id === detail.id) ?? null) : null;

  /** The ONE action of the sheet, by the app's state: open it, install it, or nothing while it is coming soon. */
  function appSheetAction(app: AppDto): ReactNode {
    const path = pathOf(app);
    if (app.installed) {
      if (!path) return undefined;
      return (
        <Button asChild className="rounded-full px-5">
          <ViewLink to={path}>{t.open}</ViewLink>
        </Button>
      );
    }
    if (app.availability === "coming_soon") return undefined;
    return (
      <Button className="rounded-full px-5" disabled={busy === app.key} onClick={() => void install(app)}>
        {busy === app.key ? t.installing : t.install}
      </Button>
    );
  }

  const failed = !list.data ? list.error : null;

  return (
    <div>
      <PageHeader title={t.title} />

      <ListToolbar search={{ value: query, onChange: setQuery, placeholder: t.search, label: t.searchLabel }} />
      <ChipRow
        className="mt-3 mb-4"
        label={t.categoriesLabel}
        items={chips}
        value={chip}
        onChange={setChip}
        collapseEmpty={false}
        countsLoading={list.loading}
      />

      {failed && isPermissionError(failed) ? (
        <StateMessage role="alert" icon={<IconLock aria-hidden />} title={t.noPermissionTitle} description={t.noPermission} />
      ) : (
        <DataState loading={list.loading} error={failed} onRetry={() => void list.refresh()} skeleton={<AppGridSkeleton />}>
          {nothing && chip === INSTALLED && !searching ? (
            <EmptyState
              icon={<IconApps />}
              title={t.noInstalledTitle}
              description={t.noInstalledBody}
              action={
                <Button className="rounded-full px-5" onClick={() => setChip(ALL)}>
                  {t.browse}
                </Button>
              }
            />
          ) : nothing ? (
            // One calm line and the way out of it.
            <div className="zimos-row-card flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-[1.25rem] bg-paper-raised px-4 py-4 text-sm text-ink-soft shadow-[var(--shadow-card)] ring-1 ring-line">
              <span>{t.noMatch}</span>
              {(searching || chip !== ALL) && <button
                type="button"
                onClick={() => {
                  setQuery("");
                  if (chip !== ALL) setChip(ALL);
                }}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 font-semibold text-primary-dark hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary dark:text-primary"
              >
                {searching ? t.clear : t.showAll}
              </button>}
            </div>
          ) : split ? (
            <>
              <BlockTitle count={installedCount}>{t.yours}</BlockTitle>
              <AppGrid>
                {shownApps.filter((app) => app.installed).map(appCard)}
                {shownExternal.map(externalCard)}
              </AppGrid>
              {shownApps.some((app) => !app.installed) && (
                <>
                  <BlockTitle className="mt-6">{t.discover}</BlockTitle>
                  <AppGrid>{shownApps.filter((app) => !app.installed).map(appCard)}</AppGrid>
                </>
              )}
            </>
          ) : (
            <>
              {shownApps.length > 0 && <AppGrid>{shownApps.map(appCard)}</AppGrid>}
              {shownExternal.length > 0 && (
                <>
                  <BlockTitle className={shownApps.length > 0 ? "mt-6" : undefined} hint={t.connectedHint}>
                    {t.connectedTitle}
                  </BlockTitle>
                  <AppGrid>{shownExternal.map(externalCard)}</AppGrid>
                </>
              )}
            </>
          )}
        </DataState>
      )}

      <Sheet
        open={detailOpen && detailApp !== null}
        onOpenChange={setDetailOpen}
        title={detailApp?.name[locale] ?? ""}
        description={detailApp ? categoryName(detailApp.category) || undefined : undefined}
        size="sm"
        footer={detailApp ? appSheetAction(detailApp) : undefined}
      >
        {detailApp && (
          <AppDetails
            t={t}
            app={detailApp}
            description={detailApp.description[locale]}
            price={priceLabel(detailApp)}
            onUninstall={() => setRemoving({ kind: "app", app: detailApp })}
          />
        )}
      </Sheet>

      <Sheet
        open={detailOpen && detailExternal !== null}
        onOpenChange={setDetailOpen}
        title={detailExternal?.name ?? ""}
        description={t.connectedMeta}
        size="sm"
      >
        {detailExternal && <ExternalDetails t={t} app={detailExternal} onUninstall={() => setRemoving({ kind: "external", app: detailExternal })} />}
      </Sheet>

      <ConfirmDialog
        open={removing !== null}
        destructive
        title={fmt(t.uninstallTitle, { name: removing ? (removing.kind === "app" ? removing.app.name[locale] : removing.app.name) : "" })}
        description={removing?.kind === "external" ? t.uninstallBody : t.uninstallFeatureBody}
        confirmLabel={t.uninstall}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await uninstall(removing);
        }}
      />
    </div>
  );
}

/** The name of a block of the page: «تطبيقاتك», «اكتشف». */
function BlockTitle({ children, count, hint, className }: { children: ReactNode; count?: number; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <h2 className="mb-2 flex items-baseline gap-2 px-1 text-sm font-semibold text-ink">
        {children}
        {count !== undefined && <span className="text-xs font-medium text-ink-soft tabular-nums">{fmt("{n}", { n: count })}</span>}
      </h2>
      {hint && <p className="-mt-1 mb-2 px-1 text-xs leading-5 text-ink-soft">{hint}</p>}
    </div>
  );
}

/** A fact of the details sheet: its name at the start, its value at the end. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-line py-2 last:border-b-0">
      <dt className="shrink-0 text-sm text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-end text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

/** Uninstall lives here, under the facts: quiet, and it asks before it does anything. */
function RemoveRow({ t, onUninstall }: { t: T; onUninstall: () => void }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
      <p className="text-sm text-ink-soft">{t.removeHint}</p>
      <Button variant="ghost" className="min-h-11 rounded-full px-4 text-danger hover:text-danger" onClick={onUninstall}>
        <IconDelete className="size-4" aria-hidden />
        {t.uninstall}
      </Button>
    </div>
  );
}

/** One of our apps in the sheet: what it does, then exactly what its record says. */
function AppDetails({ t, app, description, price, onUninstall }: { t: T; app: AppDto; description: string; price: string; onUninstall: () => void }) {
  const soon = app.availability === "coming_soon";
  return (
    <div>
      <div className="flex items-center gap-3">
        <AppTile quiet={soon && !app.installed} className="size-14 rounded-[1.125rem] [&_svg]:size-7">
          {app.kind === "integration" ? <IconPlug /> : <IconApps />}
        </AppTile>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {app.installed && <StatusBadge value="installed" tone="success" text={t.installedBadge} />}
          {soon && !app.installed && <StatusBadge value="soon" tone="neutral" text={t.comingSoon} />}
          {app.isTest && <StatusBadge value="test" tone="warning" text={t.test} />}
        </div>
      </div>

      <h3 className="mt-4 text-xs font-semibold text-ink-soft">{t.whatItDoes}</h3>
      <p className="mt-1 text-sm leading-6 text-ink">{description}</p>
      {soon && !app.installed && <p className="mt-2 text-sm leading-6 text-ink-soft">{t.soonNote}</p>}
      {app.isTest && <p className="mt-2 text-sm leading-6 text-ink-soft">{t.testNote}</p>}

      <dl className="mt-4">
        <Fact label={t.kind}>{app.kind === "integration" ? t.kindIntegration : t.kindFeature}</Fact>
        {!soon && <Fact label={t.price}>{price}</Fact>}
        {app.installed && app.installedAt && <Fact label={t.installedOn}>{formatDate(app.installedAt)}</Fact>}
        {app.installed && app.renewsAt && <Fact label={t.renewsOn}>{formatDate(app.renewsAt)}</Fact>}
      </dl>

      {app.installed && <RemoveRow t={t} onUninstall={onUninstall} />}
    </div>
  );
}

/** An outside app in the sheet: what it was allowed to do, in words. */
function ExternalDetails({ t, app, onUninstall }: { t: T; app: ExternalAppDto; onUninstall: () => void }) {
  const scopes = useT(SCOPE_STRINGS);
  return (
    <div>
      <div className="flex items-center gap-3">
        <PartnerAppIcon url={app.icon} className="size-14" />
        <StatusBadge value="installed" tone="success" text={t.installedBadge} />
        {/* Drawn only for an install that has a page inside the dashboard. */}
        <div className="ms-auto">
          <PartnerAppOpenButton app={app} />
        </div>
      </div>
      {app.description && <p className="mt-4 text-sm leading-6 text-ink">{app.description}</p>}

      <h3 className="mt-4 text-xs font-semibold text-ink-soft">{t.canDo}</h3>
      {app.scopes.length === 0 ? (
        <p className="mt-1 text-sm leading-6 text-ink-soft">{t.noScopes}</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm leading-6 text-ink">
          {app.scopes.map((scope) => (
            <li key={scope} className="flex gap-2">
              <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="min-w-0">{scopeLabel(scopes, scope)}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-4">
        <Fact label={t.webhooks}>{pluralOf(t, "hook", app.webhooks)}</Fact>
        <Fact label={t.installedOn}>{formatDate(app.installedAt)}</Fact>
      </dl>
      <p className="mt-3 text-xs leading-5 text-ink-soft">{t.connectedHint}</p>

      <RemoveRow t={t} onUninstall={onUninstall} />
    </div>
  );
}
