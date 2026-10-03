import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Button, Card, cn } from "@store-builder/ui";
import type {
  SupportTicket,
  SupportTicketCategory,
  SupportTicketStatus,
  SupportTicketThread,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";

const CATEGORIES: SupportTicketCategory[] = ["general", "billing", "orders", "shipping", "payments", "technical", "account"];

const STRINGS = {
  en: {
    title: "Contact support",
    description: "Ask the Zimos team for help. We reply here, in the ticket.",
    newHeading: "New request",
    subject: "Subject",
    subjectPlaceholder: "What do you need help with?",
    category: "Topic",
    message: "Message",
    messagePlaceholder: "Describe the problem. Include order numbers or links if they help.",
    send: "Send request",
    sending: "Sending…",
    sent: "Your request was sent. We'll reply here.",
    subjectTooShort: "Enter a subject of at least 3 characters.",
    messageRequired: "Write a message.",
    listHeading: "Your requests",
    empty: "You haven't contacted support yet.",
    messages: "{n} messages",
    updated: "Last update {date}",
    back: "Contact support",
    you: "You",
    reply: "Reply",
    replyPlaceholder: "Write a reply…",
    sendReply: "Send reply",
    replySent: "Reply sent.",
    closedNotice: "This request is closed. Open a new request if you still need help.",
    opened: "Opened {date} by {name}",
    someone: "a team member",
    cat_general: "General question",
    cat_billing: "Billing & subscription",
    cat_orders: "Orders",
    cat_shipping: "Shipping",
    cat_payments: "Payments",
    cat_technical: "Technical problem",
    cat_account: "Account",
    st_open: "Waiting on Zimos",
    st_pending: "Waiting on you",
    st_resolved: "Resolved",
    st_closed: "Closed",
  },
  ar: {
    title: "تواصل مع الدعم",
    description: "اطلب المساعدة من فريق زيموس. سنرد عليك هنا داخل الطلب.",
    newHeading: "طلب جديد",
    subject: "الموضوع",
    subjectPlaceholder: "ما الذي تحتاج المساعدة فيه؟",
    category: "النوع",
    message: "الرسالة",
    messagePlaceholder: "اشرح المشكلة. أضف أرقام الأوردرات أو الروابط إن كانت تساعد.",
    send: "إرسال الطلب",
    sending: "جارٍ الإرسال…",
    sent: "تم إرسال طلبك. سنرد عليك هنا.",
    subjectTooShort: "أدخل موضوعًا من 3 أحرف على الأقل.",
    messageRequired: "اكتب رسالة.",
    listHeading: "طلباتك",
    empty: "لم تتواصل مع الدعم بعد.",
    messages: "{n} رسائل",
    updated: "آخر تحديث {date}",
    back: "تواصل مع الدعم",
    you: "أنت",
    reply: "رد",
    replyPlaceholder: "اكتب ردًا…",
    sendReply: "إرسال الرد",
    replySent: "تم إرسال الرد.",
    closedNotice: "هذا الطلب مغلق. افتح طلبًا جديدًا إذا كنت ما زلت تحتاج المساعدة.",
    opened: "فُتح في {date} بواسطة {name}",
    someone: "أحد أعضاء الفريق",
    cat_general: "استفسار عام",
    cat_billing: "الفوترة والاشتراك",
    cat_orders: "الطلبات",
    cat_shipping: "الشحن",
    cat_payments: "المدفوعات",
    cat_technical: "مشكلة تقنية",
    cat_account: "الحساب",
    st_open: "بانتظار رد زيموس",
    st_pending: "بانتظار ردك",
    st_resolved: "تم الحل",
    st_closed: "مغلق",
  },
} satisfies Messages;

type T = (typeof STRINGS)["en"];

const STATUS_TONE: Record<SupportTicketStatus, "info" | "warning" | "success" | "neutral"> = {
  open: "info",
  pending: "warning",
  resolved: "success",
  closed: "neutral",
};

function statusText(t: T, status: SupportTicketStatus): string {
  return t[`st_${status}`];
}

function categoryText(t: T, category: SupportTicketCategory): string {
  return t[`cat_${category}`];
}

/** /support — the workspace's requests and a form to open a new one. */
export function SupportPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const list = useAsync(() => apiClient.listSupportTickets(workspaceId), [workspaceId]);
  const tickets = list.data ?? [];

  return (
    <div className="max-w-3xl">
      <PageHeader title={t.title} description={t.description} />
      <div className="space-y-6">
        <NewTicketForm key={workspaceId} onOpened={() => void list.refresh({ silent: true })} />

        <section className="space-y-3">
          <h2 className="font-display text-lg font-medium text-ink">{t.listHeading}</h2>
          <DataState
            loading={list.loading}
            error={list.error}
            empty={tickets.length === 0}
            emptyMessage={t.empty}
            onRetry={() => void list.refresh()}
          >
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised">
              {tickets.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} t={t} />
              ))}
            </ul>
          </DataState>
        </section>
      </div>
    </div>
  );
}

function TicketRow({ ticket, t }: { ticket: SupportTicket; t: T }) {
  return (
    <li>
      <Link
        to={`/support/${ticket.id}`}
        className="flex min-h-11 flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-primary-soft/40"
      >
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{ticket.subject}</p>
          <p className="text-xs text-ink-soft">
            {categoryText(t, ticket.category)} · {fmt(t.messages, { n: ticket.messageCount ?? 1 })} ·{" "}
            {fmt(t.updated, { date: formatDateTime(ticket.lastMessageAt) })}
          </p>
        </div>
        <StatusBadge value={ticket.status} tone={STATUS_TONE[ticket.status]} text={statusText(t, ticket.status)} />
      </Link>
    </li>
  );
}

function NewTicketForm({ onOpened }: { onOpened: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<SupportTicketCategory>("general");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (subject.trim().length < 3) return setError(t.subjectTooShort);
    if (!body.trim()) return setError(t.messageRequired);
    setBusy(true);
    setError(null);
    try {
      await apiClient.openSupportTicket(workspaceId, { subject: subject.trim(), body: body.trim(), category });
      setSubject("");
      setBody("");
      setCategory("general");
      toast.success(t.sent);
      onOpened();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="font-display text-lg font-medium text-ink">{t.newHeading}</h2>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <TextField
            label={t.subject}
            required
            maxLength={200}
            placeholder={t.subjectPlaceholder}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <Field label={t.category}>
            {({ id }) => (
              <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryText(t, c)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label={t.message} required>
          {({ id }) => (
            <Textarea
              id={id}
              rows={5}
              maxLength={5000}
              placeholder={t.messagePlaceholder}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={busy} className="min-h-11">
            {busy ? t.sending : t.send}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** /support/:ticketId — one request's thread, and a reply box while it is open. */
export function SupportTicketPage() {
  const t = useT(STRINGS);
  const { ticketId = "" } = useParams();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const thread = useAsync(() => apiClient.getSupportTicket(workspaceId, ticketId), [workspaceId, ticketId]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ticket = thread.data?.ticket;

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return setError(t.messageRequired);
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.replySupportTicket(workspaceId, ticketId, reply.trim());
      thread.setData((prev: SupportTicketThread | null) => {
        if (!prev) throw new Error("Ticket not loaded.");
        return { ticket: res.ticket, messages: [...prev.messages, res.message] };
      });
      setReply("");
      toast.success(t.replySent);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={ticket?.subject ?? t.title}
        titleBadge={
          ticket ? (
            <StatusBadge value={ticket.status} tone={STATUS_TONE[ticket.status]} text={statusText(t, ticket.status)} />
          ) : undefined
        }
        description={
          ticket
            ? `${categoryText(t, ticket.category)} · ${fmt(t.opened, {
                date: formatDateTime(ticket.createdAt),
                name: ticket.createdBy ?? t.someone,
              })}`
            : undefined
        }
        back={{ to: "/support", label: t.back }}
      />
      <DataState loading={thread.loading} error={thread.error} onRetry={() => void thread.refresh()}>
        {thread.data && ticket && (
          <div className="space-y-4">
            <ol className="space-y-3">
              {thread.data.messages.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "rounded-[var(--radius-card)] border px-4 py-3",
                    m.authorType === "admin" ? "border-primary/30 bg-primary-soft/40" : "border-line bg-paper-raised"
                  )}
                >
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs text-ink-soft">
                    <span className="font-semibold text-ink">
                      {m.authorType === "admin" ? m.authorName : (m.authorName ?? t.you)}
                    </span>
                    <span>{formatDateTime(m.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap wrap-break-word text-sm text-ink">{m.body}</p>
                </li>
              ))}
            </ol>

            {ticket.status === "closed" ? (
              <Alert>{t.closedNotice}</Alert>
            ) : (
              <Card className="p-4">
                <form onSubmit={send} className="space-y-3">
                  {error && <Alert variant="danger">{error}</Alert>}
                  <Field label={t.reply}>
                    {({ id }) => (
                      <Textarea
                        id={id}
                        rows={4}
                        maxLength={5000}
                        placeholder={t.replyPlaceholder}
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                      />
                    )}
                  </Field>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={busy || !reply.trim()} className="min-h-11">
                      {busy ? t.sending : t.sendReply}
                    </Button>
                  </div>
                </form>
              </Card>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}
