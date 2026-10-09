import { useState, type FormEvent } from "react";
import { Eye, EyeOff, History, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type {
  AdminTemplate as Template,
  AdminTemplateInput as TemplateInput,
  AdminTemplateKind as Kind,
  AdminTemplateVersion,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Drawer } from "@/components/Drawer";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilterChips, SelectField, TextAreaField, TextField } from "@/components/forms";
import { JsonBlock, Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import { formatDate, formatMinorMoney, formatRelative, PLATFORM_CURRENCY } from "@/lib/format";

type KindFilter = "all" | Kind;

const KIND_LABEL: Record<Kind, string> = { store: "Store", funnel: "Funnel", landing: "Landing page" };

export function TemplatesPage() {
  const toast = useToast();
  const [kind, setKind] = useState<KindFilter>("all");
  const { data, loading, error, refresh, setData } = useAsync(
    () => adminApi.listTemplates(kind === "all" ? {} : { kind }),
    [kind]
  );
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [versionsOf, setVersionsOf] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [publishing, setPublishing] = useState<Set<string>>(new Set());

  const templates = data ?? [];

  function replace(t: Template) {
    setData((prev) => (prev ?? []).map((row) => (row.id === t.id ? t : row)));
  }

  async function togglePublished(t: Template) {
    setPublishing((s) => new Set(s).add(t.id));
    try {
      const updated = await adminApi.setTemplatePublished(t.id, !t.isPublished);
      replace(updated);
      toast.success(updated.isPublished ? `${t.name} is published.` : `${t.name} is unpublished.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPublishing((s) => {
        const next = new Set(s);
        next.delete(t.id);
        return next;
      });
    }
  }

  const options: Array<{ value: KindFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "store", label: "Stores" },
    { value: "funnel", label: "Funnels" },
    { value: "landing", label: "Landing pages" },
  ];

  return (
    <div>
      <PageHeader
        title="Templates"
        description="The gallery merchants pick from after signing up."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus /> New template
          </Button>
        }
      />
      <FilterChips options={options} value={kind} onChange={setKind} className="mb-4" />

      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {templates.length === 0 ? (
          <EmptyBlock message={kind === "all" ? "No templates yet." : "No templates of this kind."} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Template</Th>
                  <Th>Kind</Th>
                  <Th>Price</Th>
                  <Th>Gallery</Th>
                  <Th>Version</Th>
                  {/* The websites and funnels made from it, not counting the trash (handoff 401). */}
                  <Th>Uses</Th>
                  <Th className="text-end">
                    <span className="sr-only">Actions</span>
                  </Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        {t.thumbnailUrl ? (
                          <img src={t.thumbnailUrl} alt="" className="size-10 shrink-0 rounded-md border border-line object-cover" />
                        ) : (
                          <span
                            className="size-10 shrink-0 rounded-md border border-line"
                            style={{ background: t.primaryColor ?? "var(--color-paper)" }}
                            aria-hidden
                          />
                        )}
                        <div className="min-w-0">
                          <span className="block truncate font-medium">{t.name}</span>
                          <span className="block truncate text-xs text-ink-soft">
                            {[t.category, t.rtl ? "RTL" : "LTR", ...t.tags].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-sm">{KIND_LABEL[t.kind]}</Td>
                    <Td className="whitespace-nowrap text-sm">
                      {t.isFree ? "Free" : formatMinorMoney(t.priceAmount, PLATFORM_CURRENCY)}
                      {t.isFree && t.priceAmount > 0 && (
                        <span className="block text-xs text-ink-soft line-through">
                          {formatMinorMoney(t.priceAmount, PLATFORM_CURRENCY)}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {t.inGallery ? (
                        <StatusBadge tone="success" dot>
                          In gallery
                        </StatusBadge>
                      ) : t.isPublished ? (
                        <StatusBadge tone="warning" dot>
                          Published, no active version
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral" dot>
                          Draft
                        </StatusBadge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-sm">
                      {t.activeVersion !== null ? `v${t.activeVersion}` : <span className="text-ink-soft">None active</span>}
                      <span className="block text-xs text-ink-soft">
                        {t.versionCount} version{t.versionCount === 1 ? "" : "s"}
                      </span>
                    </Td>
                    <Td className="text-sm tabular-nums" data-slot="template-uses">
                      {(t as { usesCount?: number }).usesCount ?? 0}
                    </Td>
                    <Td className="text-end whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={publishing.has(t.id) || (!t.isPublished && t.activeVersion === null)}
                        title={!t.isPublished && t.activeVersion === null ? "Add or activate a version first." : undefined}
                        onClick={() => void togglePublished(t)}
                      >
                        {t.isPublished ? <EyeOff /> : <Eye />} {t.isPublished ? "Unpublish" : "Publish"}
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Versions of ${t.name}`} onClick={() => setVersionsOf(t)}>
                        <History />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)}>
                        <Pencil />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Delete ${t.name}`} onClick={() => setDeleting(t)}>
                        <Trash2 className="text-danger" />
                      </Button>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>

      {editing && (
        <TemplateModal
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(t, created) => {
            toast.success(created ? `${t.name} created — add a version to publish it.` : `${t.name} saved.`);
            setEditing(null);
            void refresh({ silent: true });
          }}
        />
      )}
      {versionsOf && (
        <VersionsDrawer
          template={versionsOf}
          onClose={() => setVersionsOf(null)}
          onChanged={() => void refresh({ silent: true })}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name ?? ""}?`}
        description="The template and all its versions are removed. A template a merchant site was built from cannot be deleted — unpublish it instead."
        confirmLabel="Delete template"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await adminApi.deleteTemplate(deleting.id);
          toast.success("Template deleted.");
          setDeleting(null);
          void refresh({ silent: true });
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------ the form

interface FormState {
  name: string;
  category: string;
  thumbnailUrl: string;
  kind: Kind;
  priceAmount: string;
  isFree: boolean;
  primaryColor: string;
  tags: string;
  rtl: boolean;
}

function toForm(t: Template | null): FormState {
  return {
    name: t?.name ?? "",
    category: t?.category ?? "",
    thumbnailUrl: t?.thumbnailUrl ?? "",
    kind: t?.kind ?? "store",
    priceAmount: String(t?.priceAmount ?? 0),
    isFree: t?.isFree ?? true,
    primaryColor: t?.primaryColor ?? "",
    tags: (t?.tags ?? []).join(", "),
    rtl: t?.rtl ?? true,
  };
}

function TemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: Template | null;
  onClose: () => void;
  onSaved: (t: Template, created: boolean) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(template));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const price = Number(form.priceAmount);
    if (!Number.isInteger(price) || price < 0) {
      setError("The price is a whole number of piastres (minor units), 0 or more.");
      return;
    }
    setBusy(true);
    setError(null);
    const input: TemplateInput = {
      ...(template ? { id: template.id } : {}),
      name: form.name.trim(),
      category: form.category.trim(),
      thumbnailUrl: form.thumbnailUrl.trim(),
      kind: form.kind,
      priceAmount: price,
      isFree: form.isFree,
      primaryColor: form.primaryColor.trim(),
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      rtl: form.rtl,
    };
    try {
      onSaved(await adminApi.saveTemplate(input), !template);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={template ? `Edit ${template.name}` : "New template"}
      description="The gallery card. Page content lives in the template's versions."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="template-form" disabled={busy}>
            {busy ? "Saving…" : template ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <form id="template-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField label="Name" required maxLength={200} value={form.name} onChange={(e) => set("name", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Kind" value={form.kind} onChange={(e) => set("kind", e.target.value as Kind)}>
            <option value="store">Store</option>
            <option value="funnel">Funnel</option>
            <option value="landing">Landing page</option>
          </SelectField>
          <TextField label="Category" maxLength={100} value={form.category} onChange={(e) => set("category", e.target.value)} />
        </div>
        <TextField
          label="Thumbnail URL"
          type="url"
          maxLength={500}
          value={form.thumbnailUrl}
          onChange={(e) => set("thumbnailUrl", e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="List price (piastres)"
            type="number"
            min={0}
            step="1"
            value={form.priceAmount}
            hint={Number(form.priceAmount) > 0 ? formatMinorMoney(Number(form.priceAmount), PLATFORM_CURRENCY) : undefined}
            onChange={(e) => set("priceAmount", e.target.value)}
          />
          <TextField
            label="Swatch colour"
            placeholder="#2563EB"
            hint="Empty: the active version's primary colour."
            value={form.primaryColor}
            onChange={(e) => set("primaryColor", e.target.value)}
          />
        </div>
        <TextField label="Tags" hint="Comma-separated." value={form.tags} onChange={(e) => set("tags", e.target.value)} />
        <div className="flex flex-wrap gap-6">
          <Toggle label="Free" checked={form.isFree} onChange={(v) => set("isFree", v)} />
          <Toggle label="Right-to-left" checked={form.rtl} onChange={(v) => set("rtl", v)} />
        </div>
      </form>
    </Modal>
  );
}

// -------------------------------------------------------------- the versions

function VersionsDrawer({
  template,
  onClose,
  onChanged,
}: {
  template: Template;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { data, loading, error, refresh } = useAsync(() => adminApi.getTemplate(template.id), [template.id]);
  const [viewing, setViewing] = useState<AdminTemplateVersion | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const versions = data?.versions ?? [];
  const current = data?.template ?? template;

  async function toggle(versionId: string, isActive: boolean) {
    setBusy(versionId);
    try {
      await adminApi.setTemplateVersionActive(template.id, versionId, isActive);
      await refresh({ silent: true });
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function view(versionId: string) {
    try {
      setViewing(await adminApi.getTemplateVersion(template.id, versionId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  /** Starts a new version from the newest one's content, so an edit is a small diff. */
  async function startAdding() {
    const latest = versions[0];
    if (!latest) {
      setAdding(JSON.stringify({ globalStyles: {}, pages: [{ path: "/", title: "Home", pageType: "home", builderData: { version: 1, sections: [] } }], sections: [] }, null, 2));
      return;
    }
    try {
      const full = await adminApi.getTemplateVersion(template.id, latest.id);
      setAdding(JSON.stringify({ globalStyles: full.globalStyles, pages: full.pages, sections: full.sections }, null, 2));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Versions — ${current.name}`}
      description="The gallery offers the newest active version. Versions are never edited: websites were copied from them."
      className="sm:max-w-2xl"
    >
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          {current.inGallery ? (
            <StatusBadge tone="success" dot>
              In the gallery as v{current.activeVersion}
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral" dot>
              Not in the gallery
            </StatusBadge>
          )}
          <Button size="sm" onClick={() => void startAdding()} disabled={adding !== null}>
            <Plus /> New version
          </Button>
        </div>

        {adding !== null && (
          <NewVersionForm
            templateId={template.id}
            initial={adding}
            onCancel={() => setAdding(null)}
            onCreated={async (n) => {
              toast.success(`Version ${n} added.`);
              setAdding(null);
              await refresh({ silent: true });
              onChanged();
            }}
          />
        )}

        {versions.length === 0 ? (
          <EmptyBlock message="No versions yet. Add one to be able to publish this template." />
        ) : (
          <ul className="divide-y divide-line rounded-[10px] border border-line">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">v{v.version}</span>
                    {v.primaryColor && (
                      <span className="size-3 rounded-full border border-line" style={{ background: v.primaryColor }} aria-hidden />
                    )}
                    {v.isActive ? (
                      <StatusBadge tone="success">Active</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">Inactive</StatusBadge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {v.pageCount} page{v.pageCount === 1 ? "" : "s"} ({v.pagePaths.join(", ")}) · {v.websiteCount} site
                    {v.websiteCount === 1 ? "" : "s"} and {(v as { funnelCount?: number }).funnelCount ?? 0} funnel
                    {((v as { funnelCount?: number }).funnelCount ?? 0) === 1 ? "" : "s"} built from it · added {formatRelative(v.createdAt)}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => void view(v.id)}>
                  View
                </Button>
                <Toggle
                  label={`v${v.version} active`}
                  hideLabel
                  checked={v.isActive}
                  disabled={busy === v.id}
                  onChange={(on) => void toggle(v.id, on)}
                />
              </li>
            ))}
          </ul>
        )}
      </DataState>

      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={`v${viewing.version} content`} className="max-w-3xl">
          <p className="mb-2 text-xs text-ink-soft">Added {formatDate(viewing.createdAt)}. Read-only.</p>
          <JsonBlock
            value={{ globalStyles: viewing.globalStyles, pages: viewing.pages, sections: viewing.sections }}
            className="max-h-[60vh]"
          />
        </Modal>
      )}
    </Drawer>
  );
}

function NewVersionForm({
  templateId,
  initial,
  onCancel,
  onCreated,
}: {
  templateId: string;
  initial: string;
  onCancel: () => void;
  onCreated: (version: number) => void | Promise<void>;
}) {
  const [json, setJson] = useState(initial);
  const [activate, setActivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setError("That is not valid JSON.");
      return;
    }
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { pages?: unknown }).pages)) {
      setError('Expected an object with a "pages" array (and optionally "globalStyles" and "sections").');
      return;
    }
    const body = parsed as { globalStyles?: Record<string, unknown>; pages: []; sections?: [] };
    setBusy(true);
    setError(null);
    try {
      const created = await adminApi.createTemplateVersion(templateId, {
        globalStyles: body.globalStyles ?? {},
        pages: body.pages,
        sections: body.sections ?? [],
        activate,
      });
      await onCreated(created.version);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 space-y-3 rounded-[10px] border border-line bg-paper p-4">
      {error && <Alert variant="danger">{error}</Alert>}
      <TextAreaField
        label="Version content (JSON)"
        hint="Prefilled from the newest version. Every page is checked exactly as it will be when a merchant creates a site from it."
        rows={14}
        className="font-mono"
        spellCheck={false}
        value={json}
        onChange={(e) => setJson(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Toggle label="Make it the version the gallery offers" checked={activate} onChange={setActivate} />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add version"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-ink-soft">
        Keys: <Mono>globalStyles</Mono>, <Mono>pages</Mono> (each with <Mono>path</Mono>, <Mono>title</Mono>,{" "}
        <Mono>pageType</Mono>, <Mono>builderData</Mono>, <Mono>seo</Mono>), <Mono>sections</Mono>.
      </p>
    </form>
  );
}
