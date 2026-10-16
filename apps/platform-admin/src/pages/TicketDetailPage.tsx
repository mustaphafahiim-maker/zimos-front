import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Send } from "lucide-react";
import { Alert, Button, cn } from "@store-builder/ui";
import type {
  AdminSupportTicketThread as Thread,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { SelectField, TextAreaField } from "@/components/forms";
import { Panel } from "@/components/Panel";
import { Status } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import { formatDateTime, formatRelative } from "@/lib/format";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/tickets";

type ReplyStatus = Exclude<SupportTicketStatus, "closed">;

export function TicketDetailPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.getTicket(id), [id]);
  const [reply, setReply] = useState("");
  const [after, setAfter] = useState<ReplyStatus>("pending");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ticket = data?.ticket;

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setReplyError(null);
    try {
      const res = await adminApi.replyTicket(id, { body: reply.trim(), status: after });
      setData((prev: Thread | null) => {
        if (!prev) throw new Error("Ticket not loaded.");
        return { ticket: res.ticket, messages: [...prev.messages, res.message] };
      });
      setReply("");
      setAfter("pending");
      toast.success("Reply sent.");
    } catch (err) {
      setReplyError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function update(patch: { status?: SupportTicketStatus; priority?: SupportTicketPriority }) {
    setSaving(true);
    try {
      const updated = await adminApi.updateTicket(id, patch);
      setData((prev: Thread | null) => {
        if (!prev) throw new Error("Ticket not loaded.");
        return { ...prev, ticket: updated };
      });
      toast.success("Ticket updated.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={ticket?.subject ?? "Ticket"}
        titleBadge={ticket ? <Status value={ticket.status} label={STATUS_LABEL[ticket.status]} /> : undefined}
        description={
          ticket
            ? `${ticket.workspaceName ?? "Deleted workspace"} · ${ticket.category} · opened ${formatRelative(ticket.createdAt)} by ${ticket.createdBy ?? "a deleted user"}`
            : undefined
        }
        back={{ to: "/tickets", label: "Support tickets" }}
      />
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && ticket && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-4">
              <Panel title="Conversation" flush>
                <ol className="divide-y divide-line">
                  {data.messages.map((m) => (
                    <li key={m.id} className={cn("px-5 py-4", m.authorType === "admin" && "bg-primary-soft/40")}>
                      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs text-ink-soft">
                        <span>
                          <span className="font-semibold text-ink">{m.authorName ?? "Deleted user"}</span>{" "}
                          {m.authorType === "admin" ? "· platform team" : "· merchant"}
                          {m.authorEmail ? ` · ${m.authorEmail}` : ""}
                        </span>
                        <span title={formatDateTime(m.createdAt)}>{formatRelative(m.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap wrap-break-word text-sm text-ink">{m.body}</p>
                    </li>
                  ))}
                </ol>
              </Panel>

              {ticket.status === "closed" ? (
                <Alert>This ticket is closed. Re-open it from the panel on the right to reply.</Alert>
              ) : (
                <Panel title="Reply" description="The merchant sees replies signed “Zimos support”.">
                  <form onSubmit={send} className="space-y-3">
                    {replyError && <Alert variant="danger">{replyError}</Alert>}
                    <TextAreaField
                      label="Message"
                      required
                      rows={5}
                      maxLength={5000}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                    />
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <SelectField
                        label="Then set the ticket to"
                        className="w-60"
                        value={after}
                        onChange={(e) => setAfter(e.target.value as ReplyStatus)}
                      >
                        <option value="pending">{STATUS_LABEL.pending}</option>
                        <option value="resolved">{STATUS_LABEL.resolved}</option>
                        <option value="open">{STATUS_LABEL.open}</option>
                      </SelectField>
                      <Button type="submit" disabled={sending || !reply.trim()}>
                        <Send /> {sending ? "Sending…" : "Send reply"}
                      </Button>
                    </div>
                  </form>
                </Panel>
              )}
            </div>

            <Panel title="Ticket" className="h-fit">
              <div className="space-y-4">
                <SelectField
                  label="Status"
                  value={ticket.status}
                  disabled={saving}
                  onChange={(e) => void update({ status: e.target.value as SupportTicketStatus })}
                >
                  {(Object.keys(STATUS_LABEL) as SupportTicketStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Priority"
                  value={ticket.priority}
                  disabled={saving}
                  onChange={(e) => void update({ priority: e.target.value as SupportTicketPriority })}
                >
                  {(Object.keys(PRIORITY_LABEL) as SupportTicketPriority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </SelectField>
                <dl className="space-y-2 border-t border-line pt-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-soft">Workspace</dt>
                    <dd>
                      <Link to={`/workspaces/${ticket.workspaceId}`} className="hover:text-primary">
                        {ticket.workspaceName ?? "Deleted"}
                      </Link>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-soft">Opened by</dt>
                    <dd className="truncate" title={ticket.createdByEmail}>
                      {ticket.createdBy ?? "Deleted user"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-soft">Last message</dt>
                    <dd>{formatRelative(ticket.lastMessageAt)}</dd>
                  </div>
                </dl>
              </div>
            </Panel>
          </div>
        )}
      </DataState>
    </div>
  );
}
