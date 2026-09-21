import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LayoutTemplate, Monitor, Pencil, Search, Smartphone, Trash2 } from "lucide-react";
import { Alert, Button, Input, Spinner } from "@store-builder/ui";
import type { CreateWebsitePayload, Website, WebsiteTemplateSummary } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
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
import { useToast } from "@/components/Toast";
import { ALL_CATEGORIES, filterTemplates, templateCategories } from "./templateGallery";

const STRINGS = {
  en: {
    preview: "Preview →",
    previewOf: "Preview {name}",
    livePreview: "Live preview of {name}",
    catalogueNote:
      "Previews are your store as it would look with this template — with your own products. Sections that list products stay hidden until you add some.",
    search: "Search templates",
    filterLabel: "Filter templates by category",
    all: "All",
    noMatchTitle: "No templates match",
    noMatchDescription: "Try another name, or show every category.",
    clearFilters: "Show all templates",
    device: "Preview size",
    desktop: "Desktop",
    mobile: "Mobile",
  },
  ar: {
    preview: "معاينة ←",
    previewOf: "معاينة {name}",
    livePreview: "معاينة حيّة لـ {name}",
    catalogueNote:
      "المعاينة بتوريك متجرك بالقالب ده بمنتجاتك انت. الأقسام اللي بتعرض منتجات مش هتظهر غير لما تضيف منتجات.",
    search: "دوّر على قالب",
    filterLabel: "فلترة القوالب حسب النوع",
    all: "الكل",
    noMatchTitle: "مفيش قوالب مطابقة",
    noMatchDescription: "جرّب اسم تاني، أو اعرض كل الأنواع.",
    clearFilters: "اعرض كل القوالب",
    device: "حجم المعاينة",
    desktop: "كمبيوتر",
    mobile: "موبايل",
  },
} satisfies Messages;

/** The icon tile a template shows when there's no picture or render of it. */
function TemplatePlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-primary-soft text-primary-dark dark:text-primary">
      <LayoutTemplate className="size-8" aria-hidden />
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
}: {
  url: string | null;
  name: string;
  templateId: string;
}) {
  const workspaceId = useWorkspaceId();
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
      <TemplateThumb url={template.thumbnailUrl} name={template.name} templateId={template.id} />
      <div className="flex flex-1 flex-col gap-1 border-t border-line p-4">
        <span className="font-medium text-ink">{template.name}</span>
        {template.category && (
          <span className="text-xs text-ink-soft">{humanize(template.category)}</span>
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
  const toast = useToast();
  const navigate = useNavigate();

  const detail = useAsync(() => apiClient.getWebsiteTemplate(template.id), [template.id]);

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
      toast.success(`Site "${result.website.name}" created.`);
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
            <Spinner className="size-4" /> جارٍ تحميل تفاصيل القالب…
          </span>
        ) : detail.error ? (
          <span className="flex flex-wrap items-center gap-2 text-ink-soft">
            تعذّر تحميل معاينة القالب، بس تقدر تكمّل الإنشاء عادي.
            <button
              type="button"
              onClick={() => detail.refresh()}
              className="cursor-pointer font-medium text-primary hover:underline"
            >
              إعادة المحاولة
            </button>
          </span>
        ) : (
          <>
            <p className="text-ink-soft">
              القالب فيه {pages.length} {pages.length === 1 ? "صفحة" : "صفحات"} هتتنسخ لموقعك:
            </p>
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
        label="Site name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        hint="هيتولّد منه رابط مؤقت (subdomain) تقدر تغيّره بعدين."
        placeholder="My store"
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || name.trim().length === 0}>
          {saving ? "Creating…" : "Use this template"}
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
    toast.success(`Site "${site.name}" deleted.`);
    await sites.refresh({ silent: true });
  }

  return (
    <div className="mb-8">
      <h2 className="mb-2 font-display text-base font-medium text-ink">Your sites</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised">
        {list.map((site) => (
          <li key={site.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{site.name}</p>
              <p className="truncate text-xs text-ink-soft">
                {site.subdomain} · {humanize(site.status)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={`/website/${site.id}/edit`}>
                  <Pencil className="size-4" aria-hidden />
                  Edit
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${site.name}`}
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
        title="Delete this site?"
        confirmLabel="Delete site"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      >
        <div className="space-y-3 text-sm text-ink-soft">
          <p>
            <span className="font-medium text-ink">{pendingDelete?.name}</span> and all of its
            pages, published revisions and any domain bound to it will be deleted permanently.
            This cannot be undone.
          </p>
          {pendingDelete?.status === "published" && (
            <Alert variant="danger">
              This site is live right now. Deleting it takes it offline immediately — anyone
              visiting <span className="font-medium">{pendingDelete.subdomain}</span> will stop
              seeing your store.
            </Alert>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}

export function WebsitePage() {
  const t = useT(STRINGS);
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
      ...categories.map((c) => ({ value: c, label: humanize(c) })),
    ],
    [categories, t.all]
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Website"
        description="Pick a template to start your store's website. You can rename it now and customise it later."
      />

      <ExistingSites />

      <DataState
        loading={templates.loading}
        error={templates.error}
        empty={list.length === 0}
        emptyMessage="No website templates are available right now. Check back soon."
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
        description="Preview what this template ships with, then name your site."
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
