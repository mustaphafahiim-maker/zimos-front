import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LayoutTemplate, Monitor, Pencil, Search, Smartphone, Trash2 } from "lucide-react";
import { Alert, Button, Input, Spinner } from "@store-builder/ui";
import type { CreateWebsitePayload, Website, WebsiteTemplateSummary } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useSaveThemeSettings } from "@/lib/themeSettingsSave";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { humanize } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField } from "@/components/Field";
import { TemplateLivePreview } from "@/components/TemplateLivePreview";
import type { PreviewTheme } from "@/lib/previewBridge";
import { useToast } from "@/components/Toast";
import { ALL_CATEGORIES, filterTemplates, templateCategories } from "./templateGallery";
import { ThemeGallery } from "./ThemeGallery";
import { TEMPLATE_COLOR_SOURCE } from "./editor/storeLook";
import { ORIGINAL_LOOK, readThemeChoice } from "./editor/storeThemes";

const STRINGS = {
  en: {
    preview: "Preview →",
    previewOf: "Preview {name}",
    livePreview: "Live preview of {name}",
    catalogueNote:
      "Previews are your store as it would look with this template — with your own products. Sections that list products show a “coming soon” note until you add some.",
    search: "Search templates",
    filterLabel: "Filter templates by category",
    all: "All",
    noMatchTitle: "No templates match",
    noMatchDescription: "Try another name, or show every category.",
    clearFilters: "Show all templates",
    device: "Preview size",
    desktop: "Desktop",
    mobile: "Mobile",
    noPreview: "No preview yet",
    templatesTitle: "Page templates",
    title: "Website",
    description: "Pick a template to start your store's website. You can rename it now and customise it later.",
    noTemplates: "No website templates are available right now. Check back soon.",
    yourSites: "Your sites",
    edit: "Edit",
    deleteSite: "Delete {name}",
    siteDeleted: "Site \"{name}\" deleted.",
    deleteTitle: "Delete this site?",
    deleteConfirm: "Delete site",
    deleteBody:
      "{name} and all of its pages, published revisions and any domain bound to it will be deleted permanently. This cannot be undone.",
    deleteLive:
      "This site is live right now. Deleting it takes it offline immediately — anyone visiting {subdomain} will stop seeing your store.",
    cancel: "Cancel",
    working: "Working…",
    // A site's status and a template's category arrive as codes: see codeLabel.
    "status.draft": "Draft",
    "status.published": "Published",
    "status.suspended": "Suspended",
    "category.general": "General",
    "category.ecommerce": "Ecommerce",
    "category.fashion": "Fashion",
    "category.modest_fashion": "Modest fashion",
    "category.electronics": "Electronics",
    "category.phone_accessories": "Phone accessories",
    "category.food_beverage": "Food beverage",
    "category.coffee": "Coffee",
    "category.perfume": "Perfume",
    "category.skincare": "Skincare",
    "category.supplements": "Supplements",
    "category.watches": "Watches",
    "category.jewellery": "Jewellery",
    "category.home_decor": "Home decor",
    "category.kids_toys": "Kids toys",
    "category.single_product": "Single product",
  },
  ar: {
    preview: "معاينة ←",
    previewOf: "معاينة {name}",
    livePreview: "معاينة حيّة لـ {name}",
    catalogueNote:
      "تعرض المعاينة متجرك بهذا القالب مع منتجاتك أنت. تظهر أقسام المنتجات بملاحظة «قريبًا» إلى أن تضيف منتجات.",
    search: "ابحث عن قالب",
    filterLabel: "تصفية القوالب حسب الفئة",
    all: "الكل",
    noMatchTitle: "لا توجد قوالب مطابقة",
    noMatchDescription: "جرّب اسمًا آخر، أو اعرض كل الفئات.",
    clearFilters: "عرض كل القوالب",
    device: "حجم المعاينة",
    desktop: "الكمبيوتر",
    mobile: "الهاتف",
    noPreview: "لا توجد معاينة بعد",
    templatesTitle: "قوالب الصفحات",
    title: "الموقع",
    description: "اختر قالبًا تبدأ به موقع متجرك. يمكنك تسميته الآن وتخصيصه لاحقًا.",
    noTemplates: "لا توجد قوالب مواقع متاحة الآن. عُد لاحقًا.",
    yourSites: "مواقعك",
    edit: "تعديل",
    deleteSite: "حذف {name}",
    siteDeleted: "تم حذف الموقع \"{name}\".",
    deleteTitle: "حذف هذا الموقع؟",
    deleteConfirm: "حذف الموقع",
    deleteBody:
      "سيُحذف {name} نهائيًا مع كل صفحاته ونسخه المنشورة وأي دومين مربوط به. لا يمكن التراجع عن ذلك.",
    deleteLive: "هذا الموقع منشور الآن. حذفه يوقفه فورًا — ولن يرى متجرك أي شخص يزور {subdomain}.",
    cancel: "إلغاء",
    working: "جارٍ الحذف…",
    "status.draft": "مسودة",
    "status.published": "منشور",
    "status.suspended": "موقوف",
    "category.general": "عام",
    "category.ecommerce": "متجر إلكتروني",
    "category.fashion": "أزياء",
    "category.modest_fashion": "أزياء محتشمة",
    "category.electronics": "إلكترونيات",
    "category.phone_accessories": "إكسسوارات موبايل",
    "category.food_beverage": "أكل ومشروبات",
    "category.coffee": "قهوة",
    "category.perfume": "عطور",
    "category.skincare": "العناية بالبشرة",
    "category.supplements": "مكمّلات غذائية",
    "category.watches": "ساعات",
    "category.jewellery": "مجوهرات",
    "category.home_decor": "ديكور المنزل",
    "category.kids_toys": "ألعاب أطفال",
    "category.single_product": "منتج واحد",
  },
} satisfies Messages;

/**
 * The name of a code the API sends — a template's category, a site's status —
 * in the dashboard's language. A code the table lacks keeps its humanised
 * English, as before.
 */
function codeLabel(t: Record<string, string>, group: "category" | "status", code: string): string {
  return t[`${group}.${code}`] ?? humanize(code);
}

/** The "use this template" modal: its description and the site-name form. */
const USE_STRINGS = {
  en: {
    description: "Preview what this template includes, then name your site.",
    loadingDetails: "Loading template details…",
    detailError: "The template preview could not be loaded. You can still create the site.",
    retry: "Try again",
    pagesOne: "This template includes one page, which will be copied to your site:",
    pagesTwo: "This template includes 2 pages, which will be copied to your site:",
    pagesFew: "This template includes {count} pages, which will be copied to your site:",
    pagesMany: "This template includes {count} pages, which will be copied to your site:",
    pagesNone: "This template includes no pages yet.",
    siteName: "Site name",
    siteNameHint: "A temporary address (subdomain) is made from it. You can change it later.",
    siteNamePlaceholder: "My store",
    cancel: "Cancel",
    creating: "Creating…",
    useTemplate: "Use this template",
    created: "Site \"{name}\" created.",
  },
  ar: {
    description: "عاين محتوى القالب، ثم اختر اسمًا لموقعك.",
    loadingDetails: "جارٍ تحميل تفاصيل القالب…",
    detailError: "تعذّر تحميل معاينة القالب، ويمكنك مع ذلك متابعة إنشاء الموقع.",
    retry: "إعادة المحاولة",
    pagesOne: "يتضمن هذا القالب صفحة واحدة ستُنسخ إلى موقعك:",
    pagesTwo: "يتضمن هذا القالب صفحتين ستُنسخان إلى موقعك:",
    pagesFew: "يتضمن هذا القالب {count} صفحات ستُنسخ إلى موقعك:",
    pagesMany: "يتضمن هذا القالب {count} صفحة ستُنسخ إلى موقعك:",
    pagesNone: "لا يتضمن هذا القالب صفحات بعد.",
    siteName: "اسم الموقع",
    siteNameHint: "يُنشأ منه عنوان مؤقت (نطاق فرعي) يمكنك تغييره لاحقًا.",
    siteNamePlaceholder: "متجري",
    cancel: "إلغاء",
    creating: "جارٍ الإنشاء…",
    useTemplate: "استخدم هذا القالب",
    created: "تم إنشاء الموقع \"{name}\".",
  },
} satisfies Messages;

/** "This template includes N pages" with Arabic's one / two / few / many forms. */
function pagesLine(t: Record<keyof (typeof USE_STRINGS)["en"], string>, count: number): string {
  if (count === 0) return t.pagesNone;
  if (count === 1) return t.pagesOne;
  if (count === 2) return t.pagesTwo;
  const few = count % 100 >= 3 && count % 100 <= 10;
  return fmt(few ? t.pagesFew : t.pagesMany, { count });
}

/**
 * Has the store a look of its own — a theme, or an accent the merchant chose?
 * Then a template's colour never replaces it (see applyTemplateColour).
 */
function storeHasOwnLook(themeSettings: Record<string, unknown> | undefined): boolean {
  const set = (key: string) => {
    const existing = themeSettings?.[key];
    return typeof existing === "string" && existing.trim() !== "";
  };
  return set("primaryColor") || set("primaryColorDark") || readThemeChoice(themeSettings?.storeTheme) !== ORIGINAL_LOOK;
}

/**
 * The look a template's preview renders in: what applying it would give this
 * store — the template's accent on a store with no look of its own, the
 * store's own look otherwise (null: as saved).
 */
function useTemplatePreviewTheme(template: Pick<WebsiteTemplateSummary, "primaryColor">): PreviewTheme | null {
  const { currentWorkspace } = useWorkspace();
  const colour = typeof template.primaryColor === "string" ? template.primaryColor.trim() : "";
  if (!/^#[0-9a-f]{6}$/i.test(colour) || storeHasOwnLook(currentWorkspace?.themeSettings)) return null;
  return { primaryColor: colour };
}

/**
 * Stands in for a template with no thumbnail and no live render (yet, or at
 * all): a sketch of a storefront page — header, hero, product grid — so the
 * gallery keeps its rhythm instead of showing a bare icon. Decorative; the
 * card's text already names the template. Fills the box it is given.
 */
function TemplatePlaceholder() {
  const t = useT(STRINGS);
  return (
    <div className="relative flex h-full w-full flex-col gap-2 overflow-hidden bg-primary-soft p-3 pb-8 text-primary-dark dark:text-primary">
      <div aria-hidden className="flex items-center gap-1.5 rounded-sm bg-paper-raised/80 px-2 py-1.5">
        <span className="size-2 rounded-full bg-current opacity-60" />
        <span className="h-1.5 w-10 rounded-full bg-current opacity-40" />
        <span className="ms-auto h-1.5 w-6 rounded-full bg-current opacity-25" />
      </div>
      <div aria-hidden className="flex flex-1 items-center gap-2 rounded-sm bg-paper-raised/60 p-2">
        <div className="flex-1 space-y-1.5">
          <span className="block h-2 w-3/4 rounded-full bg-current opacity-40" />
          <span className="block h-1.5 w-1/2 rounded-full bg-current opacity-25" />
          <span className="mt-2 block h-3 w-10 rounded-sm bg-current opacity-50" />
        </div>
        <LayoutTemplate className="size-8 shrink-0 opacity-50" />
      </div>
      <div aria-hidden className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-6 rounded-sm bg-paper-raised/60" />
        ))}
      </div>
      <span className="absolute inset-x-0 bottom-0 bg-paper-raised/90 py-1 text-center text-xs font-medium text-ink-soft">
        {t.noPreview}
      </span>
    </div>
  );
}

/**
 * Square-ish preview for a template card — the thumbnail if one is set and it
 * actually loads, otherwise a live render of the template's home page, with
 * the placeholder while that loads or if it can't.
 */
function TemplateThumb({
  url,
  name,
  templateId,
  primaryColor,
}: {
  url: string | null;
  name: string;
  templateId: string;
  primaryColor?: string | null;
}) {
  const workspaceId = useWorkspaceId();
  const theme = useTemplatePreviewTheme({ primaryColor });
  const [image, setImage] = useState<"checking" | "ok" | "broken">(url ? "checking" : "broken");

  // Probe first so a dead link never flashes a broken image. A card keeps its
  // template (keyed by id), so the url never changes under it.
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => !cancelled && setImage("ok");
    probe.onerror = () => !cancelled && setImage("broken");
    probe.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (url && image === "ok") {
    return <img src={url} alt={name} className="aspect-[4/3] w-full object-cover" />;
  }
  if (image === "checking") {
    return (
      <div className="aspect-[4/3] w-full">
        <TemplatePlaceholder />
      </div>
    );
  }
  return (
    <TemplateLivePreview
      workspaceId={workspaceId}
      templateId={templateId}
      theme={theme}
      title={name}
      fallback={<TemplatePlaceholder />}
    />
  );
}

function TemplateCard({
  template,
  onSelect,
}: {
  template: WebsiteTemplateSummary;
  onSelect: () => void;
}) {
  const t = useT(STRINGS);
  // A div rather than one big button: a button can't hold the preview frame.
  // The button's ::after covers the card, so all of it stays clickable.
  return (
    <div className="relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised text-start transition-colors hover:border-primary">
      <TemplateThumb
        url={template.thumbnailUrl}
        name={template.name}
        templateId={template.id}
        primaryColor={template.primaryColor}
      />
      <div className="flex flex-1 flex-col gap-1 border-t border-line p-4">
        <span className="font-medium text-ink">{template.name}</span>
        {template.category && (
          <span className="text-xs text-ink-soft">{codeLabel(t, "category", template.category)}</span>
        )}
        <button
          type="button"
          onClick={onSelect}
          aria-label={fmt(t.previewOf, { name: template.name })}
          className="mt-auto cursor-pointer pt-2 text-start text-sm font-medium text-primary after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-primary"
        >
          {t.preview}
        </button>
      </div>
    </div>
  );
}

/** The modal's large live render, with the desktop / phone switch. */
function TemplatePreviewPanel({ template }: { template: WebsiteTemplateSummary }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const theme = useTemplatePreviewTheme(template);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div role="group" aria-label={t.device} className="flex items-center justify-end gap-1">
        <Button
          type="button"
          size="icon"
          variant={device === "desktop" ? "secondary" : "ghost"}
          aria-label={t.desktop}
          aria-pressed={device === "desktop"}
          onClick={() => setDevice("desktop")}
        >
          <Monitor className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={device === "mobile" ? "secondary" : "ghost"}
          aria-label={t.mobile}
          aria-pressed={device === "mobile"}
          onClick={() => setDevice("mobile")}
        >
          <Smartphone className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="h-[min(70vh,44rem)] overflow-hidden rounded-[0.5rem] border border-line">
        <TemplateLivePreview
          variant="full"
          device={device}
          workspaceId={workspaceId}
          templateId={template.id}
          theme={theme}
          title={fmt(t.livePreview, { name: template.name })}
          fallback={<TemplatePlaceholder />}
        />
      </div>
    </div>
  );
}

/**
 * Modal body: previews the picked template (pages it ships with) and takes a
 * site name, then calls createWebsite and drops the merchant straight into the
 * editor for the new site. The template detail fetch is purely informational —
 * a failure shows an inline notice but never blocks creation, because the
 * summary already carries the `templateVersionId` the API needs.
 */
function UseTemplateForm({
  template,
  onCancel,
}: {
  template: WebsiteTemplateSummary;
  onCancel: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const saveThemeSettings = useSaveThemeSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const t = useT(USE_STRINGS);

  const detail = useAsync(() => apiClient.getWebsiteTemplate(template.id), [template.id]);

  /**
   * A template's colour lives in its `globalStyles`, which createWebsite copies
   * onto the website row — but the storefront paints from the workspace's
   * `themeSettings`, so a "perfume" template would open in the platform blue.
   * Carry the colour across here, only when the store has chosen neither a
   * theme nor an accent of its own, so a merchant's look is never overwritten
   * by picking a template. It is marked as the template's
   * (`primaryColorSource`), so a theme picked later still shows its own accent.
   * Best effort: the site exists either way, so a failure here is not surfaced.
   */
  async function applyTemplateColour() {
    const styles = detail.data?.globalStyles;
    const colour = styles && typeof styles.primaryColor === "string" ? styles.primaryColor.trim() : "";
    if (!/^#[0-9a-f]{6}$/i.test(colour) || storeHasOwnLook(currentWorkspace?.themeSettings)) return;
    try {
      // Asked again of the server's copy: another tab may have picked a look since.
      await saveThemeSettings((current) =>
        storeHasOwnLook(current)
          ? null
          : {
              themeSettings: {
                ...current,
                // A template may bring its whole look — theme, header, footer (globalStyles.themeSettings).
                ...(styles?.themeSettings && typeof styles.themeSettings === "object" ? (styles.themeSettings as Record<string, unknown>) : {}),
                primaryColor: colour,
                primaryColorSource: TEMPLATE_COLOR_SOURCE,
              },
            }
      );
    } catch {
      /* the site was created; the merchant can still pick a colour in the editor */
    }
  }

  const [name, setName] = useState(currentWorkspace?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    const payload: CreateWebsitePayload = {
      name: name.trim(),
      templateVersionId: template.templateVersionId,
    };
    try {
      const result = await apiClient.createWebsite(workspaceId, payload);
      await applyTemplateColour();
      toast.success(fmt(t.created, { name: result.website.name }));
      navigate(`/website/${result.website.id}/edit`);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const pages = detail.data?.pages ?? [];

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <div className="rounded-[0.5rem] border border-line bg-paper px-4 py-3 text-sm">
        {detail.loading ? (
          <span className="flex items-center gap-2 text-ink-soft">
            <Spinner className="size-4" /> {t.loadingDetails}
          </span>
        ) : detail.error ? (
          <span className="flex flex-wrap items-center gap-2 text-ink-soft">
            {t.detailError}
            <button
              type="button"
              onClick={() => detail.refresh()}
              className="cursor-pointer font-medium text-primary hover:underline"
            >
              {t.retry}
            </button>
          </span>
        ) : (
          <>
            <p className="text-ink-soft">{pagesLine(t, pages.length)}</p>
            {pages.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {pages.map((p) => (
                  <li
                    key={p.path}
                    className="rounded-full border border-line bg-paper-raised px-2 py-0.5 text-xs text-ink-soft"
                  >
                    {p.title || p.path}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <TextField
        label={t.siteName}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        hint={t.siteNameHint}
        placeholder={t.siteNamePlaceholder}
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={saving || name.trim().length === 0}>
          {saving ? t.creating : t.useTemplate}
        </Button>
      </div>
    </form>
  );
}

/**
 * Sites the workspace already has. Without this the editor is only reachable
 * in the moments right after creating a site — a reload would strand it.
 */
function ExistingSites() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const sites = useAsync(() => apiClient.listWebsites(workspaceId), [workspaceId]);
  const [pendingDelete, setPendingDelete] = useState<Website | null>(null);
  const list = sites.data ?? [];

  // A workspace with no site yet is the normal first-run case, and the template
  // gallery below already tells that story — stay quiet rather than showing an
  // empty state. Same for an error: it must not block picking a template.
  if (sites.loading || sites.error || list.length === 0) return null;

  // Throwing keeps ConfirmDialog open with the error inline; resolving lets it
  // close. Refetching (rather than filtering locally) also catches sites deleted
  // from another tab.
  async function confirmDelete() {
    const site = pendingDelete;
    if (!site) return;
    await apiClient.deleteWebsite(workspaceId, site.id);
    setPendingDelete(null);
    toast.success(fmt(t.siteDeleted, { name: site.name }));
    await sites.refresh({ silent: true });
  }

  // The site's name and address sit inside these sentences, each in its own span.
  const deleteBody = t.deleteBody.split("{name}");
  const deleteLive = t.deleteLive.split("{subdomain}");

  return (
    <div className="mb-8">
      <h2 className="mb-2 font-display text-base font-medium text-ink">{t.yourSites}</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised">
        {list.map((site) => (
          <li key={site.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{site.name}</p>
              <p className="truncate text-xs text-ink-soft">
                {site.subdomain} · {codeLabel(t, "status", site.status)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={`/website/${site.id}/edit`}>
                  <Pencil className="size-4" aria-hidden />
                  {t.edit}
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={fmt(t.deleteSite, { name: site.name })}
                className="text-danger hover:bg-danger-soft hover:text-danger"
                onClick={() => setPendingDelete(site)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t.deleteTitle}
        confirmLabel={t.deleteConfirm}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      >
        <div className="space-y-3 text-sm text-ink-soft">
          <p>
            {deleteBody[0]}
            <span className="font-medium text-ink">{pendingDelete?.name}</span>
            {deleteBody[1]}
          </p>
          {pendingDelete?.status === "published" && (
            <Alert variant="danger">
              {deleteLive[0]}
              <span className="font-medium">{pendingDelete.subdomain}</span>
              {deleteLive[1]}
            </Alert>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}

export function WebsitePage() {
  const t = useT(STRINGS);
  const tUse = useT(USE_STRINGS);
  const templates = useAsync(() => apiClient.listWebsiteTemplates(), []);

  const [selected, setSelected] = useState<WebsiteTemplateSummary | null>(null);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [query, setQuery] = useState("");

  const list = useMemo(() => templates.data ?? [], [templates.data]);
  const categories = useMemo(() => templateCategories(list), [list]);
  const shown = useMemo(() => filterTemplates(list, { category, query }), [list, category, query]);
  const tabs = useMemo(
    () => [
      { value: ALL_CATEGORIES, label: t.all },
      ...categories.map((c) => ({ value: c, label: codeLabel(t, "category", c) })),
    ],
    [categories, t]
  );

  return (
    <div className="max-w-4xl">
      <PageHeader title={t.title} description={t.description} tutorial="website" />

      <ExistingSites />

      <ThemeGallery />

      <h2 className="mb-2 font-display text-base font-medium text-ink">{t.templatesTitle}</h2>
      <DataState
        loading={templates.loading}
        error={templates.error}
        empty={list.length === 0}
        emptyMessage={t.noTemplates}
        onRetry={() => templates.refresh()}
      >
        <div className="mb-4 space-y-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.search}
              aria-label={t.search}
              className="ps-9"
            />
          </div>
          {categories.length > 1 && (
            <FilterTabs tabs={tabs} value={category} onChange={setCategory} label={t.filterLabel} />
          )}
          <p className="text-xs text-ink-soft">{t.catalogueNote}</p>
        </div>

        {shown.length === 0 ? (
          <EmptyState
            icon={<LayoutTemplate className="size-6" aria-hidden />}
            title={t.noMatchTitle}
            description={t.noMatchDescription}
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setCategory(ALL_CATEGORIES);
                }}
              >
                {t.clearFilters}
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={() => setSelected(template)}
              />
            ))}
          </div>
        )}
      </DataState>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? selected.name : ""}
        description={tUse.description}
        className="max-w-6xl"
      >
        {selected && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <TemplatePreviewPanel template={selected} />
            <UseTemplateForm template={selected} onCancel={() => setSelected(null)} />
          </div>
        )}
      </Modal>
    </div>
  );
}
