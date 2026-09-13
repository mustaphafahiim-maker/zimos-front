import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Eye, Layers, MousePointerClick, Pause, Pencil, Play, Plus, ShoppingBag, Trash2, Wallet } from "lucide-react";
import { Button, Input, Label, cn } from "@store-builder/ui";
import type { Funnel, FunnelStatus } from "@/mock/types";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { KpiCard } from "@/components/KpiCard";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";

const STATUS_TONE: Record<FunnelStatus, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  paused: "warning",
};

interface StartTemplate {
  id: string | null;
  name: string;
  description: string;
}

const START_TEMPLATES: StartTemplate[] = [
  { id: null, name: "Blank", description: "Landing → checkout → thank you. Build the rest yourself." },
  { id: "tpl-cod-single", name: "COD single product", description: "One product, cash on delivery, phone-first checkout." },
  { id: "tpl-upsell-downsell", name: "Upsell + downsell", description: "Post-purchase offer with a fallback if declined." },
  { id: "tpl-lead-magnet", name: "Lead magnet", description: "Collect a phone number first, sell on the thank-you page." },
];

function conversionPercent(f: Funnel): number {
  return f.visits > 0 ? (f.orders / f.visits) * 100 : 0;
}

function shareLink(f: Funnel): string {
  return `https://${f.slug}.zimos.test`;
}

export function FunnelsPage() {
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();
  const list = useAsync(() => mockApi.listFunnels(workspaceId), [workspaceId]);

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Funnel | null>(null);

  const funnels = list.data ?? [];
  const reload = () => list.refresh({ silent: true });

  const kpis = useMemo(() => {
    const visits = funnels.reduce((a, f) => a + f.visits, 0);
    const orders = funnels.reduce((a, f) => a + f.orders, 0);
    const revenue = funnels.reduce((a, f) => a + Number(f.revenueAmount), 0);
    const withTraffic = funnels.filter((f) => f.visits > 0);
    const avgConversion = withTraffic.length > 0 ? withTraffic.reduce((a, f) => a + conversionPercent(f), 0) / withTraffic.length : 0;
    return { visits, orders, revenue, avgConversion, currency: funnels[0]?.currency ?? "EGP" };
  }, [funnels]);

  async function setStatus(f: Funnel, status: FunnelStatus) {
    try {
      await mockApi.setFunnelStatus(workspaceId, f.id, status);
      toast.success(status === "published" ? `"${f.name}" is live.` : status === "paused" ? `"${f.name}" paused.` : `"${f.name}" resumed.`);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function duplicate(f: Funnel) {
    try {
      const copy = await mockApi.duplicateFunnel(workspaceId, f.id);
      toast.success(copy ? `Duplicated as "${copy.name}".` : "Funnel duplicated.");
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function copyLink(f: Funnel) {
    const url = shareLink(f);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Copied ${url}`);
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    await mockApi.deleteFunnel(workspaceId, deleting.id);
    toast.success(`"${deleting.name}" deleted.`);
    setDeleting(null);
    reload();
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Funnels"
        description="Single-product sales flows with order bumps, upsells and downsells."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> Create funnel
          </Button>
        }
      />

      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total visits" value={kpis.visits.toLocaleString()} icon={<Eye />} hint="All funnels, all time" />
          <KpiCard label="Orders" value={kpis.orders.toLocaleString()} icon={<ShoppingBag />} hint="Completed checkouts" />
          <KpiCard label="Revenue" value={formatMoney(kpis.revenue, kpis.currency)} icon={<Wallet />} hint="Including offers" />
          <KpiCard label="Avg. conversion" value={`${kpis.avgConversion.toFixed(1)}%`} icon={<MousePointerClick />} hint="Visits → orders, funnels with traffic" />
        </div>

        {funnels.length === 0 ? (
          <EmptyState
            icon={<Layers />}
            title="No funnels yet"
            description="Create a funnel to sell a single product with a focused landing page and one-click offers."
            action={<Button onClick={() => setCreating(true)}>Create funnel</Button>}
          />
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Funnel</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Steps</th>
                  <th className="px-4 py-3 text-right font-medium">Visits</th>
                  <th className="px-4 py-3 text-right font-medium">Orders</th>
                  <th className="px-4 py-3 text-right font-medium">Conv.</th>
                  <th className="px-4 py-3 text-right font-medium">Revenue</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {funnels.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => navigate(`/funnels/${f.id}`)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-paper-raised"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{f.name}</p>
                      <p className="text-xs text-ink-soft">{f.slug}.zimos.test</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={f.status} tone={STATUS_TONE[f.status]} />
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{f.steps.length}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{f.visits.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{f.orders.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{conversionPercent(f).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{formatMoney(f.revenueAmount, f.currency)}</td>
                    <td className="px-4 py-3 text-ink-soft">{formatDate(f.updatedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button size="icon-sm" variant="ghost" title="Edit" aria-label="Edit" onClick={() => navigate(`/funnels/${f.id}`)}>
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        {f.status === "published" ? (
                          <Button size="icon-sm" variant="ghost" title="Pause" aria-label="Pause" onClick={() => void setStatus(f, "paused")}>
                            <Pause className="size-4" aria-hidden />
                          </Button>
                        ) : (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title={f.status === "paused" ? "Resume" : "Publish"}
                            aria-label={f.status === "paused" ? "Resume" : "Publish"}
                            onClick={() => void setStatus(f, "published")}
                          >
                            <Play className="size-4" aria-hidden />
                          </Button>
                        )}
                        <Button size="icon-sm" variant="ghost" title="Duplicate" aria-label="Duplicate" onClick={() => void duplicate(f)}>
                          <Copy className="size-4" aria-hidden />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void copyLink(f)}>
                          Copy share link
                        </Button>
                        <Button size="icon-sm" variant="ghost" className="text-danger hover:bg-danger-soft" title="Delete" aria-label="Delete" onClick={() => setDeleting(f)}>
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataState>

      <Modal open={creating} onClose={() => setCreating(false)} title="Create funnel" description="Pick a name and a starting point. You can change everything in the editor.">
        {creating && <CreateFunnelForm onCancel={() => setCreating(false)} onCreated={(f) => navigate(`/funnels/${f.id}`)} />}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete "${deleting.name}"?` : "Delete funnel?"}
        description="The funnel, its steps and its share link stop working immediately. Orders already placed are kept."
        confirmLabel="Delete funnel"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function CreateFunnelForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (f: Funnel) => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the funnel a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const funnel = await mockApi.createFunnel(workspaceId, { name: name.trim(), templateId });
      toast.success(`"${funnel.name}" created.`);
      onCreated(funnel);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="funnel-name">Name</Label>
        <Input id="funnel-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="عرض السماعة Pro — رمضان" autoFocus />
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
      </div>

      <div className="space-y-2">
        <Label>Start from</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {START_TEMPLATES.map((t) => {
            const active = t.id === templateId;
            return (
              <label
                key={t.name}
                className={cn(
                  "cursor-pointer rounded-[var(--radius-card)] border p-3 transition-colors",
                  active ? "border-primary bg-primary-soft ring-1 ring-primary/30" : "border-line hover:border-primary/50"
                )}
              >
                <input type="radio" name="funnel-template" className="sr-only" checked={active} onChange={() => setTemplateId(t.id)} />
                <p className={cn("text-sm font-medium", active ? "text-primary-dark" : "text-ink")}>{t.name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{t.description}</p>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Creating…" : "Create and open editor"}
        </Button>
      </div>
    </form>
  );
}
