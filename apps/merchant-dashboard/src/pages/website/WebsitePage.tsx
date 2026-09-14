import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LayoutTemplate, Pencil, Trash2 } from "lucide-react";
import { Alert, Button, Spinner } from "@store-builder/ui";
import type { CreateWebsitePayload, Website, WebsiteTemplateSummary } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { humanize } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Website",
    description:
      "Pick a template to start your store's website. You can rename it now and customise it later.",
    templatesHeading: "Templates",
    noTemplates: "No website templates are available right now. Check back soon.",
    modalDescription: "Preview what this template ships with, then name your site.",
    preview: "Preview",
    loadingTemplate: "Loading template details…",
    templateError: "Couldn't load the template preview, but you can still create your site.",
    templatePagesOne: "This template includes 1 page that will be copied to your site:",
    templatePagesMany: "This template includes {n} pages that will be copied to your site:",
    siteName: "Site name",
    siteNameHint: "A temporary subdomain is generated from it — you can change it later.",
    siteNamePlaceholder: "My store",
    creating: "Creating…",
    useTemplate: "Use this template",
    siteCreated: 'Site "{name}" created.',
    siteDeleted: 'Site "{name}" deleted.',
    yourSites: "Your sites",
    deleteSiteAria: "Delete {name}",
    deleteSiteTitle: "Delete this site?",
    deleteSiteConfirm: "Delete site",
    deleteSiteBody:
      "{name} and all of its pages, published revisions and any domain bound to it will be deleted permanently. This cannot be undone.",
    deleteLiveWarning:
      "This site is live right now. Deleting it takes it offline immediately — anyone visiting {subdomain} will stop seeing your store.",
  },
  ar: {
    title: "الموقع",
    description: "اختر قالبًا لبدء موقع متجرك. يمكنك تسميته الآن وتخصيصه لاحقًا.",
    templatesHeading: "القوالب",
    noTemplates: "لا تتوفر قوالب مواقع حاليًا. يُرجى المحاولة لاحقًا.",
    modalDescription: "اطّلع على محتوى هذا القالب، ثم اختر اسمًا لموقعك.",
    preview: "معاينة",
    loadingTemplate: "جارٍ تحميل تفاصيل القالب…",
    templateError: "تعذّر تحميل معاينة القالب، ولكن يمكنك متابعة إنشاء موقعك.",
    templatePagesOne: "يتضمن هذا القالب صفحة واحدة ستُنسخ إلى موقعك:",
    templatePagesMany: "عدد صفحات هذا القالب: {n}، وستُنسخ جميعها إلى موقعك:",
    siteName: "اسم الموقع",
    siteNameHint: "سيُنشأ منه نطاق فرعي (subdomain) مؤقت، ويمكنك تغييره لاحقًا.",
    siteNamePlaceholder: "متجري",
    creating: "جارٍ الإنشاء…",
    useTemplate: "استخدام هذا القالب",
    siteCreated: "تم إنشاء موقع «{name}».",
    siteDeleted: "تم حذف موقع «{name}».",
    yourSites: "مواقعك",
    deleteSiteAria: "حذف {name}",
    deleteSiteTitle: "حذف هذا الموقع؟",
    deleteSiteConfirm: "حذف الموقع",
    deleteSiteBody:
      "سيتم حذف {name} وكل صفحاته وإصداراته المنشورة وأي نطاق مرتبط به نهائيًا. لا يمكن التراجع عن ذلك.",
    deleteLiveWarning:
      "هذا الموقع منشور حاليًا. حذفه سيوقفه فورًا — ولن يتمكن زوّار {subdomain} من رؤية متجرك بعد ذلك.",
  },
} satisfies Messages;

/**
 * Splits a "{key}" template around one placeholder so a React node (bold name,
 * LTR hostname) can sit wherever each language's word order puts it.
 */
function withNode(template: string, key: string, node: ReactNode): ReactNode {
  const token = `{${key}}`;
  const at = template.indexOf(token);
  if (at === -1) return template;
  return (
    <>
      {template.slice(0, at)}
      {node}
      {template.slice(at + token.length)}
    </>
  );
}

/** Square-ish preview for a template card — the thumbnail, or a placeholder. */
function TemplateThumb({ url, name }: { url: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      <img
        src={url}
        alt={name}
        loading="lazy"
        onError={() => setBroken(true)}
        className="aspect-[4/3] w-full object-cover"
      />
    );
  }
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center bg-zimos-ice text-primary">
      <LayoutTemplate className="size-8" aria-hidden />
    </div>
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
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group cursor-pointer flex flex-col overflow-hidden rounded-2xl border border-line bg-paper-raised text-start shadow-card transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <TemplateThumb url={template.thumbnailUrl} name={template.name} />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span dir="auto" className="font-semibold text-ink">
          {template.name}
        </span>
        {template.category && (
          <span className="text-xs text-ink-soft">{humanize(template.category)}</span>
        )}
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium text-primary">
          {t.preview}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
    </button>
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
  const t = useT(STRINGS);
  const c = useCommon();
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
      toast.success(fmt(t.siteCreated, { name: result.website.name }));
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

      <div className="rounded-xl border border-line bg-zimos-ice/50 px-4 py-3 text-sm">
        {detail.loading ? (
          <span className="flex items-center gap-2 text-ink-soft">
            <Spinner className="size-4" /> {t.loadingTemplate}
          </span>
        ) : detail.error ? (
          <span className="flex flex-wrap items-center gap-2 text-ink-soft">
            {t.templateError}
            <button
              type="button"
              onClick={() => detail.refresh()}
              className="cursor-pointer font-medium text-primary hover:underline"
            >
              {c.retry}
            </button>
          </span>
        ) : (
          <>
            <p className="text-ink-soft">
              {pages.length === 1
                ? t.templatePagesOne
                : fmt(t.templatePagesMany, { n: pages.length })}
            </p>
            {pages.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {pages.map((p) => (
                  <li
                    key={p.path}
                    dir="auto"
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
        dir="auto"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        hint={t.siteNameHint}
        placeholder={t.siteNamePlaceholder}
      />

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
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
  const c = useCommon();
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

  return (
    <section className="mb-8">
      <h2 className="mb-2 font-display text-base font-semibold text-ink">{t.yourSites}</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-card">
        {list.map((site) => (
          <li key={site.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p dir="auto" className="truncate text-sm font-semibold text-ink">
                {site.name}
              </p>
              <p className="truncate text-xs text-ink-soft">
                <bdi dir="ltr">{site.subdomain}</bdi> · {humanize(site.status)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={`/website/${site.id}/edit`}>
                  <Pencil className="size-4" aria-hidden />
                  {c.edit}
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={fmt(t.deleteSiteAria, { name: site.name })}
                title={c.delete}
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
        title={t.deleteSiteTitle}
        confirmLabel={t.deleteSiteConfirm}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      >
        <div className="space-y-3 text-sm text-ink-soft">
          <p>
            {withNode(
              t.deleteSiteBody,
              "name",
              <bdi className="font-semibold text-ink">{pendingDelete?.name}</bdi>
            )}
          </p>
          {pendingDelete?.status === "published" && (
            <Alert variant="danger">
              {withNode(
                t.deleteLiveWarning,
                "subdomain",
                <bdi dir="ltr" className="font-medium">
                  {pendingDelete.subdomain}
                </bdi>
              )}
            </Alert>
          )}
        </div>
      </ConfirmDialog>
    </section>
  );
}

export function WebsitePage() {
  const t = useT(STRINGS);
  const templates = useAsync(() => apiClient.listWebsiteTemplates(), []);

  const [selected, setSelected] = useState<WebsiteTemplateSummary | null>(null);

  const list = templates.data ?? [];

  return (
    <div className="max-w-4xl">
      <PageHeader title={t.title} description={t.description} />

      <ExistingSites />

      <h2 className="mb-3 font-display text-base font-semibold text-ink">{t.templatesHeading}</h2>
      <DataState
        loading={templates.loading}
        error={templates.error}
        empty={list.length === 0}
        emptyMessage={t.noTemplates}
        onRetry={() => templates.refresh()}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={() => setSelected(template)}
            />
          ))}
        </div>
      </DataState>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? selected.name : ""}
        description={t.modalDescription}
      >
        {selected && (
          <UseTemplateForm template={selected} onCancel={() => setSelected(null)} />
        )}
      </Modal>
    </div>
  );
}
