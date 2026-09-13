import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Headphones,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  PhoneMissed,
  PhoneOff,
  Search,
  SkipForward,
  User,
} from "lucide-react";
import type { Agent, CallCenterSettings, CallOutcome, ConfirmationItem } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatMoney, humanize } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { OUTCOME_TONE, avgHandleSeconds, dueLabel, formatDuration, isDueNow, isToday } from "./shared";

type QueueFilter = "all" | "due" | "flagged" | "mine";
type MyStatus = "online" | "break" | "offline";
type CancelReason = "price" | "changed_mind" | "found_cheaper" | "ordered_by_mistake" | "other";

interface OutcomeDef {
  key: CallOutcome;
  label: string;
  shortcut: string;
  className: string;
  icon: ReactNode;
}

const OUTCOMES: OutcomeDef[] = [
  { key: "confirmed", label: "Confirmed", shortcut: "1", className: "border-success/40 bg-success-soft text-success hover:bg-success/15", icon: <CheckCircle2 className="size-4" /> },
  { key: "no_answer", label: "No answer", shortcut: "2", className: "border-accent/40 bg-accent-soft text-accent-dark hover:bg-accent/20", icon: <PhoneMissed className="size-4" /> },
  { key: "busy", label: "Busy", shortcut: "3", className: "border-accent/40 bg-accent-soft text-accent-dark hover:bg-accent/20", icon: <PhoneOff className="size-4" /> },
  { key: "postponed", label: "Postponed", shortcut: "4", className: "border-primary/30 bg-primary-soft text-primary-dark hover:bg-primary/15", icon: <Clock className="size-4" /> },
  { key: "cancelled", label: "Cancelled", shortcut: "5", className: "border-danger/30 bg-danger-soft text-danger hover:bg-danger/15", icon: <Ban className="size-4" /> },
  { key: "wrong_number", label: "Wrong number", shortcut: "6", className: "border-danger/30 bg-danger-soft text-danger hover:bg-danger/15", icon: <AlertTriangle className="size-4" /> },
  { key: "duplicate", label: "Duplicate", shortcut: "7", className: "border-line bg-paper text-ink-soft hover:bg-paper-raised", icon: <Copy className="size-4" /> },
];

const CANCEL_REASON_LABEL: Record<CancelReason, string> = {
  price: "Price too high",
  changed_mind: "Changed mind",
  found_cheaper: "Found cheaper elsewhere",
  ordered_by_mistake: "Ordered by mistake",
  other: "Other",
};

const POSTPONE_OPTIONS: Array<{ label: string; minutes: () => number }> = [
  { label: "In 1 hour", minutes: () => 60 },
  { label: "In 3 hours", minutes: () => 180 },
  {
    label: "Tomorrow 10:00",
    minutes: () => {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      t.setHours(10, 0, 0, 0);
      return Math.max(1, Math.round((t.getTime() - Date.now()) / 60000));
    },
  },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function sortQueue(items: ConfirmationItem[], now: number): ConfirmationItem[] {
  const rank = (p: ConfirmationItem["priority"]) => (p === "flagged" ? 0 : p === "high" ? 1 : 2);
  return [...items].sort((a, b) => {
    const dueA = isDueNow(a, now) ? 0 : 1;
    const dueB = isDueNow(b, now) ? 0 : 1;
    if (dueA !== dueB) return dueA - dueB;
    if (rank(a.priority) !== rank(b.priority)) return rank(a.priority) - rank(b.priority);
    const ta = a.nextAttemptAt ? new Date(a.nextAttemptAt).getTime() : new Date(a.createdAt).getTime();
    const tb = b.nextAttemptAt ? new Date(b.nextAttemptAt).getTime() : new Date(b.createdAt).getTime();
    return ta - tb;
  });
}

export function CallCenterPage() {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const storeName = currentWorkspace?.name ?? "Zimos";
  const toast = useToast();

  const queue = useAsync(() => mockApi.listConfirmationQueue(workspaceId), [workspaceId]);
  const logs = useAsync(() => mockApi.listCallLogs(workspaceId), [workspaceId]);
  const agents = useAsync(() => mockApi.listAgents(workspaceId), [workspaceId]);
  const settings = useAsync(() => mockApi.getCallCenterSettings(workspaceId), [workspaceId]);

  const me: Agent | null = agents.data?.[0] ?? null;

  const [filter, setFilter] = useState<QueueFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Tick every 30s so "due in" labels stay fresh.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const items = useMemo(() => sortQueue(queue.data ?? [], now), [queue.data, now]);
  const logRows = logs.data ?? [];

  const stats = useMemo(() => {
    const today = logRows.filter((l) => isToday(l.startedAt));
    return {
      inQueue: items.length,
      dueNow: items.filter((i) => isDueNow(i, now)).length,
      confirmedToday: today.filter((l) => l.outcome === "confirmed").length,
      noAnswerToday: today.filter((l) => l.outcome === "no_answer").length,
      avgHandle: avgHandleSeconds(today.length > 0 ? today : logRows),
    };
  }, [items, logRows, now]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (filter === "due" && !isDueNow(i, now)) return false;
      if (filter === "flagged" && i.priority !== "flagged") return false;
      if (filter === "mine" && i.assignedAgentId !== me?.id) return false;
      if (q && !i.phone.includes(q) && !(i.alternatePhone ?? "").includes(q) && !i.orderNumber.toLowerCase().includes(q) && !i.customerName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filter, search, now, me?.id]);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  const claimNext = useCallback(
    async (exclude?: string) => {
      if (!me) return;
      const next = items.find((i) => i.id !== exclude && isDueNow(i, now) && (i.assignedAgentId === null || i.assignedAgentId === me.id)) ?? items.find((i) => i.id !== exclude);
      if (!next) {
        setSelectedId(null);
        toast.success("Queue is clear — nothing due right now.");
        return;
      }
      setSelectedId(next.id);
      if (next.assignedAgentId !== me.id) {
        await mockApi.claimConfirmation(workspaceId, next.id, me.id);
        queue.setData((prev) => (prev ?? []).map((x) => (x.id === next.id ? { ...x, assignedAgentId: me.id } : x)));
      }
    },
    [items, me, now, queue, toast, workspaceId]
  );

  async function setMyStatus(status: MyStatus) {
    if (!me) return;
    try {
      await mockApi.setAgentStatus(workspaceId, me.id, status);
      agents.setData((prev) => (prev ?? []).map((a) => (a.id === me.id ? { ...a, status } : a)));
      toast.success(`You are now ${humanize(status).toLowerCase()}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleOutcome(item: ConfirmationItem, input: { outcome: CallOutcome; note: string | null; durationSeconds: number; postponeMinutes?: number }) {
    if (!me) return;
    try {
      await mockApi.recordCallOutcome(workspaceId, item.id, { agentId: me.id, agentName: me.name, ...input });
      toast.success(`${item.orderNumber} — ${humanize(input.outcome)} recorded.`);
      await Promise.all([queue.refresh({ silent: true }), logs.refresh({ silent: true })]);
      const remaining = sortQueue((queue.data ?? []).filter((x) => x.id !== item.id), Date.now());
      const next = remaining.find((i) => isDueNow(i, Date.now())) ?? null;
      setSelectedId(next?.id ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const myStatus: MyStatus = me ? (me.status === "on_call" ? "online" : me.status) : "offline";

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[640px] flex-col">
      <PageHeader
        title="Call center"
        description="Confirm cash-on-delivery orders by phone before they ship."
        actions={
          <>
            <Link to="/call-center/agents" className="text-sm text-ink-soft hover:text-primary">
              Agents
            </Link>
            <Link to="/call-center/logs" className="text-sm text-ink-soft hover:text-primary">
              Call logs
            </Link>
            <Link to="/call-center/settings" className="text-sm text-ink-soft hover:text-primary">
              Settings
            </Link>
          </>
        }
      />

      {/* Stats bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-paper-raised px-4 py-3">
        <div className="flex flex-wrap gap-6">
          <Stat label="In queue" value={stats.inQueue} />
          <Stat label="Due now" value={stats.dueNow} tone={stats.dueNow > 0 ? "text-accent-dark" : undefined} />
          <Stat label="Confirmed today" value={stats.confirmedToday} tone="text-success" />
          <Stat label="No answer today" value={stats.noAnswerToday} />
          <Stat label="Avg handle" value={formatDuration(stats.avgHandle)} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-soft">
            My status{me ? ` · ` : ""}
            {me && (
              <span className="text-ink" dir="auto">
                {me.name}
              </span>
            )}
          </span>
          <div className="inline-flex rounded-lg border border-line bg-paper p-0.5">
            {(["online", "break", "offline"] as MyStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                disabled={!me}
                onClick={() => setMyStatus(s)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  myStatus === s ? "bg-primary text-white" : "text-ink-soft hover:text-ink"
                )}
              >
                <span className={cn("size-1.5 rounded-full", s === "online" ? "bg-success" : s === "break" ? "bg-accent" : "bg-ink-soft/50", myStatus === s && "bg-white")} />
                {humanize(s)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Two-pane body */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* LEFT: queue */}
        <aside className="flex w-96 shrink-0 flex-col rounded-[var(--radius-card)] border border-line bg-paper-raised">
          <div className="space-y-2 border-b border-line p-3">
            <div className="flex gap-1 rounded-lg bg-paper p-0.5">
              {(
                [
                  ["all", "All"],
                  ["due", "Due now"],
                  ["flagged", "Flagged"],
                  ["mine", "Mine"],
                ] as Array<[QueueFilter, string]>
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={cn("flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors", filter === k ? "bg-paper-raised text-ink shadow-sm" : "text-ink-soft hover:text-ink")}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-soft" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Phone or order #" className="h-8 pl-8 text-sm" />
              </div>
              <Button size="sm" onClick={() => claimNext()} disabled={!me || items.length === 0} title="Claim the next due item">
                <SkipForward /> Next
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DataState loading={queue.loading} error={queue.error} empty={visible.length === 0} emptyMessage="No orders match this filter." onRetry={() => queue.refresh()}>
              <ul>
                {visible.map((item) => (
                  <li key={item.id}>
                    <QueueRow item={item} now={now} active={item.id === selectedId} mine={item.assignedAgentId === me?.id} onSelect={() => setSelectedId(item.id)} />
                  </li>
                ))}
              </ul>
            </DataState>
          </div>
        </aside>

        {/* RIGHT: call panel */}
        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {selected && me ? (
            <CallPanel key={selected.id} item={selected} agent={me} storeName={storeName} settings={settings.data} onOutcome={(input) => handleOutcome(selected, input)} />
          ) : (
            <EmptyState
              icon={<Headphones />}
              title={queue.loading ? "Loading queue…" : "Pick an order to start calling"}
              description="Select a row on the left or press Next to claim the next due order. Keyboard shortcuts 1–7 record the outcome."
              action={
                <Button onClick={() => claimNext()} disabled={!me || items.length === 0}>
                  <SkipForward /> Next due order
                </Button>
              }
              className="h-full"
            />
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className={cn("font-display text-xl font-medium tabular-nums text-ink", tone)}>{value}</p>
    </div>
  );
}

// -------------------------------------------------------------- Queue row --

function QueueRow({ item, now, active, mine, onSelect }: { item: ConfirmationItem; now: number; active: boolean; mine: boolean; onSelect: () => void }) {
  const due = isDueNow(item, now);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("w-full border-b border-line px-3 py-2.5 text-left transition-colors hover:bg-paper", active && "bg-primary-soft/50 hover:bg-primary-soft/50")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{item.orderNumber}</span>
        <span className="flex items-center gap-1">
          {item.priority === "flagged" && <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-medium text-danger">Flagged</span>}
          {item.priority === "high" && <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-dark">High</span>}
          {mine && <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary-dark">Mine</span>}
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-ink" dir="auto">
          {item.customerName} · {item.governorate}
        </span>
        <span className="shrink-0 tabular-nums text-ink">{formatMoney(item.totalAmount, item.currency)}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-0.5" title={`${item.attempts} attempt(s)`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={cn("size-1.5 rounded-full", i < item.attempts ? "bg-accent" : "bg-line")} />
            ))}
          </span>
          {item.lastOutcome && <StatusBadge value={item.lastOutcome} tone={OUTCOME_TONE[item.lastOutcome]} className="px-1.5 py-0 text-[10px]" />}
        </span>
        <span className={cn("text-[11px]", due ? "font-medium text-accent-dark" : "text-ink-soft")}>{dueLabel(item, now)}</span>
      </div>
    </button>
  );
}

// -------------------------------------------------------------- Call panel --

interface CallPanelProps {
  item: ConfirmationItem;
  agent: Agent;
  storeName: string;
  settings: CallCenterSettings | null;
  onOutcome: (input: { outcome: CallOutcome; note: string | null; durationSeconds: number; postponeMinutes?: number }) => Promise<void>;
}

function CallPanel({ item, agent, storeName, settings, onOutcome }: CallPanelProps) {
  const toast = useToast();
  const [calling, setCalling] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const durationRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [postponeOpen, setPostponeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(true);
  const [address, setAddress] = useState({ governorate: item.governorate, address: item.address });
  const [editingAddress, setEditingAddress] = useState(false);

  useEffect(() => {
    if (!calling) return;
    const t = window.setInterval(() => {
      if (startRef.current !== null) {
        const s = Math.round((Date.now() - startRef.current) / 1000);
        durationRef.current = s;
        setElapsed(s);
      }
    }, 500);
    return () => window.clearInterval(t);
  }, [calling]);

  function startCall() {
    startRef.current = Date.now();
    durationRef.current = 0;
    setElapsed(0);
    setCalling(true);
  }
  function hangUp() {
    setCalling(false);
  }

  const submit = useCallback(
    async (outcome: CallOutcome, extra?: { note?: string; postponeMinutes?: number }) => {
      if (busy) return;
      setBusy(true);
      setCalling(false);
      const combined = [note.trim(), extra?.note].filter((s): s is string => Boolean(s)).join(" · ");
      try {
        await onOutcome({ outcome, note: combined || null, durationSeconds: durationRef.current, postponeMinutes: extra?.postponeMinutes });
      } finally {
        setBusy(false);
      }
    },
    [busy, note, onOutcome]
  );

  const trigger = useCallback(
    (outcome: CallOutcome) => {
      if (outcome === "postponed") setPostponeOpen(true);
      else if (outcome === "cancelled") setCancelOpen(true);
      else void submit(outcome);
    },
    [submit]
  );

  // Keyboard shortcuts 1–7.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (postponeOpen || cancelOpen || busy) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const def = OUTCOMES.find((o) => o.shortcut === e.key);
      if (!def) return;
      e.preventDefault();
      trigger(def.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trigger, postponeOpen, cancelOpen, busy]);

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(item.phone);
      toast.success("Phone number copied.");
    } catch {
      toast.error("Could not copy — clipboard blocked.");
    }
  }

  const voipConnected = settings !== null && settings.voipProvider !== "none";
  const firstName = item.customerName.split(" ")[0] ?? item.customerName;
  const totalMajor = (item.totalAmount / 100).toLocaleString("en-EG", { maximumFractionDigits: 0 });
  const script = `أهلاً ${firstName}، معاك ${storeName} بخصوص طلبك رقم ${item.orderNumber} بقيمة ${totalMajor} جنيه، هيتوصل خلال 2-3 أيام، نأكد الطلب؟`;

  const reliability = item.customerHistory.reliabilityScore;
  const reliabilityColor = reliability >= 75 ? "bg-success" : reliability >= 50 ? "bg-accent" : "bg-danger";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-medium text-ink" dir="auto">
                {item.customerName}
              </h2>
              <span className="text-sm text-ink-soft">{item.orderNumber}</span>
              {item.priority !== "normal" && <StatusBadge value={item.priority} tone={item.priority === "flagged" ? "danger" : "warning"} />}
              {item.assignedAgentId === agent.id && <StatusBadge value="assigned to you" tone="info" />}
            </div>
            <p className="mt-2 font-mono text-3xl font-medium tracking-wide text-ink">{item.phone}</p>
            {item.alternatePhone && (
              <p className="mt-0.5 text-sm text-ink-soft">
                Alt: <span className="font-mono">{item.alternatePhone}</span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {calling ? (
                <Button variant="danger" onClick={hangUp}>
                  <PhoneOff /> Hang up
                </Button>
              ) : (
                <Button onClick={startCall} disabled={busy}>
                  <Phone /> Call
                </Button>
              )}
              <Button variant="outline" onClick={() => window.open(`https://wa.me/2${item.phone}`, "_blank", "noopener")}>
                <MessageCircle /> WhatsApp
              </Button>
              <Button variant="ghost" onClick={copyPhone}>
                <Copy /> Copy
              </Button>
              {!voipConnected && (
                <a href={`tel:+2${item.phone}`} className="text-sm text-primary underline-offset-4 hover:underline">
                  Open dialer
                </a>
              )}
            </div>
          </div>
          <div className={cn("rounded-lg border px-4 py-3 text-center", calling ? "border-success/40 bg-success-soft" : "border-line bg-paper")}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">{calling ? "On call" : "Call timer"}</p>
            <p className={cn("font-mono text-3xl tabular-nums", calling ? "text-success" : "text-ink")}>{formatDuration(elapsed)}</p>
            {calling && <span className="mx-auto mt-1 block size-2 animate-pulse rounded-full bg-success" />}
          </div>
        </div>
        {!voipConnected && (
          <Alert variant="info" className="mt-4 border-accent/40 bg-accent-soft/40 text-sm">
            <AlertTriangle />
            <span>
              VoIP not connected — the timer is simulated. Configure a provider in{" "}
              <Link to="/call-center/settings" className="font-medium text-primary underline-offset-4 hover:underline">
                Settings
              </Link>{" "}
              or use “Open dialer”.
            </span>
          </Alert>
        )}
        {item.riskFlags.length > 0 && (
          <Alert variant="danger" className="mt-3 text-sm">
            <AlertTriangle />
            <span>Risk flags: {item.riskFlags.map((f) => humanize(f)).join(", ")}. Verify before confirming.</span>
          </Alert>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Order card */}
        <Card title="Order" icon={<Package />}>
          <ul className="divide-y divide-line">
            {item.items.map((line, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-ink" dir="auto">
                  {line.productName}
                  {line.variant && <span className="text-ink-soft"> · {line.variant}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-ink-soft">
                  {line.quantity} × {formatMoney(line.unitPriceAmount, item.currency)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-1 border-t border-line pt-2 text-sm">
            <Row label="Shipping" value={formatMoney(item.shippingAmount, item.currency)} />
            <Row label="Total (COD)" value={<span className="font-medium text-ink">{formatMoney(item.totalAmount, item.currency)}</span>} />
            <Row label="Source" value={<span dir="auto">{item.source}</span>} />
            <Row label="Created" value={formatDateTime(item.createdAt)} />
            <Row label="Attempts" value={`${item.attempts}${settings ? ` / ${settings.maxAttempts}` : ""}`} />
          </dl>
        </Card>

        {/* Address card */}
        <Card
          title="Delivery address"
          icon={<MapPin />}
          action={
            !editingAddress && (
              <Button size="xs" variant="ghost" onClick={() => setEditingAddress(true)}>
                Edit address
              </Button>
            )
          }
        >
          {editingAddress ? (
            <AddressForm
              initial={address}
              onCancel={() => setEditingAddress(false)}
              onSave={(next) => {
                setAddress(next);
                setEditingAddress(false);
                toast.success("Address updated for this order.");
              }}
            />
          ) : (
            <div className="text-sm">
              <p className="font-medium text-ink" dir="auto">
                {address.governorate}
              </p>
              <p className="mt-1 text-ink-soft" dir="auto">
                {address.address}
              </p>
            </div>
          )}
        </Card>

        {/* Customer history */}
        <Card title="Customer history" icon={<User />}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini label="Orders" value={item.customerHistory.totalOrders} />
            <Mini label="Delivered" value={item.customerHistory.delivered} tone="text-success" />
            <Mini label="Returned" value={item.customerHistory.returned} tone={item.customerHistory.returned > 0 ? "text-danger" : undefined} />
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-soft">Reliability</span>
              <span className="font-medium tabular-nums text-ink">{reliability}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line/60">
              <div className={cn("h-full rounded-full", reliabilityColor)} style={{ width: `${reliability}%` }} />
            </div>
          </div>
          {item.riskFlags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {item.riskFlags.map((f) => (
                <span key={f} className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">
                  {humanize(f)}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-soft">No risk flags.</p>
          )}
        </Card>

        {/* Script */}
        <Card
          title="Suggested script"
          icon={<Headphones />}
          action={
            <button type="button" onClick={() => setScriptOpen((v) => !v)} className="text-ink-soft hover:text-ink" aria-label={scriptOpen ? "Collapse" : "Expand"}>
              {scriptOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          }
        >
          {scriptOpen ? (
            <p className="rounded-lg bg-paper p-3 text-sm leading-relaxed text-ink" dir="rtl">
              {script}
            </p>
          ) : (
            <p className="text-xs text-ink-soft">Collapsed.</p>
          )}
        </Card>
      </div>

      {/* Outcomes */}
      <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Outcome</p>
          <p className="text-xs text-ink-soft">Press the number key to record</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {OUTCOMES.map((o) => (
            <button
              key={o.key}
              type="button"
              disabled={busy}
              onClick={() => trigger(o.key)}
              className={cn("flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-sm font-medium transition-colors disabled:opacity-50", o.className)}
            >
              {o.icon}
              <span>{o.label}</span>
              <kbd className="rounded border border-current/30 px-1.5 text-[10px] opacity-70">{o.shortcut}</kbd>
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Label htmlFor="cc-note" className="text-xs text-ink-soft">
            Note
          </Label>
          <Textarea id="cc-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} dir="auto" placeholder="العميل طلب التوصيل بعد 6 مساءً…" className="mt-1" />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => submit("no_answer", { note: "whatsapp sent" })}>
            <MessageCircle /> Send WhatsApp confirmation instead
          </Button>
          <span className="text-xs text-ink-soft">Auto-advances to the next due order after saving.</span>
        </div>
      </div>

      {/* Postpone chooser */}
      <Modal open={postponeOpen} onClose={() => setPostponeOpen(false)} title="Postpone — call back when?">
        <div className="grid gap-2 sm:grid-cols-3">
          {POSTPONE_OPTIONS.map((opt) => (
            <Button
              key={opt.label}
              variant="outline"
              onClick={() => {
                setPostponeOpen(false);
                void submit("postponed", { postponeMinutes: opt.minutes() });
              }}
            >
              <Clock /> {opt.label}
            </Button>
          ))}
        </div>
      </Modal>

      {/* Cancel reason */}
      <CancelDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={(reason, downsell) => {
          setCancelOpen(false);
          if (downsell) void submit("confirmed", { note: `downsell applied (15% off) · reason: ${CANCEL_REASON_LABEL[reason]}` });
          else void submit("cancelled", { note: `reason: ${CANCEL_REASON_LABEL[reason]}` });
        }}
      />
    </div>
  );
}

function CancelDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (reason: CancelReason, downsell: boolean) => void }) {
  const [reason, setReason] = useState<CancelReason>("price");
  const [downsell, setDownsell] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancel order"
      description="Record why the customer is cancelling. Offering a small discount often saves the order."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button variant={downsell ? "primary" : "danger"} onClick={() => onConfirm(reason, downsell)}>
            {downsell ? "Confirm with 15% off" : "Cancel order"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Reason">
          {({ id }) => (
            <Select id={id} value={reason} onChange={(e) => setReason(e.target.value as CancelReason)}>
              {(Object.keys(CANCEL_REASON_LABEL) as CancelReason[]).map((k) => (
                <option key={k} value={k}>
                  {CANCEL_REASON_LABEL[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Toggle checked={downsell} onChange={setDownsell} label="Offer downsell 15%?" description="Keeps the order confirmed with a 15% discount instead of cancelling." />
      </div>
    </Modal>
  );
}

function AddressForm({ initial, onSave, onCancel }: { initial: { governorate: string; address: string }; onSave: (v: { governorate: string; address: string }) => void; onCancel: () => void }) {
  const [gov, setGov] = useState(initial.governorate);
  const [addr, setAddr] = useState(initial.address);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ governorate: gov.trim() || initial.governorate, address: addr.trim() || initial.address });
      }}
    >
      <Field label="Governorate">{({ id }) => <Input id={id} value={gov} onChange={(e) => setGov(e.target.value)} dir="auto" className="h-9" />}</Field>
      <Field label="Address">{({ id }) => <Textarea id={id} value={addr} onChange={(e) => setAddr(e.target.value)} rows={2} dir="auto" />}</Field>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>
    </form>
  );
}

function Card({ title, icon, action, children }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink [&>svg]:size-4 [&>svg]:text-ink-soft">
          {icon}
          {title}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-paper p-2">
      <p className={cn("font-display text-lg font-medium tabular-nums text-ink", tone)}>{value}</p>
      <p className="text-[11px] text-ink-soft">{label}</p>
    </div>
  );
}
