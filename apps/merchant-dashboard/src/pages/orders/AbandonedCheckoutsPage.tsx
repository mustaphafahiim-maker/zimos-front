import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Workflow } from "lucide-react";
import { Button, Textarea } from "@store-builder/ui";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime, formatMoney } from "@/lib/format";
import { mockApi } from "@/mock/api";
import type { AbandonedCheckout } from "@/mock/types";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";

type RecoveryStatus = AbandonedCheckout["recoveryStatus"];
type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const STATUS_TONE: Record<RecoveryStatus, Tone> = {
  not_contacted: "warning",
  contacted: "info",
  recovered: "success",
  lost: "neutral",
};

const STEP_TONE: Record<AbandonedCheckout["step"], Tone> = {
  contact: "neutral",
  shipping: "info",
  payment: "warning",
};

const STATUSES: RecoveryStatus[] = ["not_contacted", "contacted", "recovered", "lost"];

function itemsSummary(items: AbandonedCheckout["items"]): string {
  if (items.length === 0) return "—";
  const first = items[0];
  const rest = items.length - 1;
  return `${first.quantity} × ${first.productName}${rest > 0 ? ` +${rest} more` : ""}`;
}

function buildMessage(c: AbandonedCheckout): string {
  const name = c.customerName ? c.customerName.split(" ")[0] : "عميلنا العزيز";
  const link = `https://shop.egystore.com/cart/${c.id.slice(0, 8)}`;
  return `أهلاً ${name} 👋\nلاحظنا إنك سيبت ${itemsSummary(c.items)} في السلة بقيمة ${formatMoney(c.totalAmount, c.currency)}.\nكمّل طلبك دلوقتي من هنا: ${link}\nولو عندك أي سؤال ردّ على الرسالة دي وهنساعدك فوراً.`;
}

export function AbandonedCheckoutsPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [status, setStatus] = useState<RecoveryStatus | "">("");
  const [target, setTarget] = useState<AbandonedCheckout | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useAsync(() => mockApi.listAbandoned(workspaceId), [workspaceId]);
  const rows = list.data ?? [];
  const currency = rows[0]?.currency ?? "EGP";

  const kpis = useMemo(() => {
    const open = rows.filter((r) => r.recoveryStatus === "not_contacted" || r.recoveryStatus === "contacted");
    const recovered = rows.filter((r) => r.recoveryStatus === "recovered");
    const closed = rows.filter((r) => r.recoveryStatus === "recovered" || r.recoveryStatus === "lost");
    return {
      recoverable: open.reduce((a, r) => a + Number(r.totalAmount), 0),
      recoveredValue: recovered.reduce((a, r) => a + Number(r.totalAmount), 0),
      recoveredCount: recovered.length,
      rateBp: closed.length > 0 ? Math.round((recovered.length / closed.length) * 10000) : 0,
    };
  }, [rows]);

  const visible = useMemo(() => (status ? rows.filter((r) => r.recoveryStatus === status) : rows), [rows, status]);

  function openWhatsApp(c: AbandonedCheckout) {
    setTarget(c);
    setMessage(buildMessage(c));
  }

  async function updateStatus(c: AbandonedCheckout, next: RecoveryStatus, successText: string) {
    setBusyId(c.id);
    try {
      await mockApi.setAbandonedStatus(workspaceId, c.id, next);
      list.setData((prev) => (prev ?? []).map((r) => (r.id === c.id ? { ...r, recoveryStatus: next } : r)));
      toast.success(successText);
    } catch {
      toast.error("Couldn't update this checkout. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function sendWhatsApp() {
    if (!target) return;
    setSending(true);
    try {
      await mockApi.setAbandonedStatus(workspaceId, target.id, "contacted");
      list.setData((prev) => (prev ?? []).map((r) => (r.id === target.id ? { ...r, recoveryStatus: "contacted" } : r)));
      toast.success(`WhatsApp message sent to ${target.phone ?? "customer"}.`);
      setTarget(null);
    } catch {
      toast.error("Couldn't send the message. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Abandoned checkouts"
        description="Customers who started checkout but didn't place an order. Reach out to bring them back."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/automations">
              <Workflow />
              Automate recovery
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Recoverable value" value={formatMoney(kpis.recoverable, currency)} hint="Open checkouts not yet recovered or lost" />
        <KpiCard label="Recovered" value={formatMoney(kpis.recoveredValue, currency)} hint={`${kpis.recoveredCount} checkout${kpis.recoveredCount === 1 ? "" : "s"} turned into orders`} />
        <KpiCard label="Recovery rate" value={`${(kpis.rateBp / 100).toFixed(1)}%`} hint="Recovered ÷ (recovered + lost)" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value as RecoveryStatus | "")} className="sm:w-56">
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "not_contacted" ? "Not contacted" : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Select>
        <p className="text-xs text-ink-soft">
          Tip: a WhatsApp reminder 30 minutes after abandonment recovers the most carts.{" "}
          <Link to="/automations" className="text-primary hover:underline">
            Set up an automation
          </Link>
          .
        </p>
      </div>

      <DataState loading={list.loading} error={list.error} empty={visible.length === 0} emptyMessage="No abandoned checkouts match this filter." onRetry={() => list.refresh()}>
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Step reached</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Recovery</th>
                <th className="px-4 py-3 font-medium">Last activity</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const busy = busyId === c.id;
                const closed = c.recoveryStatus === "recovered" || c.recoveryStatus === "lost";
                return (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-paper-raised">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{c.customerName ?? "Anonymous"}</p>
                      <p className="text-xs text-ink-soft">{c.phone ?? c.email ?? "No contact details"}</p>
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-ink-soft">{itemsSummary(c.items)}</td>
                    <td className="px-4 py-3 tabular-nums text-ink">{formatMoney(c.totalAmount, c.currency)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={c.step} tone={STEP_TONE[c.step]} />
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      <span className="block">{c.sourceLabel}</span>
                      <span className="block text-xs">{c.source === "funnel" ? "Funnel" : "Store"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={c.recoveryStatus} tone={STATUS_TONE[c.recoveryStatus]} />
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{formatDateTime(c.lastActivityAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="xs" variant="outline" disabled={busy || closed || !c.phone} onClick={() => openWhatsApp(c)} title={c.phone ? "Send WhatsApp" : "No phone number"}>
                          <MessageCircle />
                          WhatsApp
                        </Button>
                        <Button size="xs" variant="ghost" disabled={busy || c.recoveryStatus === "recovered"} onClick={() => updateStatus(c, "recovered", "Marked as recovered.")}>
                          Recovered
                        </Button>
                        <Button size="xs" variant="ghost" disabled={busy || c.recoveryStatus === "lost"} onClick={() => updateStatus(c, "lost", "Marked as lost.")}>
                          Lost
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataState>

      <Modal
        open={target !== null}
        onClose={() => (sending ? undefined : setTarget(null))}
        title="Send WhatsApp reminder"
        description={target ? `To ${target.customerName ?? "customer"} · ${target.phone ?? ""}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={sendWhatsApp} disabled={sending || message.trim() === ""}>
              {sending ? "Sending…" : "Send message"}
            </Button>
          </>
        }
      >
        <p className="mb-2 text-xs text-ink-soft">Edit the message before sending. The cart link restores the customer's items.</p>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} dir="rtl" className="text-sm" />
      </Modal>
    </div>
  );
}
