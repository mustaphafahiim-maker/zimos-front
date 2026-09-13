import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Send, StickyNote } from "lucide-react";
import { Button, Textarea, buttonVariants, cn } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { DetailRow } from "@/components/Drawer";
import { SelectField } from "@/components/forms";
import { Panel } from "@/components/Panel";
import { Status } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { adminApi } from "@/mock/adminApi";
import type { AdminUser, Ticket, TicketPriority, TicketStatus } from "@/mock/types";
import { formatDateTime, formatRelative, initials } from "@/lib/format";

export function TicketDetailPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useAsync(
    () => Promise.all([adminApi.getTicket(id), adminApi.listAdminUsers()]),
    [id]
  );
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  const setTicket = (t: Ticket) => setData((prev) => [t, prev?.[1] ?? []]);

  if (loading || error) {
    return (
      <div>
        <PageHeader title="Ticket" back={{ to: "/tickets", label: "Tickets" }} />
        <DataState loading={loading} error={error} onRetry={() => void refresh()}>
          {null}
        </DataState>
      </div>
    );
  }

  const ticket = data?.[0] ?? null;
  const admins: AdminUser[] = data?.[1] ?? [];

  if (!ticket) {
    return (
      <div>
        <PageHeader title="Ticket not found" back={{ to: "/tickets", label: "Tickets" }} />
        <EmptyBlock
          message="This ticket doesn't exist or was removed."
          action={
            <Link to="/tickets" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Back to tickets
            </Link>
          }
        />
      </div>
    );
  }

  const t = ticket;

  async function patch(p: Partial<{ status: TicketStatus; priority: TicketPriority; assigneeId: string | null }>, message: string) {
    setSaving(true);
    try {
      setTicket(await adminApi.updateTicket(t.id, p));
      toast.success(message);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      setTicket(await adminApi.replyTicket(t.id, body, internal));
      setBody("");
      toast.success(internal ? "Internal note added." : "Reply sent to the merchant.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={`#${t.number} ${t.subject}`}
        titleBadge={<Status value={t.status} />}
        description={`${t.workspaceName} · opened ${formatRelative(t.createdAt)}`}
        back={{ to: "/tickets", label: "Tickets" }}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Panel title="Conversation" description={`${t.messages.length} message${t.messages.length === 1 ? "" : "s"}`}>
            <ol className="space-y-4">
              {t.messages.map((m) => {
                const mine = m.authorType === "admin";
                return (
                  <li key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        mine ? "bg-zimos-navy text-white" : "bg-primary-soft text-primary"
                      )}
                      aria-hidden
                    >
                      {initials(m.authorName)}
                    </span>
                    <div className={cn("max-w-[85%] min-w-0", mine && "text-end")}>
                      <p className="text-xs text-ink-soft">
                        <span className="font-medium text-ink">{m.authorName}</span> · {m.authorType === "admin" ? "ZIMOS team" : "Merchant"} ·{" "}
                        <span title={formatDateTime(m.createdAt)}>{formatRelative(m.createdAt)}</span>
                      </p>
                      <div
                        className={cn(
                          "mt-1 rounded-[12px] border px-3.5 py-2.5 text-start text-sm whitespace-pre-wrap text-ink",
                          m.internal ? "border-warning/30 bg-warning-soft" : mine ? "border-primary/20 bg-primary-soft" : "border-line bg-paper"
                        )}
                      >
                        {m.internal && (
                          <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-warning">
                            <StickyNote className="size-3" aria-hidden /> Internal note — not visible to the merchant
                          </span>
                        )}
                        {m.body}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>

          <Panel title={internal ? "Add internal note" : "Reply"}>
            <form onSubmit={send} className="space-y-3">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={internal ? "Visible to the ZIMOS team only…" : `Reply to ${t.requesterName}…`}
                aria-label="Message"
                className={cn("min-h-28", internal && "border-warning/40 bg-warning-soft/50")}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="size-4 accent-[var(--color-primary)]" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                  Internal note
                </label>
                <Button type="submit" disabled={sending || !body.trim()}>
                  <Send className="rtl:-scale-x-100" /> {sending ? "Sending…" : internal ? "Add note" : "Send reply"}
                </Button>
              </div>
              {!internal && t.status === "open" && <p className="text-xs text-ink-soft">Sending a reply moves the ticket to Pending.</p>}
            </form>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Properties">
            <div className="space-y-3">
              <SelectField
                label="Status"
                value={t.status}
                disabled={saving}
                onChange={(e) => void patch({ status: e.target.value as TicketStatus }, "Status updated.")}
              >
                <option value="open">Open</option>
                <option value="pending">Pending (waiting on merchant)</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </SelectField>
              <SelectField
                label="Priority"
                value={t.priority}
                disabled={saving}
                onChange={(e) => void patch({ priority: e.target.value as TicketPriority }, "Priority updated.")}
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </SelectField>
              <SelectField
                label="Assignee"
                value={t.assigneeId ?? ""}
                disabled={saving}
                onChange={(e) => void patch({ assigneeId: e.target.value || null }, "Assignee updated.")}
              >
                <option value="">Unassigned</option>
                {admins
                  .filter((a) => a.status === "active" || a.id === t.assigneeId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </SelectField>
            </div>
          </Panel>
          <Panel title="Requester">
            <dl>
              <DetailRow label="Name">{t.requesterName}</DetailRow>
              <DetailRow label="Email">{t.requesterEmail}</DetailRow>
              <DetailRow label="Workspace">
                <Link to={`/workspaces/${t.workspaceId}`} className="text-primary hover:underline">
                  {t.workspaceName}
                </Link>
              </DetailRow>
              <DetailRow label="Created">{formatDateTime(t.createdAt)}</DetailRow>
              <DetailRow label="Updated">{formatDateTime(t.updatedAt)}</DetailRow>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
