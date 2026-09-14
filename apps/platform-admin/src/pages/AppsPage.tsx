import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Modal } from "@store-builder/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilterChips, SearchInput, SelectField, TextAreaField, TextField } from "@/components/forms";
import { Panel, Td, Th } from "@/components/Panel";
import { Status } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAsync } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";
import { adminApi } from "@/mock/adminApi";
import { APP_CATEGORIES } from "@/mock/constants";
import type { AppStatus, MarketplaceApp, MarketplaceAppInput } from "@/mock/types";
import { formatNumber, formatRelative } from "@/lib/format";

type Filter = "all" | AppStatus;

export function AppsPage() {
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.listApps(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<MarketplaceAppInput | null>(null);
  const [deleting, setDeleting] = useState<MarketplaceApp | null>(null);

  const rows = useMemo(() => data ?? [], [data]);
  const filtered = rows.filter((a) => {
    const q = query.trim().toLowerCase();
    return (filter === "all" || a.status === filter) && (!q || a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
  });
  const options = (
    [
      ["all", "All"],
      ["live", "Live"],
      ["beta", "Beta"],
      ["hidden", "Hidden"],
    ] as Array<[Filter, string]>
  ).map(([value, label]) => ({ value, label, count: value === "all" ? rows.length : rows.filter((a) => a.status === value).length }));

  return (
    <div>
      <PageHeader
        title="Apps"
        description="Catalogue of apps merchants can install."
        actions={
          <Button onClick={() => setEditing({ name: "", category: APP_CATEGORIES[0], description: "", status: "hidden" })}>
            <Plus /> New app
          </Button>
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips options={options} value={filter} onChange={setFilter} />
          <SearchInput value={query} onChange={setQuery} placeholder="Search apps" />
        </div>
        {filtered.length === 0 ? (
          <EmptyBlock message={rows.length === 0 ? "The catalogue is empty." : "No apps match these filters."} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>App</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th className="text-end">Installs</Th>
                  <Th>Updated</Th>
                  <Th className="text-end">Actions</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <Td className="max-w-md whitespace-normal">
                      <span className="block font-medium">{a.name}</span>
                      <span className="text-xs text-ink-soft">{a.description}</span>
                    </Td>
                    <Td className="text-ink-soft">{a.category}</Td>
                    <Td>
                      <Status value={a.status} />
                    </Td>
                    <Td className="tabular text-end">{formatNumber(a.installs)}</Td>
                    <Td className="text-ink-soft">{formatRelative(a.updatedAt)}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${a.name}`}
                          onClick={() => setEditing({ id: a.id, name: a.name, category: a.category, description: a.description, status: a.status })}
                        >
                          <Pencil />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Delete ${a.name}`} onClick={() => setDeleting(a)}>
                          <Trash2 className="text-danger" />
                        </Button>
                      </div>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>

      {editing && (
        <AppEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(app) => {
            setData((prev) => {
              const list = prev ?? [];
              return list.some((x) => x.id === app.id) ? list.map((x) => (x.id === app.id ? app : x)) : [app, ...list];
            });
            toast.success(`${app.name} saved.`);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name ?? ""}?`}
        description={deleting && deleting.installs > 0 ? `${formatNumber(deleting.installs)} workspaces have it installed. Consider hiding it instead.` : "It will be removed from the catalogue."}
        confirmLabel="Delete app"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await adminApi.deleteApp(deleting.id);
          setData((prev) => (prev ?? []).filter((x) => x.id !== deleting.id));
          toast.success("App deleted.");
          setDeleting(null);
        }}
      />
    </div>
  );
}

function AppEditor({ initial, onClose, onSaved }: { initial: MarketplaceAppInput; onClose: () => void; onSaved: (a: MarketplaceApp) => void }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(await adminApi.saveApp(form));
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={initial.id ? `Edit ${initial.name}` : "New app"}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="app-form" disabled={busy}>
            {busy ? "Saving…" : "Save app"}
          </Button>
        </>
      }
    >
      <form id="app-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {APP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Status"
            hint="Hidden apps are not listed to merchants."
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as AppStatus })}
          >
            <option value="live">Live</option>
            <option value="beta">Beta</option>
            <option value="hidden">Hidden</option>
          </SelectField>
        </div>
        <TextAreaField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </form>
    </Modal>
  );
}
