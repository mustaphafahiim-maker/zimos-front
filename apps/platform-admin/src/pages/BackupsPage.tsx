import { useState } from "react";
import { Link } from "react-router-dom";
import { DatabaseBackup, History } from "lucide-react";
import { Alert, Button, Input, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/forms";
import { Panel, Td, Th } from "@/components/Panel";
import { Status, StatusBadge, humanize } from "@/components/StatusBadge";
import { useAction } from "@/components/controls";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { controlApi } from "@/mock/controlApi";
import type { BackupSnapshot } from "@/mock/controlTypes";

export function BackupsPage() {
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useAsync(() => controlApi.listBackups(), []);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [restoreStep1, setRestoreStep1] = useState<BackupSnapshot | null>(null);
  const [restoreStep2, setRestoreStep2] = useState<BackupSnapshot | null>(null);
  const [typed, setTyped] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const { busy, run } = useAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data & backups"
        description="Database snapshots, restores and merchant data export requests."
        actions={<Button onClick={() => { setLabel(""); setCreating(true); }}><DatabaseBackup /> Create snapshot</Button>}
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data && (
          <>
            <Panel flush title="Snapshots" description="Nightly automatic snapshots are kept for 7 days.">
              {data.snapshots.length === 0 ? (
                <div className="p-4"><EmptyBlock message="No snapshots yet." /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <Th>Snapshot</Th><Th>Type</Th><Th>Status</Th><Th>Size</Th><Th>Created</Th><Th className="text-end">Actions</Th>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.snapshots.map((s) => (
                        <TableRow key={s.id}>
                          <Td>
                            <span className="block font-medium">{s.label}</span>
                            {s.restoredAt && <span className="text-xs text-warning">Restored {formatRelative(s.restoredAt)}</span>}
                          </Td>
                          <Td><StatusBadge tone={s.kind === "manual" ? "primary" : "neutral"}>{s.kind}</StatusBadge></Td>
                          <Td><StatusBadge tone={s.status === "completed" ? "success" : s.status === "failed" ? "danger" : "info"} dot>{humanize(s.status)}</StatusBadge></Td>
                          <Td className="tabular text-ink-soft">{formatNumber(s.sizeMb)} MB</Td>
                          <Td className="text-ink-soft"><span title={formatDateTime(s.createdAt)}>{formatRelative(s.createdAt)}</span> · {s.createdBy}</Td>
                          <Td className="text-end">
                            <Button size="sm" variant="outline" className="text-danger" disabled={s.status !== "completed"} onClick={() => setRestoreStep1(s)}>
                              <History /> Restore
                            </Button>
                          </Td>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Panel>

            <Panel flush title="Data export requests" description="Merchant and admin requests for full data exports.">
              {data.exports.length === 0 ? (
                <div className="p-4"><EmptyBlock message="No export requests." /></div>
              ) : (
                <ul className="divide-y divide-line">
                  {data.exports.map((e) => (
                    <li key={e.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">
                          <Link to={`/workspaces/${e.workspaceId}`} className="hover:text-primary">{e.workspaceName}</Link> · {humanize(e.scope)} export
                        </p>
                        <p className="text-xs text-ink-soft">Requested by {e.requestedBy} · {formatRelative(e.createdAt)}</p>
                      </div>
                      <Status value={e.status === "ready" ? "resolved" : e.status === "processing" ? "scheduled" : e.status} label={humanize(e.status)} />
                      {e.status === "pending" && (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" disabled={busy === e.id} onClick={() => void run(e.id, () => controlApi.decideExport(e.id, true), "Export approved.").then((r) => r && setData((p) => (p ? { ...p, exports: p.exports.map((x) => (x.id === r.id ? r : x)) } : p)))}>Approve</Button>
                          <Button size="sm" variant="ghost" className="text-danger" disabled={busy === e.id} onClick={() => void run(e.id, () => controlApi.decideExport(e.id, false), "Export rejected.").then((r) => r && setData((p) => (p ? { ...p, exports: p.exports.map((x) => (x.id === r.id ? r : x)) } : p)))}>Reject</Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}
      </DataState>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create snapshot"
        description="Takes a consistent snapshot of the production database."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button disabled={busy === "create"} onClick={() => void run("create", () => controlApi.createSnapshot(label), "Snapshot created.").then((s) => { if (s) { setData((p) => (p ? { ...p, snapshots: [s, ...p.snapshots] } : p)); setCreating(false); } })}>
              {busy === "create" ? "Creating…" : "Create snapshot"}
            </Button>
          </>
        }
      >
        <TextField label="Label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Before plans migration" hint="Optional." />
      </Modal>

      <ConfirmDialog
        open={!!restoreStep1}
        title={`Restore “${restoreStep1?.label ?? ""}”?`}
        description="Restoring replaces ALL current platform data with this snapshot. Every change since then is lost."
        confirmLabel="Continue"
        destructive
        onCancel={() => setRestoreStep1(null)}
        onConfirm={() => {
          setRestoreStep2(restoreStep1);
          setRestoreStep1(null);
          setTyped("");
          setRestoreError(null);
        }}
      />
      <Modal
        open={!!restoreStep2}
        onClose={() => !restoring && setRestoreStep2(null)}
        title="Final confirmation"
        description={`Type RESTORE to restore ${restoreStep2?.label ?? ""}.`}
        footer={
          <>
            <Button variant="outline" disabled={restoring} onClick={() => setRestoreStep2(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={typed !== "RESTORE" || restoring}
              onClick={async () => {
                if (!restoreStep2) return;
                setRestoring(true);
                setRestoreError(null);
                try {
                  const s = await controlApi.restoreSnapshot(restoreStep2.id, typed);
                  setData((p) => (p ? { ...p, snapshots: p.snapshots.map((x) => (x.id === s.id ? s : x)) } : p));
                  toast.success("Restore started.");
                  setRestoreStep2(null);
                } catch (err) {
                  setRestoreError(getErrorMessage(err));
                } finally {
                  setRestoring(false);
                }
              }}
            >
              {restoring ? "Restoring…" : "Restore snapshot"}
            </Button>
          </>
        }
      >
        {restoreError && <Alert variant="danger" className="mb-3">{restoreError}</Alert>}
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type RESTORE" placeholder="RESTORE" autoFocus />
      </Modal>
    </div>
  );
}
