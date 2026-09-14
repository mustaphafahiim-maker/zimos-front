import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Input, cn } from "@store-builder/ui";
import { ArrowLeft, Bot, Check, CheckCheck, FileText, MessageCircle, Package, Phone, Search, Send, Settings2, ShieldCheck, X } from "lucide-react";
import type { WaConversation, WaMessage } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";
import { useT, useCommon, useLocale, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Inbox",
    description: "Shared WhatsApp inbox — every customer chat, with the order right next to it.",
    botSettings: "WhatsApp bot",
    filterOpen: "Open",
    filterBot: "Bot handling",
    filterResolved: "Resolved",
    filterUnassigned: "Unassigned",
    searchPlaceholder: "Search name, phone, order…",
    searchAria: "Search conversations",
    noMatch: "No conversations match.",
    pickTitle: "Pick a conversation",
    pickDescription: "Select a chat from the list to read and reply. Unread chats show a count badge.",
    contextEmpty: "Customer and order details appear here.",
    yesterday: "Yesterday",
    statusAria: "Conversation status",
    assignAria: "Assign to",
    backToList: "Back to conversations",
    bot: "Bot",
    templates: "Templates",
    composerPlaceholder: "Type a message… (Enter to send, Shift+Enter for newline)",
    send: "Send",
    qrConfirm: "Confirm order ✅",
    qrTracking: "Send tracking 🚚",
    qrAddress: "Ask address 📍",
    qrThanks: "Thank you 🙏",
    tickFailed: "Failed",
    tickSent: "Sent",
    tickRead: "Read",
    tickDelivered: "Delivered",
    customer: "Customer",
    orders: "Orders",
    reliability: "Reliability",
    order: "Order",
    shipping: "Shipping",
    totalCod: "Total (COD)",
    actions: "Actions",
    confirmOrder: "Confirm order",
    cancelOrder: "Cancel order",
    createReturn: "Create return",
    orderFallback: "Order",
    toastConfirmed: "{order} confirmed — moved to fulfilment.",
    toastCancelled: "{order} cancelled.",
    toastReturn: "Return request created for {order}.",
  },
  ar: {
    title: "صندوق الوارد",
    description: "صندوق WhatsApp مشترك — كل محادثات العملاء، والطلب ظاهر بجانب كل محادثة.",
    botSettings: "بوت WhatsApp",
    filterOpen: "مفتوحة",
    filterBot: "يتولاها البوت",
    filterResolved: "تم حلها",
    filterUnassigned: "غير مُسندة",
    searchPlaceholder: "ابحث بالاسم أو الهاتف أو رقم الطلب…",
    searchAria: "البحث في المحادثات",
    noMatch: "لا توجد محادثات مطابقة.",
    pickTitle: "اختر محادثة",
    pickDescription: "اختر محادثة من القائمة لقراءتها والرد عليها. المحادثات غير المقروءة يظهر عليها عدد الرسائل.",
    contextEmpty: "تظهر هنا بيانات العميل والطلب.",
    yesterday: "أمس",
    statusAria: "حالة المحادثة",
    assignAria: "إسناد إلى",
    backToList: "العودة إلى المحادثات",
    bot: "البوت",
    templates: "القوالب",
    composerPlaceholder: "اكتب رسالة… (Enter للإرسال، Shift+Enter لسطر جديد)",
    send: "إرسال",
    qrConfirm: "تأكيد الطلب ✅",
    qrTracking: "إرسال رقم التتبع 🚚",
    qrAddress: "طلب العنوان 📍",
    qrThanks: "شكر 🙏",
    tickFailed: "فشل الإرسال",
    tickSent: "تم الإرسال",
    tickRead: "تمت القراءة",
    tickDelivered: "تم التسليم",
    customer: "العميل",
    orders: "الطلبات",
    reliability: "الموثوقية",
    order: "الطلب",
    shipping: "الشحن",
    totalCod: "الإجمالي (الدفع عند الاستلام)",
    actions: "إجراءات",
    confirmOrder: "تأكيد الطلب",
    cancelOrder: "إلغاء الطلب",
    createReturn: "إنشاء مرتجع",
    orderFallback: "الطلب",
    toastConfirmed: "تم تأكيد {order} ونقله إلى التجهيز.",
    toastCancelled: "تم إلغاء {order}.",
    toastReturn: "تم إنشاء طلب مرتجع لـ {order}.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

type Filter = "all" | "open" | "bot" | "resolved" | "unassigned";

const FILTER_KEYS: Filter[] = ["all", "open", "bot", "resolved", "unassigned"];

const AGENTS = ["أميرة سعيد", "محمود عادل"];

// Message texts stay in Egyptian Arabic (they are sent to customers); only the chip labels are localised.
const QUICK_REPLIES: Array<{ labelKey: keyof Strings; text: string }> = [
  { labelKey: "qrConfirm", text: "تمام ✅ طلبك اتأكد وهيتشحن خلال 24 ساعة." },
  { labelKey: "qrTracking", text: "طلبك اتشحن مع Bosta 🚚 رقم التتبع: zg8F2K1 — متوقع يوصل خلال يومين." },
  { labelKey: "qrAddress", text: "ممكن تبعتلنا العنوان بالتفصيل (المحافظة – الشارع – رقم العمارة والدور) 📍" },
  { labelKey: "qrThanks", text: "شكراً لتعاملك معانا 🙏 لو احتجت أي حاجة ابعتلنا في أي وقت." },
];

const TEMPLATES: Array<{ name: string; text: string }> = [
  { name: "order_confirm", text: "أهلاً 👋 وصلنا طلبك. رد بـ 1 لتأكيد الطلب أو 2 للإلغاء." },
  { name: "shipped", text: "طلبك اتشحن النهاردة 🚚 هيوصلك خلال 2-3 أيام." },
  { name: "delivery_reminder", text: "المندوب هيوصلك النهاردة، من فضلك جهّز مبلغ الطلب كاش 💵" },
  { name: "review_request", text: "وصلك طلبك؟ يهمنا رأيك ⭐ رد بتقييم من 1 لـ 5." },
];

function filterLabel(f: Filter, t: Strings, all: string): string {
  switch (f) {
    case "all":
      return all;
    case "open":
      return t.filterOpen;
    case "bot":
      return t.filterBot;
    case "resolved":
      return t.filterResolved;
    case "unassigned":
      return t.filterUnassigned;
  }
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

function timeLabel(iso: string, intlLocale: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString(intlLocale, { month: "short", day: "numeric" });
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dayLabel(iso: string, today: string, yesterday: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return today;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return yesterday;
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

/** Conversation tags are stored as stable keys; show them in the UI language. */
const TAG_LABELS: Record<"en" | "ar", Record<string, string>> = {
  en: {
    confirmed: "Confirmed",
    cancelled: "Cancelled",
    delivered: "Delivered",
    tracking: "Tracking",
    address_change: "Address change",
    question: "Question",
    negotiation: "Price request",
  },
  ar: {
    confirmed: "مؤكَّد",
    cancelled: "ملغى",
    delivered: "تم التسليم",
    tracking: "تتبّع",
    address_change: "تغيير العنوان",
    question: "استفسار",
    negotiation: "طلب خصم",
  },
};

function tagLabel(tag: string, intlLocale: string): string {
  const table = intlLocale.startsWith("ar") ? TAG_LABELS.ar : TAG_LABELS.en;
  return table[tag] ?? tag.replace(/_/g, " ");
}

export function InboxPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const { intlLocale } = useLocale();
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
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button variant="outline" size="sm" render={<Link to="/inbox/bot" />}>
            <Settings2 /> {t.botSettings}
          </Button>
        }
      />

      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-2xl border border-line bg-paper-raised md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)_300px]">
          {/* START: conversation list */}
          <aside className={cn("min-h-0 min-w-0 flex-col border-line md:flex md:border-e", selected ? "hidden" : "flex")}>
            <div className="space-y-2 border-b border-line p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchPlaceholder} aria-label={t.searchAria} className="h-9 ps-8" />
              </div>
              <div className="flex flex-wrap gap-1">
                {FILTER_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    aria-pressed={filter === key}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                      filter === key ? "border-primary bg-primary-soft text-primary-dark" : "border-line text-ink-soft hover:border-primary/40",
                    )}
                  >
                    {filterLabel(key, t, c.all)}
                  </button>
                ))}
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {rows.length === 0 && <li className="p-6 text-center text-sm text-ink-soft">{t.noMatch}</li>}
              {rows.map((conv) => (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => selectConversation(conv)}
                    className={cn("flex w-full gap-3 border-b border-line px-3 py-3 text-start transition-colors hover:bg-paper", selectedId === conv.id && "bg-primary-soft/40")}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-dark" dir="auto">
                      {initials(conv.customerName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1">
                          <span className="truncate text-sm font-medium text-ink" dir="auto">
                            {conv.customerName}
                          </span>
                          {conv.status === "bot" && <Bot className="size-3.5 shrink-0 text-primary" aria-label={t.filterBot} />}
                        </span>
                        <span className="shrink-0 text-[11px] text-ink-soft">{timeLabel(conv.lastAt, intlLocale)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-ink-soft" dir="auto">
                          {conv.orderNumber && (
                            <bdi className="me-1 font-mono text-ink" dir="ltr">
                              {conv.orderNumber}
                            </bdi>
                          )}
                          {conv.lastMessage}
                        </span>
                        {conv.unread > 0 && <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-semibold tabular-nums text-white">{conv.unread}</span>}
                      </span>
                      {conv.tags.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {conv.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-paper px-1.5 py-px text-[10px] text-ink-soft ring-1 ring-line" dir="auto">
                              {tagLabel(tag, intlLocale)}
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
          <section className={cn("min-h-0 min-w-0 flex-col md:flex", selected ? "flex" : "hidden")}>
            {selected ? (
              <Thread
                key={selected.id}
                conversation={selected}
                assigned={assignments[selected.id] ?? selected.assignedAgentName ?? ""}
                onAssign={(name) => setAssignments((prev) => ({ ...prev, [selected.id]: name }))}
                onStatus={(s) => changeStatus(selected, s)}
                onSend={(body) => send(selected, body)}
                onBack={() => setSelectedId(null)}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-8">
                <EmptyState icon={<MessageCircle />} title={t.pickTitle} description={t.pickDescription} className="border-0" />
              </div>
            )}
          </section>

          {/* END: context panel */}
          <aside className="hidden min-h-0 flex-col overflow-y-auto border-s border-line bg-paper lg:flex">
            {selected ? <ContextPanel conversation={selected} /> : <div className="p-6 text-center text-xs text-ink-soft">{t.contextEmpty}</div>}
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
  onBack,
}: {
  conversation: WaConversation;
  assigned: string;
  onAssign: (name: string) => void;
  onStatus: (s: WaConversation["status"]) => void;
  onSend: (body: string) => Promise<void>;
  onBack: () => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const { intlLocale } = useLocale();
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
          <Button type="button" size="icon-sm" variant="ghost" className="md:hidden" aria-label={t.backToList} onClick={onBack}>
            <ArrowLeft className="rtl:rotate-180" />
          </Button>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-dark" dir="auto">
            {initials(c.customerName)}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-ink" dir="auto">
              {c.customerName}
            </p>
            <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
              <span className="inline-flex items-center gap-1 font-mono">
                <Phone className="size-3" /> <bdi dir="ltr">{c.phone}</bdi>
              </span>
              {c.orderNumber && (
                <Link to={`/orders/${c.orderNumber.replace("#", "")}`} className="inline-flex items-center gap-1 font-mono text-primary hover:underline">
                  <Package className="size-3" /> <bdi dir="ltr">{c.orderNumber}</bdi>
                </Link>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={c.status} onChange={(e) => onStatus(e.target.value as WaConversation["status"])} className="h-8 w-32 py-1 text-xs" aria-label={t.statusAria}>
            <option value="open">{t.filterOpen}</option>
            <option value="bot">{t.filterBot}</option>
            <option value="resolved">{t.filterResolved}</option>
          </Select>
          <Select value={assigned} onChange={(e) => onAssign(e.target.value)} className="h-8 w-36 py-1 text-xs" aria-label={t.assignAria} dir="auto">
            <option value="">{t.filterUnassigned}</option>
            {AGENTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-zimos-ice/40 px-4 py-3 dark:bg-paper">
        {c.messages.map((m) => {
          const day = dayKey(m.at);
          const showSep = day !== lastDay;
          lastDay = day;
          const out = m.direction === "out";
          return (
            <div key={m.id}>
              {showSep && (
                <p className="my-2 text-center">
                  <span className="rounded-full bg-paper-raised px-2 py-0.5 text-[10px] text-ink-soft shadow-sm">{dayLabel(m.at, common.today, t.yesterday)}</span>
                </p>
              )}
              <div className={cn("flex", out ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug shadow-sm",
                    out ? "rounded-ee-sm bg-primary text-white" : "rounded-ss-sm border border-line bg-paper-raised text-ink",
                  )}
                >
                  {m.byBot && (
                    <span className={cn("mb-0.5 inline-flex items-center gap-1 rounded px-1 text-[9px] font-medium uppercase tracking-wide", out ? "bg-white/15 text-white/80" : "bg-primary-soft text-primary-dark")}>
                      <Bot className="size-2.5" /> {t.bot}
                    </span>
                  )}
                  <p className="whitespace-pre-wrap break-words" dir="auto">
                    {m.body}
                  </p>
                  <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[9px]", out ? "text-white/70" : "text-ink-muted")}>
                    <bdi dir="ltr">{new Date(m.at).toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })}</bdi>
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
            <button key={q.labelKey} type="button" onClick={() => insert(q.text)} className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] text-ink-soft transition-colors hover:border-primary/40 hover:text-primary">
              {t[q.labelKey]}
            </button>
          ))}
          <div className="relative ms-auto">
            <Button type="button" size="xs" variant="outline" onClick={() => setTemplatesOpen((o) => !o)} aria-expanded={templatesOpen}>
              <FileText /> {t.templates}
            </Button>
            {templatesOpen && (
              <div className="absolute bottom-full end-0 z-10 mb-1 w-72 max-w-[80vw] rounded-2xl border border-line bg-paper-raised p-1 shadow-lg">
                {TEMPLATES.map((tpl) => (
                  <button key={tpl.name} type="button" onClick={() => insert(tpl.text)} className="block w-full rounded-lg px-2 py-1.5 text-start hover:bg-paper">
                    <span className="font-mono text-[11px] text-primary" dir="ltr">
                      {tpl.name}
                    </span>
                    <span className="block truncate text-xs text-ink-soft" dir="auto">
                      {tpl.text}
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
            placeholder={t.composerPlaceholder}
            className="min-h-[44px] min-w-0 flex-1"
          />
          <Button type="button" onClick={submit} disabled={sending || !draft.trim()}>
            <Send className="rtl:-scale-x-100" /> {t.send}
          </Button>
        </div>
      </footer>
    </>
  );
}

function Ticks({ status }: { status: WaMessage["status"] }) {
  const t = useT(STRINGS);
  if (status === "failed") return <X className="size-3 text-danger-soft" aria-label={t.tickFailed} />;
  if (status === "sent") return <Check className="size-3" aria-label={t.tickSent} />;
  return <CheckCheck className={cn("size-3", status === "read" && "text-zimos-ice")} aria-label={status === "read" ? t.tickRead : t.tickDelivered} />;
}

// --------------------------------------------------------- Context panel --

function ContextPanel({ conversation: c }: { conversation: WaConversation }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const order = c.orderNumber ? fabricateOrder(c.orderNumber) : null;
  const reliability = order?.reliability ?? 70;
  const orderRef = c.orderNumber ?? t.orderFallback;

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-2xl border border-line bg-paper-raised p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{t.customer}</p>
        <p className="mt-1 text-sm font-medium text-ink" dir="auto">
          {c.customerName}
        </p>
        <p className="font-mono text-xs text-ink-soft">
          <bdi dir="ltr">{c.phone}</bdi>
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-ink-soft">{t.orders}</dt>
            <dd className="font-medium tabular-nums text-ink">{order?.ordersCount ?? 1}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">{t.reliability}</dt>
            <dd className={cn("inline-flex items-center gap-1 font-medium", reliability >= 70 ? "text-success" : reliability >= 50 ? "text-warning" : "text-danger")}>
              <ShieldCheck className="size-3" /> <bdi dir="ltr">{reliability}%</bdi>
            </dd>
          </div>
        </dl>
      </div>

      {order && c.orderNumber && (
        <div className="rounded-2xl border border-line bg-paper-raised p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{t.order}</p>
            <Link to={`/orders/${c.orderNumber.replace("#", "")}`} className="font-mono text-xs text-primary hover:underline" dir="ltr">
              {c.orderNumber}
            </Link>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 text-ink" dir="auto">
              {order.item} × 1
            </span>
            <span className="shrink-0 tabular-nums text-ink">{formatMoney(order.price)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-ink-soft">
            <span>{t.shipping}</span>
            <span className="tabular-nums">{formatMoney(order.shipping)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2 text-sm font-medium text-ink">
            <span>{t.totalCod}</span>
            <span className="shrink-0 tabular-nums">{formatMoney(order.total)}</span>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-paper-raised p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{t.actions}</p>
        <div className="mt-2 grid gap-1.5">
          <Button size="sm" variant="outline" className="justify-start text-success" onClick={() => toast.success(fmt(t.toastConfirmed, { order: orderRef }))}>
            <Check /> {t.confirmOrder}
          </Button>
          <Button size="sm" variant="outline" className="justify-start text-danger" onClick={() => toast.success(fmt(t.toastCancelled, { order: orderRef }))}>
            <X /> {t.cancelOrder}
          </Button>
          <Button size="sm" variant="outline" className="justify-start" onClick={() => toast.success(fmt(t.toastReturn, { order: orderRef }))}>
            <Package /> {t.createReturn}
          </Button>
        </div>
      </div>
    </div>
  );
}
