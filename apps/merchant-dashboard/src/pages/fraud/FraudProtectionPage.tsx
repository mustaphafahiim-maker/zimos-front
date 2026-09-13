import { useMemo, useState, type FormEvent } from "react";
import { Alert, Button, Input, Label, Tabs, TabsList, TabsTrigger, cn } from "@store-builder/ui";
import { Ban, Check, Flag, Info, Phone, ShieldAlert, ShieldCheck, Trash2, Truck } from "lucide-react";
import type { BlockedEntry, FlaggedOrder, FraudRule, FraudRuleKey, FraudSettings } from "@/mock/types";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

type TabKey = "rules" | "flagged" | "blocklist";
type FlagFilter = "all" | FlaggedOrder["status"];

const SHIPPING_COST_MINOR = 4500; // 45 EGP average failed-delivery cost

const RULE_SHORT: Record<FraudRuleKey, string> = {
  block_blacklisted_phone: "Blacklisted phone",
  duplicate_order_window: "Duplicate order",
  max_orders_per_phone_per_day: "Too many orders",
  block_invalid_phone_format: "Invalid phone",
  high_rejection_customer: "High rejection rate",
  require_otp_high_value: "OTP required",
  block_ip_country_mismatch: "IP mismatch",
};

const FLAG_TONE: Record<FlaggedOrder["status"], "warning" | "success" | "danger"> = {
  flagged: "warning",
  approved: "success",
  blocked: "danger",
};

const ENTRY_TYPE_TONE: Record<BlockedEntry["type"], string> = {
  phone: "bg-primary-soft text-primary-dark",
  ip: "bg-accent-soft text-accent-dark",
  email: "bg-success-soft text-success",
};

const EG_PHONE = /^01[0125]\d{8}$/;

export function FraudProtectionPage() {
  const workspaceId = useWorkspaceId();
  const settings = useAsync(() => mockApi.getFraudSettings(workspaceId), [workspaceId]);
  const flagged = useAsync(() => mockApi.listFlagged(workspaceId), [workspaceId]);
  const blocked = useAsync(() => mockApi.listBlocked(workspaceId), [workspaceId]);

  const [tab, setTab] = useState<TabKey>("rules");

  const awaiting = (flagged.data ?? []).filter((f) => f.status === "flagged").length;
  const blockedToday = settings.data?.blockedToday ?? 0;
  const blockedMonth = settings.data?.blockedThisMonth ?? 0;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Fraud protection"
        description="Fake order blocker — stop COD orders that will never be delivered before they cost you shipping."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Blocked today" value={blockedToday} hint="Orders rejected by rules" icon={<Ban />} />
        <KpiCard label="Blocked this month" value={blockedMonth.toLocaleString()} hint="Month to date" icon={<ShieldCheck />} />
        <KpiCard label="Awaiting review" value={awaiting} hint="Flagged orders needing a decision" icon={<Flag />} />
        <KpiCard label="Est. shipping saved" value={formatMoney((blockedMonth + awaiting) * SHIPPING_COST_MINOR)} hint="~45 EGP per avoided failed delivery" icon={<Truck />} />
      </div>

      <Alert variant="info" className="mb-6 border-primary/30 bg-primary-soft/40">
        <Info />
        <div>
          <p className="font-medium text-ink">Egyptian phone validation</p>
          <p className="text-sm text-ink-soft">
            A valid Egyptian mobile number is 11 digits and starts with <span className="font-mono">010</span>, <span className="font-mono">011</span>, <span className="font-mono">012</span> or{" "}
            <span className="font-mono">015</span> (Vodafone, Etisalat, Orange, WE). Anything else — wrong length, landlines, repeated digits like 01000000000 — is rejected at checkout when the
            “Invalid phone” rule is on.
          </p>
        </div>
      </Alert>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v) as TabKey)} className="mb-4">
        <TabsList variant="line">
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="flagged">
            Flagged orders
            {awaiting > 0 && <span className="ml-1 rounded-full bg-accent-soft px-1.5 text-[10px] text-accent-dark">{awaiting}</span>}
          </TabsTrigger>
          <TabsTrigger value="blocklist">Blocklist</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "rules" && (
        <DataState loading={settings.loading} error={settings.error} onRetry={() => settings.refresh()}>
          {settings.data && <RulesTab key={settings.data.workspaceId} initial={settings.data} onSaved={(s) => settings.setData(s)} />}
        </DataState>
      )}
      {tab === "flagged" && <FlaggedTab state={flagged} />}
      {tab === "blocklist" && <BlocklistTab state={blocked} />}
    </div>
  );
}

// ----------------------------------------------------------------- Rules --

function RulesTab({ initial, onSaved }: { initial: FraudSettings; onSaved: (s: FraudSettings) => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [rules, setRules] = useState<FraudRule[]>(initial.rules);
  const [action, setAction] = useState<FraudSettings["action"]>(initial.action);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(() => JSON.stringify(rules) !== JSON.stringify(initial.rules) || action !== initial.action, [rules, action, initial]);

  function update(key: FraudRuleKey, patch: Partial<FraudRule>) {
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function save() {
    setSaving(true);
    try {
      const next: FraudSettings = { ...initial, rules, action };
      await mockApi.saveFraudSettings(workspaceId, next);
      onSaved(next);
      toast.success("Fraud settings saved.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="rounded-[var(--radius-card)] border border-line">
        {rules.map((r) => (
          <div key={r.key} className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink" dir="auto">
                {r.label}
              </p>
              <p className="mt-0.5 text-xs text-ink-soft" dir="auto">
                {r.description}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {r.valueLabel && (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    value={r.value ?? ""}
                    disabled={!r.enabled}
                    onChange={(e) => update(r.key, { value: e.target.value === "" ? null : Number(e.target.value) })}
                    className="h-8 w-20 px-2 text-sm"
                    aria-label={`${r.label} value`}
                  />
                  <span className="text-xs text-ink-soft" dir="auto">
                    {r.valueLabel}
                  </span>
                </div>
              )}
              <Toggle checked={r.enabled} onChange={(next) => update(r.key, { enabled: next })} />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
          <p className="text-sm font-medium text-ink">When a rule matches</p>
          <p className="mt-0.5 text-xs text-ink-soft">Blacklisted phones are always blocked regardless of this setting.</p>
          <div className="mt-3 space-y-2">
            <label className={cn("flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors", action === "flag_for_review" ? "border-primary bg-primary-soft/40" : "border-line")}>
              <input type="radio" name="fraud-action" checked={action === "flag_for_review"} onChange={() => setAction("flag_for_review")} className="mt-0.5" />
              <div>
                <p className="flex items-center gap-1 text-sm font-medium text-ink">
                  <Flag className="size-3.5" /> Flag for review
                </p>
                <p className="text-xs text-ink-soft">Order is accepted but held in the Flagged queue until an agent approves it.</p>
              </div>
            </label>
            <label className={cn("flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors", action === "block" ? "border-danger bg-danger-soft/40" : "border-line")}>
              <input type="radio" name="fraud-action" checked={action === "block"} onChange={() => setAction("block")} className="mt-0.5" />
              <div>
                <p className="flex items-center gap-1 text-sm font-medium text-ink">
                  <ShieldAlert className="size-3.5" /> Block immediately
                </p>
                <p className="text-xs text-ink-soft">Checkout shows an error and the order is never created.</p>
              </div>
            </label>
          </div>
        </div>
        <Button className="w-full" onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save rules"}
        </Button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- Flagged --

function FlaggedTab({ state }: { state: ReturnType<typeof useAsync<FlaggedOrder[]>> }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [filter, setFilter] = useState<FlagFilter>("flagged");
  const [busy, setBusy] = useState<string | null>(null);

  const rows = (state.data ?? []).filter((f) => filter === "all" || f.status === filter);

  async function resolve(f: FlaggedOrder, status: "approved" | "blocked") {
    setBusy(f.id);
    try {
      await mockApi.resolveFlagged(workspaceId, f.id, status);
      state.setData((prev) => (prev ?? []).map((x) => (x.id === f.id ? { ...x, status } : x)));
      toast.success(status === "approved" ? `${f.orderNumber} approved — sent to confirmation.` : `${f.orderNumber} blocked.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-ink-soft">Status</Label>
        <Select value={filter} onChange={(e) => setFilter(e.target.value as FlagFilter)} className="h-8 w-44 py-1">
          <option value="flagged">Awaiting review</option>
          <option value="approved">Approved</option>
          <option value="blocked">Blocked</option>
          <option value="all">All</option>
        </Select>
      </div>
      <DataState loading={state.loading} error={state.error} empty={rows.length === 0} emptyMessage="Nothing to review — all clear." onRetry={() => state.refresh()}>
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Triggered rules</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Flagged</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const validPhone = EG_PHONE.test(f.phone);
                return (
                  <tr key={f.id} className="border-b border-line last:border-0 hover:bg-paper-raised">
                    <td className="px-4 py-3 font-medium text-ink">{f.orderNumber}</td>
                    <td className="px-4 py-3 text-ink" dir="auto">
                      {f.customerName}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 font-mono text-xs", validPhone ? "text-ink-soft" : "text-danger")} title={validPhone ? undefined : "Not a valid Egyptian mobile number"}>
                        <Phone className="size-3" /> {f.phone}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink">{formatMoney(f.totalAmount, f.currency)}</td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[240px] flex-wrap gap-1">
                        {f.triggeredRules.map((r) => (
                          <span key={r} className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-dark">
                            {RULE_SHORT[r]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={f.status} tone={FLAG_TONE[f.status]} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-soft">{formatDateTime(f.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {f.status === "flagged" ? (
                        <>
                          <Button size="sm" variant="ghost" className="text-success" disabled={busy === f.id} onClick={() => resolve(f, "approved")}>
                            <Check /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" disabled={busy === f.id} onClick={() => resolve(f, "blocked")}>
                            <Ban /> Block
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-ink-soft">Resolved</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataState>
    </div>
  );
}

// ------------------------------------------------------------- Blocklist --

function BlocklistTab({ state }: { state: ReturnType<typeof useAsync<BlockedEntry[]>> }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<BlockedEntry | null>(null);

  const entries = state.data ?? [];

  async function confirmRemove() {
    if (!removing) return;
    await mockApi.removeBlocked(workspaceId, removing.id);
    toast.success("Removed from blocklist.");
    setRemoving(null);
    state.refresh({ silent: true });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">{entries.length} entries · matched orders are blocked before checkout completes.</p>
        <Button size="sm" onClick={() => setAdding(true)}>
          Add to blocklist
        </Button>
      </div>
      <DataState loading={state.loading} error={state.error} empty={entries.length === 0} emptyMessage="Blocklist is empty." onRetry={() => state.refresh()}>
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Hits</th>
                <th className="px-4 py-3 font-medium">Added</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0 hover:bg-paper-raised">
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium uppercase", ENTRY_TYPE_TONE[e.type])}>{e.type}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink">{e.value}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-ink-soft" dir="auto">
                    {e.reason || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={e.source} tone={e.source === "rule" ? "info" : "neutral"} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-soft">{e.hits}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-soft">{formatDate(e.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button size="icon-sm" variant="ghost" aria-label="Remove" className="text-danger hover:bg-danger-soft" onClick={() => setRemoving(e)}>
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add to blocklist">
        {adding && (
          <BlockForm
            onCancel={() => setAdding(false)}
            onDone={() => {
              setAdding(false);
              state.refresh({ silent: true });
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title={removing ? `Unblock ${removing.value}?` : "Remove entry?"}
        description="Orders from this value will be accepted again."
        confirmLabel="Remove"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

function BlockForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [type, setType] = useState<BlockedEntry["type"]>("phone");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    const v = value.trim();
    if (!v) return "Enter a value to block.";
    if (type === "phone" && !EG_PHONE.test(v)) return "Enter an 11-digit Egyptian number starting with 010, 011, 012 or 015.";
    if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address.";
    if (type === "ip" && !/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(v)) return "Enter an IPv4 address or CIDR range, e.g. 197.54.12.0/24.";
    return null;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err = validate();
    setError(err);
    if (err) return;
    setSaving(true);
    try {
      await mockApi.addBlocked(workspaceId, { type, value: value.trim(), reason: reason.trim(), source: "manual" });
      toast.success("Added to blocklist.");
      onDone();
    } catch (err2) {
      setError(getErrorMessage(err2));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Type">
        {({ id }) => (
          <Select id={id} value={type} onChange={(e) => setType(e.target.value as BlockedEntry["type"])}>
            <option value="phone">Phone number</option>
            <option value="ip">IP address / range</option>
            <option value="email">Email</option>
          </Select>
        )}
      </Field>
      <TextField
        label="Value"
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={error ?? undefined}
        placeholder={type === "phone" ? "01012345678" : type === "ip" ? "197.54.12.0/24" : "spam@example.com"}
        className="font-mono"
        autoFocus
      />
      <Field label="Reason" hint="Shown to your team next to blocked orders.">
        {({ id }) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} dir="auto" placeholder="طلبات وهمية من صفحة الإعلان" />}
      </Field>
      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Adding…" : "Block"}
        </Button>
      </div>
    </form>
  );
}
