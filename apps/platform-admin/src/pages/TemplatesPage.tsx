import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Input } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, FilterChips, SearchInput, SelectField, TextField } from "@/components/forms";
import { Toggle } from "@/components/Toggle";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { adminApi } from "@/mock/adminApi";
import { TEMPLATE_CATEGORIES } from "@/mock/constants";
import type { Template, TemplateKind } from "@/mock/types";
import { formatDate, formatMoney, formatRelative } from "@/lib/format";

type KindFilter = "all" | TemplateKind;

interface TemplateForm {
  id?: string;
  name: string;
  kind: TemplateKind;
  category: string;
  price: string;
  free: boolean;
  primaryColor: string;
  rtl: boolean;
  published: boolean;
}

const EMPTY: TemplateForm = {
  name: "",
  kind: "store",
  category: "General",
  price: "0",
  free: true,
  primaryColor: "#0066FF",
  rtl: true,
  published: false,
};

export function TemplatesPage() {
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.listTemplates(), []);
  const [kind, setKind] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ form: TemplateForm; template: Template | null } | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);

  const rows = useMemo(() => data ?? [], [data]);
  const filtered = rows.filter(
    (t) => (kind === "all" || t.kind === kind) && (!query.trim() || t.name.toLowerCase().includes(query.trim().toLowerCase()))
  );

  const replace = (t: Template) => setData((prev) => (prev ?? []).map((x) => (x.id === t.id ? t : x)));

  async function togglePublished(t: Template, published: boolean) {
    replace({ ...t, published });
    try {
      replace(await adminApi.setTemplatePublished(t.id, published));
      toast.success(`${t.name} ${published ? "published" : "unpublished"}.`);
    } catch (err) {
      replace(t);
      toast.error(getErrorMessage(err));
    }
  }

  const options = (
    [
      ["all", "All"],
      ["store", "Store"],
      ["funnel", "Funnel"],
      ["landing", "Landing"],
    ] as Array<[KindFilter, string]>
  ).map(([value, label]) => ({ value, label, count: value === "all" ? rows.length : rows.filter((t) => t.kind === value).length }));

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Store, funnel and landing templates available to merchants."
        actions={
          <Button onClick={() => setEditing({ form: { ...EMPTY }, template: null })}>
            <Plus /> New template
          </Button>
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips options={options} value={kind} onChange={setKind} />
          <SearchInput value={query} onChange={setQuery} placeholder="Search templates" />
        </div>
        {filtered.length === 0 ? (
          <EmptyBlock message={rows.length === 0 ? "No templates yet." : "No templates match these filters."} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {filtered.map((t) => (
              <article key={t.id} className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised">
                <div className="relative h-28 border-b border-line bg-paper p-3" aria-hidden>
                  <div className="h-3 w-1/2 rounded" style={{ background: t.primaryColor }} />
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-12 rounded border border-line bg-paper-raised" />
                    ))}
                  </div>
                  <div className="mt-1.5 h-2 w-1/3 rounded" style={{ background: t.primaryColor, opacity: 0.4 }} />
                </div>
                <div className="flex-1 space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-ink">{t.name}</h2>
                    <span className="tabular shrink-0 text-sm font-medium text-ink">{t.free ? "Free" : formatMoney(t.price)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge tone="primary">{t.kind}</StatusBadge>
                    <StatusBadge tone="neutral">{t.category}</StatusBadge>
                    {t.rtl && <StatusBadge tone="info">RTL</StatusBadge>}
                  </div>
                  <p className="text-xs text-ink-soft">
                    v{t.versions[t.versions.length - 1]?.version ?? "—"} · {t.versions.length} version{t.versions.length === 1 ? "" : "s"} · updated{" "}
                    {formatRelative(t.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
                  <Toggle label={`Published: ${t.name}`} hideLabel checked={t.published} onChange={(v) => void togglePublished(t, v)} />
                  <span className="me-auto ms-2 text-xs text-ink-soft">{t.published ? "Published" : "Draft"}</span>
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => setEditing({ form: toForm(t), template: t })}>
                    <Pencil />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${t.name}`} onClick={() => setDeleting(t)}>
                    <Trash2 className="text-danger" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </DataState>

      {editing && (
        <TemplateEditor
          initial={editing.form}
          template={editing.template}
          onClose={() => setEditing(null)}
          onSaved={(t, close) => {
            setData((prev) => {
              const list = prev ?? [];
              return list.some((x) => x.id === t.id) ? list.map((x) => (x.id === t.id ? t : x)) : [t, ...list];
            });
            if (close) {
              toast.success(`Template “${t.name}” saved.`);
              setEditing(null);
            } else {
              setEditing({ form: toForm(t), template: t });
            }
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description="Stores already using this template keep their copy. It disappears from the template picker."
        confirmLabel="Delete template"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await adminApi.deleteTemplate(deleting.id);
          setData((prev) => (prev ?? []).filter((x) => x.id !== deleting.id));
          toast.success("Template deleted.");
          setDeleting(null);
        }}
      />
    </div>
  );
}

function toForm(t: Template): TemplateForm {
  return {
    id: t.id,
    name: t.name,
    kind: t.kind,
    category: t.category,
    price: String(t.price),
    free: t.free,
    primaryColor: t.primaryColor,
    rtl: t.rtl,
    published: t.published,
  };
}

function TemplateEditor({
  initial,
  template,
  onClose,
  onSaved,
}: {
  initial: TemplateForm;
  template: Template | null;
  onClose: () => void;
  onSaved: (t: Template, close: boolean) => void;
}) {
  const [form, setForm] = useState<TemplateForm>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [versionError, setVersionError] = useState<string | null>(null);
  const [addingVersion, setAddingVersion] = useState(false);
  const set = <K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = await adminApi.saveTemplate({
        id: form.id,
        name: form.name,
        kind: form.kind,
        category: form.category,
        price: Number(form.price) || 0,
        free: form.free,
        primaryColor: form.primaryColor,
        rtl: form.rtl,
        published: form.published,
      });
      onSaved(saved, true);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  async function addVersion() {
    if (!template) return;
    setAddingVersion(true);
    setVersionError(null);
    try {
      const next = await adminApi.addTemplateVersion(template.id, version, notes);
      setVersion("");
      setNotes("");
      onSaved(next, false);
    } catch (err) {
      setVersionError(getErrorMessage(err));
    } finally {
      setAddingVersion(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={template ? `Edit ${template.name}` : "New template"}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="template-form" disabled={busy}>
            {busy ? "Saving…" : "Save template"}
          </Button>
        </>
      }
    >
      <form id="template-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          <SelectField label="Kind" value={form.kind} onChange={(e) => set("kind", e.target.value as TemplateKind)}>
            <option value="store">Store</option>
            <option value="funnel">Funnel</option>
            <option value="landing">Landing page</option>
          </SelectField>
          <SelectField label="Category" value={form.category} onChange={(e) => set("category", e.target.value)}>
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>
          <Field label="Primary color">
            {(p) => (
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Pick primary color"
                  value={/^#[0-9a-f]{6}$/i.test(form.primaryColor) ? form.primaryColor : "#0066ff"}
                  onChange={(e) => set("primaryColor", e.target.value.toUpperCase())}
                  className="h-10 w-12 cursor-pointer rounded-[10px] border border-input bg-paper-raised p-1"
                />
                <Input {...p} value={form.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} />
              </div>
            )}
          </Field>
          <TextField
            label="Price"
            type="number"
            min={0}
            disabled={form.free}
            value={form.free ? "0" : form.price}
            onChange={(e) => set("price", e.target.value)}
          />
          <div className="flex items-end pb-2">
            <Toggle label="Free" checked={form.free} onChange={(v) => set("free", v)} className="w-full" />
          </div>
        </div>
        <div className="space-y-3 rounded-[10px] border border-line p-3">
          <Toggle label="Right-to-left support" description="Template has been checked in Arabic layouts." checked={form.rtl} onChange={(v) => set("rtl", v)} />
          <Toggle label="Published" description="Visible in the merchant template picker." checked={form.published} onChange={(v) => set("published", v)} />
        </div>
      </form>

      {template && (
        <section className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Versions</h3>
          <ol className="mt-2 divide-y divide-line rounded-[10px] border border-line">
            {[...template.versions].reverse().map((v, i) => (
              <li key={v.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <span className="font-mono font-medium text-ink">v{v.version}</span>
                  {i === 0 && (
                    <StatusBadge tone="primary" className="ms-2">
                      Latest
                    </StatusBadge>
                  )}
                  {v.notes && <p className="text-xs text-ink-soft">{v.notes}</p>}
                </div>
                <span className="shrink-0 text-xs text-ink-soft">{formatDate(v.createdAt)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[8rem_1fr_auto]">
            <Input placeholder="1.2.0" aria-label="New version" value={version} onChange={(e) => setVersion(e.target.value)} />
            <Input placeholder="Release notes" aria-label="Release notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button variant="outline" onClick={addVersion} disabled={addingVersion || !version.trim()}>
              {addingVersion ? "Adding…" : "Add version"}
            </Button>
          </div>
          {versionError && <p className="mt-1.5 text-xs font-medium text-danger">{versionError}</p>}
        </section>
      )}
    </Modal>
  );
}
