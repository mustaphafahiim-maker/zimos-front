import { useMemo, useState } from "react";
import { PackageOpen, Puzzle, Search } from "lucide-react";
import { Button, Card, Input, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { AppCategory, AppIntegration } from "@/mock/types";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { fmt, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";

type CategoryFilter = "all" | AppCategory;

const CATEGORY_ORDER: CategoryFilter[] = ["all", "marketing", "shipping", "payments", "messaging", "analytics", "ai"];

const CATEGORY_LABEL: Record<Locale, Record<CategoryFilter, string>> = {
  en: {
    all: "All",
    marketing: "Marketing",
    shipping: "Shipping",
    payments: "Payments",
    messaging: "Messaging",
    analytics: "Analytics",
    ai: "AI & import",
  },
  ar: {
    all: "الكل",
    marketing: "التسويق",
    shipping: "الشحن",
    payments: "المدفوعات",
    messaging: "المراسلة",
    analytics: "التحليلات",
    ai: "الذكاء الاصطناعي والاستيراد",
  },
};

/** Blue-family chips per category (brand palette only). */
const CATEGORY_COLOR: Record<AppCategory, string> = {
  marketing: "bg-primary-soft text-primary-dark",
  shipping: "bg-accent-soft text-accent-dark",
  payments: "bg-zimos-ice text-primary",
  messaging: "bg-primary text-white",
  analytics: "bg-info-soft text-info",
  ai: "bg-zimos-navy text-white",
};

type Status = AppIntegration["status"];

const STATUS_LABEL: Record<Locale, Record<Status, string>> = {
  en: { connected: "Connected", needs_setup: "Needs setup", not_installed: "Not installed" },
  ar: { connected: "متصل", needs_setup: "يحتاج إعداد", not_installed: "غير مثبت" },
};

/**
 * Localised catalogue copy keyed by app key. Brand names stay Latin; anything
 * not listed falls back to the name/description returned by the API.
 */
const APP_COPY: Record<Locale, Record<string, { name?: string; description: string }>> = {
  en: {
    whatsapp: { description: "Order confirmation and automated messages over WhatsApp." },
    fb_capi: { description: "More accurate server-side conversion tracking, unaffected by browser blocking." },
    tiktok: { description: "Send purchase events to optimise your TikTok campaigns." },
    google_sheets: { description: "Sync orders to a sheet in real time." },
    bosta: { description: "Create shipments with automatic tracking." },
    paymob: { description: "Cards, wallets, Fawry and instalments." },
    instapay: { description: "Instant transfers with no fees." },
    shopify_import: { name: "Shopify Import", description: "Move your products and customers from Shopify in one click." },
    aliexpress: { description: "Import dropshipping products with images and sizes." },
    zimos_ai: { description: "Describe your product idea and get a complete landing page." },
    klaviyo: { description: "Email campaigns and advanced flows." },
    zapier: { description: "Connect ZIMOS to 5,000+ apps." },
  },
  ar: {
    whatsapp: { description: "تأكيد الطلبات والرسائل التلقائية عبر WhatsApp." },
    fb_capi: { description: "تتبع أدق للتحويلات من الخادم بعيدًا عن حظر المتصفح." },
    tiktok: { description: "إرسال أحداث الشراء لتحسين حملات TikTok." },
    google_sheets: { description: "مزامنة الطلبات لحظيًا مع جدول بيانات." },
    bosta: { description: "إنشاء الشحنات مع تتبع تلقائي." },
    paymob: { description: "بطاقات ومحافظ إلكترونية وفوري وتقسيط." },
    instapay: { description: "تحويل فوري بدون رسوم." },
    shopify_import: { name: "استيراد من Shopify", description: "انقل منتجاتك وعملاءك من Shopify بضغطة واحدة." },
    aliexpress: { description: "استيراد منتجات الدروبشيبينج مع الصور والمقاسات." },
    zimos_ai: { description: "اكتب فكرة المنتج واحصل على صفحة هبوط كاملة." },
    klaviyo: { description: "حملات بريد إلكتروني وتدفقات تلقائية متقدمة." },
    zapier: { description: "اربط ZIMOS بأكثر من 5000 تطبيق." },
  },
};

const STRINGS = {
  en: {
    title: "Apps",
    description: "Connect messaging, ads, shipping and payment tools to your store.",
    installed: "Installed",
    noInstalled: "No apps installed",
    noInstalledDesc: "Browse the catalogue below to add your first integration.",
    discover: "Discover",
    searchPlaceholder: "Search apps…",
    searchLabel: "Search apps",
    categoryFilter: "App category",
    nothing: "Nothing to show",
    nothingDesc: "Try another category or search term.",
    open: "Open",
    configure: "Configure",
    uninstall: "Uninstall",
    install: "Install",
    installedToast: "{name} installed. Finish setup to connect it.",
    uninstalledToast: "{name} uninstalled.",
    openingToast: "Opening {name}…",
    uninstallTitle: "Uninstall {name}?",
    uninstallDesc: "Its automations and syncs stop immediately. You can install it again later.",
  },
  ar: {
    title: "التطبيقات",
    description: "اربط أدوات المراسلة والإعلانات والشحن والدفع بمتجرك.",
    installed: "المثبتة",
    noInstalled: "لا توجد تطبيقات مثبتة",
    noInstalledDesc: "تصفح الكتالوج بالأسفل لإضافة أول تكامل لك.",
    discover: "استكشف",
    searchPlaceholder: "ابحث عن تطبيق…",
    searchLabel: "البحث عن تطبيقات",
    categoryFilter: "فئة التطبيق",
    nothing: "لا توجد نتائج",
    nothingDesc: "جرّب فئة أو كلمة بحث أخرى.",
    open: "فتح",
    configure: "إعداد",
    uninstall: "إلغاء التثبيت",
    install: "تثبيت",
    installedToast: "تم تثبيت {name}. أكمل الإعداد لربطه.",
    uninstalledToast: "تم إلغاء تثبيت {name}.",
    openingToast: "جارٍ فتح {name}…",
    uninstallTitle: "إلغاء تثبيت {name}؟",
    uninstallDesc: "ستتوقف الأتمتة والمزامنة الخاصة به فورًا. يمكنك تثبيته مرة أخرى لاحقًا.",
  },
} satisfies Messages;

function LogoChip({ app }: { app: AppIntegration }) {
  return (
    <span
      dir="ltr"
      aria-hidden
      className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl font-display text-sm font-semibold", CATEGORY_COLOR[app.category])}
    >
      {app.logoText}
    </span>
  );
}

const STATUS_CLASS: Record<Status, string> = {
  connected: "bg-success-soft text-success border-success/25",
  needs_setup: "bg-warning-soft text-warning border-warning/30",
  not_installed: "bg-paper text-ink-soft border-line",
};

export function AppsPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const apps = useAsync(() => mockApi.listApps(workspaceId), [workspaceId]);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [uninstalling, setUninstalling] = useState<AppIntegration | null>(null);

  const copy = APP_COPY[locale];
  const nameOf = (app: AppIntegration) => copy[app.key]?.name ?? app.name;
  const descOf = (app: AppIntegration) => copy[app.key]?.description ?? app.description;
  const categoryLabel = CATEGORY_LABEL[locale];

  const list = apps.data ?? [];
  const installed = list.filter((a) => a.installed);
  const discover = useMemo(() => {
    const q = search.trim().toLowerCase();
    const localized = APP_COPY[locale];
    return list.filter((a) => {
      if (a.installed) return false;
      if (category !== "all" && a.category !== category) return false;
      if (q) {
        const haystack = `${a.name} ${a.description} ${localized[a.key]?.name ?? ""} ${localized[a.key]?.description ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [list, category, search, locale]);

  async function install(app: AppIntegration) {
    await mockApi.setAppInstalled(workspaceId, app.key, true);
    toast.success(fmt(t.installedToast, { name: nameOf(app) }));
    apps.refresh({ silent: true });
  }

  async function confirmUninstall() {
    if (!uninstalling) return;
    await mockApi.setAppInstalled(workspaceId, uninstalling.key, false);
    toast.success(fmt(t.uninstalledToast, { name: nameOf(uninstalling) }));
    setUninstalling(null);
    apps.refresh({ silent: true });
  }

  return (
    <div className="max-w-6xl space-y-10">
      <PageHeader title={t.title} description={t.description} />

      <DataState loading={apps.loading} error={apps.error} onRetry={() => apps.refresh()}>
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">
            {t.installed}{" "}
            <span className="text-sm font-normal text-ink-soft">
              (<bdi dir="ltr">{installed.length}</bdi>)
            </span>
          </h2>
          {installed.length === 0 ? (
            <EmptyState icon={<PackageOpen />} title={t.noInstalled} description={t.noInstalledDesc} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {installed.map((app) => (
                <Card key={app.key} className="rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <LogoChip app={app} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-ink">{nameOf(app)}</p>
                        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", STATUS_CLASS[app.status])}>
                          {STATUS_LABEL[locale][app.status]}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{descOf(app)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1 border-t border-line pt-3">
                    <Button size="sm" variant="outline" onClick={() => toast.success(fmt(t.openingToast, { name: nameOf(app) }))}>
                      {app.status === "connected" ? t.open : t.configure}
                    </Button>
                    <Button size="sm" variant="ghost" className="ms-auto text-danger hover:bg-danger-soft" onClick={() => setUninstalling(app)}>
                      {t.uninstall}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-ink">{t.discover}</h2>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
              <Input placeholder={t.searchPlaceholder} aria-label={t.searchLabel} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full ps-8" />
            </div>
          </div>
          <div role="group" aria-label={t.categoryFilter} className="mb-4 flex flex-wrap gap-2">
            {CATEGORY_ORDER.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  category === value ? "border-primary bg-primary-soft text-primary-dark" : "border-line text-ink-soft hover:bg-paper-raised"
                )}
              >
                {categoryLabel[value]}
              </button>
            ))}
          </div>

          {discover.length === 0 ? (
            <EmptyState icon={<Puzzle />} title={t.nothing} description={t.nothingDesc} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {discover.map((app) => (
                <Card key={app.key} className="rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <LogoChip app={app} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{nameOf(app)}</p>
                      <p className="text-[11px] uppercase tracking-wide text-ink-soft">{categoryLabel[app.category]}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{descOf(app)}</p>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-line pt-3">
                    <Button size="sm" onClick={() => install(app)}>
                      {t.install}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </DataState>

      <ConfirmDialog
        open={uninstalling !== null}
        title={fmt(t.uninstallTitle, { name: uninstalling ? nameOf(uninstalling) : "" })}
        description={t.uninstallDesc}
        confirmLabel={t.uninstall}
        destructive
        onCancel={() => setUninstalling(null)}
        onConfirm={confirmUninstall}
      />
    </div>
  );
}
