import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Input, cn } from "@store-builder/ui";
import { Bot, Check, CheckCheck, FileText, MessageCircle, Package, Phone, Search, Send, Settings2, ShieldCheck, X } from "lucide-react";
import type { WaConversation, WaMessage } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

type Filter = "all" | "open" | "bot" | "resolved" | "unassigned";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "bot", label: "Bot handling" },
  { key: "resolved", label: "Resolved" },
  { key: "unassigned", label: "Unassigned" },
];

const AGENTS = ["أميرة سعيد", "محمود عادل"];

const QUICK_REPLIES: Array<{ label: string; text: string }> = [
  { label: "Confirm order ✅", text: "تمام ✅ طلبك اتأكد وهيتشحن خلال 24 ساعة." },
  { label: "Send tracking 🚚", text: "طلبك اتشحن مع Bosta 🚚 رقم التتبع: zg8F2K1 — متوقع يوصل خلال يومين." },
  { label: "Ask address 📍", text: "ممكن تبعتلنا العنوان بالتفصيل (المحافظة – الشارع – رقم العمارة والدور) 📍" },
  { label: "Thank you 🙏", text: "شكراً لتعاملك معانا 🙏 لو احتجت أي حاجة ابعتلنا في أي وقت." },
];

const TEMPLATES: Array<{ name: string; text: string }> = [
  { name: "order_confirm", text: "أهلاً 👋 وصلنا طلبك. رد بـ 1 لتأكيد الطلب أو 2 للإلغاء." },
  { name: "shipped", text: "طلبك اتشحن النهاردة 🚚 هيوصلك خلال 2-3 أيام." },
  { name: "delivery_reminder", text: "المندوب هيوصلك النهاردة، من فضلك جهّز مبلغ الطلب كاش 💵" },
  { name: "review_request", text: "وصلك طلبك؟ يهمنا رأيك ⭐ رد بتقييم من 1 لـ 5." },
];

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return formatDate(iso);
}

/** Deterministic fake numbers derived from the order number so the panel is stable. */
function fabricateOrder(orderNumber: string) {
  const n = Number(orderNumber.replace(/\D/g, "")) || 0;
  const prices = [129900, 89900, 249900, 59900, 34900, 19900];
  const items = ["سماعة Pro", "Fit Band 5", "طقم أواني", "عطر العود", "حامل السيارة", "لمبة LED"];
  const idx = n % prices.length;
  return { item: items[idx], price: prices[idx], shipping: 5500, total: prices[idx] + 5500, ordersCount: 1 + (n % 5), reliability: 55 + (n % 45) };
}

export function InboxPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => mockApi.listWaConversations(workspaceId), [workspaceId]);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const conversations = list.data ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations
      .filter((c) => {
        if (filter === "unassigned") return !(assignments[c.id] ?? c.assignedAgentName ?? "");
        if (filter === "all") return true;
        return c.status === filter;
      })
      .filter((c) => !q || c.customerName.toLowerCase().includes(q) || c.phone.includes(q) || (c.orderNumber ?? "").toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q))
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [conversations, filter, search, assignments]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  function patch(id: string, fn: (c: WaConversation) => WaConversation) {
    list.setData((prev) => (prev ?? []).map((c) => (c.id === id ? fn(c) : c)));
  }

  async function changeStatus(c: WaConversation, status: WaConversation["status"]) {
    patch(c.id, (x) => ({ ...x, status, unread: 0 }));
    try {
      await mockApi.setWaStatus(workspaceId, c.id, status);
    } catch (err) {
      toast.error(getErrorMessage(err));
      list.refresh({ silent: true });
    }
  }

  async function send(c: WaConversation, body: string) {
    const optimistic: WaMessage = { id: `tmp-${Date.now()}`, direction: "out", body, at: new Date().toISOString(), status: "sent", byBot: false };
    patch(c.id, (x) => ({ ...x, messages: [...x.messages, optimistic], lastMessage: body, lastAt: optimistic.at, unread: 0, status: "open" }));
    try {
      const saved = await mockApi.sendWaMessage(workspaceId, c.id, body);
      patch(c.id, (x) => ({ ...x, messages: x.messages.map((m) => (m.id === optimistic.id ? saved : m)) }));
    } catch (err) {
      toast.error(getErrorMessage(err));
      patch(c.id, (x) => ({ ...x, messages: x.messages.filter((m) => m.id !== optimistic.id) }));
    }
  }

  function selectConversation(c: WaConversation) {
    setSelectedId(c.id);
    if (c.unread > 0) patch(c.id, (x) => ({ ...x, unread: 0 }));
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[560px] flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-medium text-ink">Inbox</h1>
          <p className="text-sm text-ink-soft">Shared WhatsApp inbox — every customer chat, with the order right next to it.</p>
        </div>
        <Button variant="outline" size="sm" render={<Link to="/inbox/bot" />}>
          <Settings2 /> WhatsApp bot
        </Button>
      </div>

      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        <div className="grid min-h-0 flex-1 grid-cols-[300px_1fr] overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised lg:grid-cols-[320px_1fr_300px]">
          {/* LEFT: conversation list */}
          <aside className="flex min-h-0 flex-col border-r border-line">
            <div className="space-y-2 border-b border-line p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, order…" className="h-9 pl-8" />
              </div>
              <div className="flex flex-wrap gap-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                      filter === f.key ? "border-primary bg-primary-soft text-primary-dark" : "border-line text-ink-soft hover:border-primary/40",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {rows.length === 0 && <li className="p-6 text-center text-sm text-ink-soft">No conversations match.</li>}
              {rows.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectConversation(c)}
                    className={cn("flex w-full gap-3 border-b border-line px-3 py-3 text-left transition-colors hover:bg-paper", selectedId === c.id && "bg-primary-soft/40")}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-dark" dir="auto">
                      {initials(c.customerName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1">
                          <span className="truncate text-sm font-medium text-ink" dir="auto">
                            {c.customerName}
                          </span>
                          {c.status === "bot" && <Bot className="size-3.5 shrink-0 text-primary" aria-label="Bot handling" />}
                        </span>
                        <span className="shrink-0 text-[11px] text-ink-soft">{timeLabel(c.lastAt)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-ink-soft" dir="auto">
                          {c.orderNumber && <span className="mr-1 font-mono text-ink">{c.orderNumber}</span>}
                          {c.lastMessage}
                        </span>
                        {c.unread > 0 && <span className="shrink-0 rounded-full bg-[#25D366] px-1.5 text-[10px] font-semibold text-white">{c.unread}</span>}
                      </span>
                      {c.tags.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {c.tags.map((t) => (
                            <span key={t} className="rounded-full bg-paper px-1.5 py-px text-[10px] text-ink-soft ring-1 ring-line">
                              {t}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* CENTER: thread */}
          <section className="flex min-h-0 min-w-0 flex-col">
            {selected ? (
              <Thread
                key={selected.id}
                conversation={selected}
                assigned={assignments[selected.id] ?? selected.assignedAgentName ?? ""}
                onAssign={(name) => setAssignments((prev) => ({ ...prev, [selected.id]: name }))}
                onStatus={(s) => changeStatus(selected, s)}
                onSend={(body) => send(selected, body)}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-8">
                <EmptyState icon={<MessageCircle />} title="Pick a conversation" description="Select a chat on the left to read and reply. Unread messages are marked with a green badge." className="border-0" />
              </div>
            )}
          </section>

          {/* RIGHT: context panel */}
          <aside className="hidden min-h-0 flex-col overflow-y-auto border-l border-line bg-paper lg:flex">
            {selected ? <ContextPanel conversation={selected} /> : <div className="p-6 text-center text-xs text-ink-soft">Customer and order details appear here.</div>}
          </aside>
        </div>
      </DataState>
    </div>
  );
}

// ---------------------------------------------------------------- Thread --

function Thread({
  conversation: c,
  assigned,
  onAssign,
  onStatus,
  onSend,
}: {
  conversation: WaConversation;
  assigned: string;
  onAssign: (name: string) => void;
  onStatus: (s: WaConversation["status"]) => void;
  onSend: (body: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [c.messages.length]);

  function insert(text: string) {
    setDraft((d) => (d.trim() ? `${d}\n${text}` : text));
    setTemplatesOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function submit() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");
    try {
      await onSend(body);
    } finally {
      setSending(false);
    }
  }

  let lastDay = "";

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-dark" dir="auto">
            {initials(c.customerName)}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-ink" dir="auto">
              {c.customerName}
            </p>
            <p className="flex items-center gap-2 text-xs text-ink-soft">
              <span className="inline-flex items-center gap-1 font-mono">
                <Phone className="size-3" /> {c.phone}
              </span>
              {c.orderNumber && (
                <Link to={`/orders/${c.orderNumber.replace("#", "")}`} className="inline-flex items-center gap-1 font-mono text-primary hover:underline">
                  <Package className="size-3" /> {c.orderNumber}
                </Link>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={c.status} onChange={(e) => onStatus(e.target.value as WaConversation["status"])} className="h-8 w-32 py-1 text-xs" aria-label="Conversation status">
            <option value="open">Open</option>
            <option value="bot">Bot handling</option>
            <option value="resolved">Resolved</option>
          </Select>
          <Select value={assigned} onChange={(e) => onAssign(e.target.value)} className="h-8 w-36 py-1 text-xs" aria-label="Assign to" dir="auto">
            <option value="">Unassigned</option>
            {AGENTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-[#ECE5DD]/60 px-4 py-3 dark:bg-paper">
        {c.messages.map((m) => {
          const day = dayKey(m.at);
          const showSep = day !== lastDay;
          lastDay = day;
          const out = m.direction === "out";
          return (
            <div key={m.id}>
              {showSep && (
                <p className="my-2 text-center">
                  <span className="rounded-full bg-paper-raised px-2 py-0.5 text-[10px] text-ink-soft shadow-sm">{dayLabel(m.at)}</span>
                </p>
              )}
              <div className={cn("flex", out ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[75%] rounded-lg px-2.5 py-1.5 text-[13px] leading-snug shadow-sm", out ? "bg-[#DCF8C6] text-black dark:bg-success-soft dark:text-ink" : "bg-white text-black dark:bg-paper-raised dark:text-ink")} dir="auto">
                  {m.byBot && (
                    <span className="mb-0.5 inline-flex items-center gap-1 rounded bg-black/5 px-1 text-[9px] font-medium uppercase tracking-wide text-black/60 dark:bg-white/10 dark:text-ink-soft">
                      <Bot className="size-2.5" /> Bot
                    </span>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-0.5 flex items-center justify-end gap-1 text-[9px] text-black/40 dark:text-ink-soft">
                    {new Date(m.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    {out && <Ticks status={m.status} />}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="border-t border-line p-3">
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {QUICK_REPLIES.map((q) => (
            <button key={q.label} type="button" onClick={() => insert(q.text)} className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] text-ink-soft transition-colors hover:border-primary/40 hover:text-primary">
              {q.label}
            </button>
          ))}
          <div className="relative ml-auto">
            <Button type="button" size="xs" variant="outline" onClick={() => setTemplatesOpen((o) => !o)}>
              <FileText /> Templates
            </Button>
            {templatesOpen && (
              <div className="absolute bottom-full right-0 z-10 mb-1 w-72 rounded-[var(--radius-card)] border border-line bg-paper-raised p-1 shadow-lg">
                {TEMPLATES.map((t) => (
                  <button key={t.name} type="button" onClick={() => insert(t.text)} className="block w-full rounded px-2 py-1.5 text-left hover:bg-paper">
                    <span className="font-mono text-[11px] text-primary">{t.name}</span>
                    <span className="block truncate text-xs text-ink-soft" dir="auto">
                      {t.text}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={2}
            dir="auto"
            placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
            className="min-h-[44px] flex-1"
          />
          <Button type="button" onClick={submit} disabled={sending || !draft.trim()} className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
            <Send /> Send
          </Button>
        </div>
      </footer>
    </>
  );
}

function Ticks({ status }: { status: WaMessage["status"] }) {
  if (status === "failed") return <X className="size-3 text-danger" aria-label="Failed" />;
  if (status === "sent") return <Check className="size-3" aria-label="Sent" />;
  return <CheckCheck className={cn("size-3", status === "read" && "text-[#34B7F1]")} aria-label={status === "read" ? "Read" : "Delivered"} />;
}

// --------------------------------------------------------- Context panel --

function ContextPanel({ conversation: c }: { conversation: WaConversation }) {
  const toast = useToast();
  const order = c.orderNumber ? fabricateOrder(c.orderNumber) : null;
  const reliability = order?.reliability ?? 70;

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Customer</p>
        <p className="mt-1 text-sm font-medium text-ink" dir="auto">
          {c.customerName}
        </p>
        <p className="font-mono text-xs text-ink-soft">{c.phone}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-ink-soft">Orders</dt>
            <dd className="font-medium text-ink">{order?.ordersCount ?? 1}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Reliability</dt>
            <dd className={cn("inline-flex items-center gap-1 font-medium", reliability >= 70 ? "text-success" : reliability >= 50 ? "text-accent-dark" : "text-danger")}>
              <ShieldCheck className="size-3" /> {reliability}%
            </dd>
          </div>
        </dl>
      </div>

      {order && c.orderNumber && (
        <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Order</p>
            <Link to={`/orders/${c.orderNumber.replace("#", "")}`} className="font-mono text-xs text-primary hover:underline">
              {c.orderNumber}
            </Link>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-ink" dir="auto">
              {order.item} × 1
            </span>
            <span className="tabular-nums text-ink">{formatMoney(order.price)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-ink-soft">
            <span>Shipping</span>
            <span className="tabular-nums">{formatMoney(order.shipping)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-sm font-medium text-ink">
            <span>Total (COD)</span>
            <span className="tabular-nums">{formatMoney(order.total)}</span>
          </div>
        </div>
      )}

      <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Actions</p>
        <div className="mt-2 grid gap-1.5">
          <Button size="sm" variant="outline" className="justify-start text-success" onClick={() => toast.success(`${c.orderNumber ?? "Order"} confirmed — moved to fulfilment.`)}>
            <Check /> Confirm order
          </Button>
          <Button size="sm" variant="outline" className="justify-start text-danger" onClick={() => toast.success(`${c.orderNumber ?? "Order"} cancelled.`)}>
            <X /> Cancel order
          </Button>
          <Button size="sm" variant="outline" className="justify-start" onClick={() => toast.success(`Return request created for ${c.orderNumber ?? "order"}.`)}>
            <Package /> Create return
          </Button>
        </div>
      </div>
    </div>
  );
}
