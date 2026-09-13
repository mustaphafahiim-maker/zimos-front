import { useState, type FormEvent } from "react";
import { Copy, Globe } from "lucide-react";
import { Alert, Button, Spinner } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { DomainRecord } from "@/mock/types";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";

const CNAME_TARGET = "stores.zimos.app";

const STATUS_TONE: Record<DomainRecord["status"], "success" | "warning" | "danger" | "info"> = {
  active: "success",
  verified: "info",
  pending_verification: "warning",
  failed: "danger",
};

export function DomainsTab() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const domains = useAsync(() => mockApi.listDomains(workspaceId), [workspaceId]);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<DomainRecord | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<DomainRecord | null>(null);

  const list = domains.data ?? [];
  const reload = () => domains.refresh({ silent: true });

  async function verify(d: DomainRecord) {
    setVerifyingId(d.id);
    try {
      await mockApi.verifyDomain(workspaceId, d.id);
      toast.success(`${d.hostname} verified.`);
      reload();
    } finally {
      setVerifyingId(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    await mockApi.removeDomain(workspaceId, removing.id);
    toast.success(`${removing.hostname} removed.`);
    if (justAdded?.id === removing.id) setJustAdded(null);
    setRemoving(null);
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">Domains</h2>
          <p className="mt-1 text-sm text-ink-soft">Point your own domain at the store or at a single funnel.</p>
        </div>
        <Button onClick={() => setAdding(true)}>Add domain</Button>
      </div>

      <DataState loading={domains.loading} error={domains.error} onRetry={() => domains.refresh()}>
        {list.length === 0 ? (
          <EmptyState icon={<Globe />} title="No custom domains" description="Your store is reachable on its zimos.app subdomain until you add one." action={<Button onClick={() => setAdding(true)}>Add domain</Button>} />
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Hostname</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{d.hostname}</span>
                        {d.isPrimary && <StatusBadge value="primary" tone="info" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      <span className="text-xs uppercase tracking-wide">{d.target}</span> · {d.targetLabel}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={d.status} tone={STATUS_TONE[d.status]} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {(d.status === "pending_verification" || d.status === "failed") && (
                        <Button size="sm" variant="ghost" onClick={() => verify(d)} disabled={verifyingId === d.id}>
                          {verifyingId === d.id ? (
                            <>
                              <Spinner className="size-3" /> Verifying…
                            </>
                          ) : (
                            "Verify"
                          )}
                        </Button>
                      )}
                      {!d.isPrimary && (
                        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setRemoving(d)}>
                          Remove
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataState>

      {justAdded && <DnsInstructions domain={justAdded} onDismiss={() => setJustAdded(null)} />}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add domain" description="You will need access to the domain's DNS settings.">
        {adding && (
          <AddDomainForm
            onCancel={() => setAdding(false)}
            onDone={(rec) => {
              setAdding(false);
              setJustAdded(rec);
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.hostname ?? ""}?`}
        description="Visitors to this domain will see an error until you point it elsewhere."
        confirmLabel="Remove domain"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied.");
    } catch {
      toast.error("Could not copy — select the text manually.");
    }
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs uppercase tracking-wide text-ink-soft">{label}</span>
      <code className="flex-1 truncate rounded bg-paper px-2 py-1 text-xs text-ink">{value}</code>
      <Button size="sm" variant="ghost" onClick={copy} aria-label={`Copy ${label}`}>
        <Copy />
      </Button>
    </div>
  );
}

function DnsInstructions({ domain, onDismiss }: { domain: DomainRecord; onDismiss: () => void }) {
  return (
    <Alert variant="info" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">Finish setting up {domain.hostname}</p>
          <p className="text-xs text-ink-soft">Add these two records at your DNS provider, then click Verify. Propagation can take up to an hour.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      <div className="space-y-2 rounded-[0.5rem] border border-line bg-paper-raised p-3">
        <CopyRow label="TXT" value={`_zimos.${domain.hostname}  →  ${domain.verificationToken}`} />
        <CopyRow label="CNAME" value={`${domain.hostname}  →  ${CNAME_TARGET}`} />
      </div>
    </Alert>
  );
}

function AddDomainForm({ onCancel, onDone }: { onCancel: () => void; onDone: (rec: DomainRecord) => void }) {
  const workspaceId = useWorkspaceId();
  const funnels = useAsync(() => mockApi.listFunnels(workspaceId), [workspaceId]);
  const [hostname, setHostname] = useState("");
  const [target, setTarget] = useState<string>("store");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const host = hostname.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
      setError("Enter a valid hostname, e.g. shop.example.com");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const funnel = (funnels.data ?? []).find((f) => f.id === target);
      const rec = await mockApi.addDomain(workspaceId, {
        hostname: host,
        isPrimary: false,
        target: funnel ? "funnel" : "store",
        targetLabel: funnel ? funnel.name : "Store",
      });
      onDone(rec);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField label="Hostname" required value={hostname} onChange={(e) => setHostname(e.target.value)} error={error ?? undefined} placeholder="shop.example.com" autoFocus />
      <Field label="Points to" required>
        {({ id }) => (
          <Select id={id} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="store">Store</option>
            {(funnels.data ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                Funnel · {f.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || hostname.trim() === ""}>
          {saving ? "Adding…" : "Add domain"}
        </Button>
      </div>
    </form>
  );
}
