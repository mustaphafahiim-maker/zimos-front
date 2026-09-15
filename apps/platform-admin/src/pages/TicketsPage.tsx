import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { FilterChips, NativeSelect, SearchInput } from "@/components/forms";
import { Panel, Td, Th } from "@/components/Panel";
import { Status } from "@/components/StatusBadge";
import { useAsync } from "@/lib/useAsync";
import { adminApi } from "@/mock/adminApi";
import type { TicketPriority, TicketStatus } from "@/mock/types";
import { formatDateTime, formatRelative } from "@/lib/format";

type StatusFilter = "all" | TicketStatus;

const PRIORITY_RANK: Record<TicketPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function TicketsPage() {
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useAsync(() => Promise.all([adminApi.listTickets(), adminApi.listAdminUsers()]), []);
  const [status, setStatus] = useState<StatusFilter>("open");
  const [priority, setPriority] = useState<"all" | TicketPriority>("all");
  const [assignee, setAssignee] = useState("all");
  const [query, setQuery] = useState("");

  const tickets = useMemo(() => data?.[0] ?? [], [data]);
  const admins = useMemo(() => data?.[1] ?? [], [data]);
  const adminName = (id: string | null) => (id ? admins.find((a) => a.id === id)?.name ?? "Unknown" : null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets
      .filter((t) => status === "all" || t.status === status)
      .filter((t) => priority === "all" || t.priority === priority)
      .filter((t) => assignee === "all" || (assignee === "unassigned" ? t.assigneeId === null : t.assigneeId === assignee))
      .filter(
        (t) =>
          !q ||
          t.subject.toLowerCase().includes(q) ||
          t.workspaceName.toLowerCase().includes(q) ||
          t.requesterEmail.toLowerCase().includes(q) ||
          String(t.number).includes(q)
      )
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.updatedAt.localeCompare(a.updatedAt));
  }, [tickets, status, priority, assignee, query]);

  const options = (
    [
      ["open", "Open"],
      ["pending", "Pending"],
      ["resolved", "Resolved"],
      ["closed", "Closed"],
      ["all", "All"],
    ] as Array<[StatusFilter, string]>
  ).map(([value, label]) => ({ value, label, count: value === "all" ? tickets.length : tickets.filter((t) => t.status === value).length }));

  return (
    <div>
      <PageHeader title="Tickets" description="Support requests from merchants." />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        <div className="mb-4 flex flex-col gap-3">
          <FilterChips options={options} value={status} onChange={setStatus} />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput value={query} onChange={setQuery} placeholder="Search subject, workspace or #" />
            <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value as "all" | TicketPriority)} className="sm:w-40" aria-label="Filter by priority">
              <option value="all">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </NativeSelect>
            <NativeSelect value={assignee} onChange={(e) => setAssignee(e.target.value)} className="sm:w-48" aria-label="Filter by assignee">
              <option value="all">All assignees</option>
              <option value="unassigned">Unassigned</option>
              {admins
                .filter((a) => a.status !== "disabled")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </NativeSelect>
          </div>
        </div>
        {filtered.length === 0 ? (
          <EmptyBlock message={tickets.length === 0 ? "No support tickets yet." : "No tickets match these filters."} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Ticket</Th>
                  <Th>Workspace</Th>
                  <Th>Priority</Th>
                  <Th>Status</Th>
                  <Th>Assignee</Th>
                  <Th>Updated</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`/tickets/${t.id}`)}>
                    <Td className="max-w-md whitespace-normal">
                      <Link to={`/tickets/${t.id}`} onClick={(e) => e.stopPropagation()} className="block font-medium text-ink hover:text-primary">
                        <span className="text-ink-soft">#{t.number}</span> {t.subject}
                      </Link>
                      <span className="text-xs text-ink-soft">
                        {t.requesterName} · {t.messages.length} message{t.messages.length === 1 ? "" : "s"}
                      </span>
                    </Td>
                    <Td className="text-ink-soft">{t.workspaceName}</Td>
                    <Td>
                      <Status value={t.priority} />
                    </Td>
                    <Td>
                      <Status value={t.status} />
                    </Td>
                    <Td className={t.assigneeId ? "text-ink" : "text-ink-soft"}>{adminName(t.assigneeId) ?? "Unassigned"}</Td>
                    <Td className="text-ink-soft">
                      <span title={formatDateTime(t.updatedAt)}>{formatRelative(t.updatedAt)}</span>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>
    </div>
  );
}
