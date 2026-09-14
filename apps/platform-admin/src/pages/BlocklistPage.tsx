import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Modal } from "@store-builder/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilterChips, SearchInput, SelectField, TextAreaField, TextField } from "@/components/forms";
import { Panel, Td, Th } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAsync } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";
import { adminApi } from "@/mock/adminApi";
import type { BlocklistEntry, BlocklistType } from "@/mock/types";
import { formatDate, formatRelative, toDateInput } from "@/lib/format";

type Filter = "all" | BlocklistType;

interface EntryForm {
  id?: string;
  type: BlocklistType;
  value: string;
  reason: string;
  expires: string;
}

export function BlocklistPage() {
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.listBlocklist(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<EntryForm | null>(null);
  const [deleting, setDeleting] = useState<BlocklistEntry | null>(null);

  const rows = useMemo(() => data ?? [], [data]);
  const filtered = rows.filter((b) => {
    const q = query.trim().toLowerCase();
    return (filter === "all" || b.type === filter) && (!q || b.value.toLowerCase().includes(q) || b.reason.toLowerCase().includes(q));
  });
  const options = (
    [
      ["all", "All"],
      ["phone", "Phone"],
      ["ip", "IP"],
      ["email", "Email"],
    ] as Array<[Filter, string]>
  ).map(([value, label]) => ({ value, label, count: value === "all" ? rows.length : rows.filter((b) => b.type === value).length }));

  return (
    <div>
      <PageHeader
        title="Global blocklist"
        description="Values blocked at checkout on every store on the platform."
        actions={
          <Button onClick={() => setEditing({ type: "phone", value: "", reason: "", expires: "" })}>
            <Plus /> Add entry
          </Button>
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips options={options} value={filter} onChange={setFilter} />
          <SearchInput value={query} onChange={setQuery} placeholder="Search value or reason" />
        </div>
        {filtered.length === 0 ? (
          <EmptyBlock message={rows.length === 0 ? "The global blocklist is empty." : "No entries match these filters."} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Type</Th>
                  <Th>Value</Th>
                  <Th>Reason</Th>
                  <Th>Added by</Th>
                  <Th>Added</Th>
                  <Th>Expires</Th>
                  <Th className="text-end">Actions</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => {
                  const expired = b.expiresAt !== null && new Date(b.expiresAt).getTime() < Date.now();
                  return (
                    <TableRow key={b.id}>
                      <Td>
                        <StatusBadge tone="neutral">{b.type}</StatusBadge>
                      </Td>
                      <Td className="font-mono text-sm">{b.value}</Td>
                      <Td className="max-w-sm whitespace-normal text-ink-soft">{b.reason}</Td>
                      <Td className="text-ink-soft">{b.createdBy}</Td>
                      <Td className="text-ink-soft">{formatRelative(b.createdAt)}</Td>
                      <Td>
                        {b.expiresAt ? (
                          <span className={expired ? "text-ink-muted line-through" : "text-ink"}>{formatDate(b.expiresAt)}</span>
                        ) : (
                          <span className="text-ink-soft">Never</span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Edit ${b.value}`}
                            onClick={() => setEditing({ id: b.id, type: b.type, value: b.value, reason: b.reason, expires: toDateInput(b.expiresAt) })}
                          >
                            <Pencil />
                          </Button>
                          <Button size="icon-sm" variant="ghost" aria-label={`Remove ${b.value}`} onClick={() => setDeleting(b)}>
                            <Trash2 className="text-danger" />
                          </Button>
                        </div>
                      </Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>

      {editing && (
        <EntryEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(entry) => {
            setData((prev) => {
              const list = prev ?? [];
              return list.some((x) => x.id === entry.id) ? list.map((x) => (x.id === entry.id ? entry : x)) : [entry, ...list];
            });
            toast.success(`${entry.value} saved.`);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={`Remove ${deleting?.value ?? ""}?`}
        description="Checkout on every store will accept this value again."
        confirmLabel="Remove entry"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await adminApi.deleteBlocklistEntry(deleting.id);
          setData((prev) => (prev ?? []).filter((x) => x.id !== deleting.id));
          toast.success("Entry removed.");
          setDeleting(null);
        }}
      />
    </div>
  );
}

function EntryEditor({ initial, onClose, onSaved }: { initial: EntryForm; onClose: () => void; onSaved: (e: BlocklistEntry) => void }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await adminApi.saveBlocklistEntry({
          id: form.id,
          type: form.type,
          value: form.value,
          reason: form.reason,
          expiresAt: form.expires ? new Date(`${form.expires}T23:59:59`).toISOString() : null,
        })
      );
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  const placeholder = form.type === "phone" ? "+20 100 555 0100" : form.type === "ip" ? "203.0.113.10" : "name@example.com";

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={initial.id ? "Edit blocklist entry" : "Add to global blocklist"}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="blocklist-form" disabled={busy}>
            {busy ? "Saving…" : "Save entry"}
          </Button>
        </>
      }
    >
      <form id="blocklist-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_1fr]">
          <SelectField label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as BlocklistType })}>
            <option value="phone">Phone</option>
            <option value="ip">IP address</option>
            <option value="email">Email</option>
          </SelectField>
          <TextField label="Value" required placeholder={placeholder} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        </div>
        <TextAreaField label="Reason" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <TextField
          label="Expires"
          type="date"
          hint="Leave empty to block permanently."
          min={toDateInput(new Date().toISOString())}
          value={form.expires}
          onChange={(e) => setForm({ ...form, expires: e.target.value })}
        />
      </form>
    </Modal>
  );
}
