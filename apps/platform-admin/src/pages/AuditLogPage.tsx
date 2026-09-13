import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Input, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { DetailRow, Drawer } from "@/components/Drawer";
import { NativeSelect, SearchInput } from "@/components/forms";
import { JsonBlock, Mono, Panel, Td, Th } from "@/components/Panel";
import { humanize } from "@/components/StatusBadge";
import { useAsync } from "@/lib/useAsync";
import { adminApi } from "@/mock/adminApi";
import type { AuditEntry } from "@/mock/types";
import { formatDateTime, formatRelative } from "@/lib/format";

const PAGE = 25;
const PERIODS: Array<{ value: string; label: string; hours: number | null }> = [
  { value: "24h", label: "Last 24 hours", hours: 24 },
  { value: "7d", label: "Last 7 days", hours: 24 * 7 },
  { value: "30d", label: "Last 30 days", hours: 24 * 30 },
  { value: "all", label: "All time", hours: null },
];

export function AuditLogPage() {
  const { data, loading, error, refresh } = useAsync(() => adminApi.listAudit(), []);
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [workspace, setWorkspace] = useState("");
  const [period, setPeriod] = useState("30d");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const rows = useMemo(() => data ?? [], [data]);
  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))).sort(), [rows]);
  const entityTypes = useMemo(() => Array.from(new Set(rows.map((r) => r.entityType))).sort(), [rows]);

  const filtered = useMemo(() => {
    const a = actor.trim().toLowerCase();
    const w = workspace.trim().toLowerCase();
    const hours = PERIODS.find((p) => p.value === period)?.hours ?? null;
    const since = hours === null ? 0 : Date.now() - hours * 3_600_000;
    return rows.filter(
      (r) =>
        (!a || r.actorName.toLowerCase().includes(a) || r.actorEmail.toLowerCase().includes(a)) &&
        (action === "all" || r.action === action) &&
        (entityType === "all" || r.entityType === entityType) &&
        (!w || (r.workspaceName ?? "").toLowerCase().includes(w) || (r.workspaceId ?? "").toLowerCase() === w) &&
        new Date(r.createdAt).getTime() >= since
    );
  }, [rows, actor, action, entityType, workspace, period]);

  const resetPaging = () => setLimit(PAGE);

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every change made by the ZIMOS team through this console."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <SearchInput
            className="sm:w-full"
            value={actor}
            onChange={(v) => {
              setActor(v);
              resetPaging();
            }}
            placeholder="Actor name or email"
          />
          <NativeSelect
            aria-label="Action"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              resetPaging();
            }}
          >
            <option value="all">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Entity type"
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              resetPaging();
            }}
          >
            <option value="all">All entities</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </NativeSelect>
          <Input
            aria-label="Workspace"
            placeholder="Workspace name or id"
            value={workspace}
            onChange={(e) => {
              setWorkspace(e.target.value);
              resetPaging();
            }}
          />
          <NativeSelect
            aria-label="Time period"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              resetPaging();
            }}
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        {filtered.length === 0 ? (
          <EmptyBlock message={rows.length === 0 ? "No audit entries yet." : "No entries match these filters."} />
        ) : (
          <>
            <Panel flush>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <Th>Time</Th>
                    <Th>Actor</Th>
                    <Th>Action</Th>
                    <Th>Entity</Th>
                    <Th>Workspace</Th>
                    <Th>IP</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, limit).map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                      <Td className="text-ink-soft">
                        <span title={formatDateTime(r.createdAt)}>{formatRelative(r.createdAt)}</span>
                      </Td>
                      <Td>
                        <span className="block">{r.actorName}</span>
                        <span className="text-xs text-ink-soft">{r.actorEmail}</span>
                      </Td>
                      <Td>
                        <Mono>{r.action}</Mono>
                      </Td>
                      <Td>
                        <span className="block">{r.entityLabel}</span>
                        <span className="text-xs text-ink-soft">{humanize(r.entityType)}</span>
                      </Td>
                      <Td className="text-ink-soft">{r.workspaceName ?? "—"}</Td>
                      <Td className="tabular font-mono text-xs text-ink-soft">{r.ip}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
            <div className="mt-3 flex items-center justify-between text-sm text-ink-soft">
              <span>
                Showing {Math.min(limit, filtered.length)} of {filtered.length}
              </span>
              {limit < filtered.length && (
                <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                  Load more
                </Button>
              )}
            </div>
          </>
        )}
      </DataState>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.action ?? ""} description={selected ? formatDateTime(selected.createdAt) : undefined}>
        {selected && (
          <div className="space-y-5">
            <dl>
              <DetailRow label="Actor">
                {selected.actorName} · {selected.actorEmail}
              </DetailRow>
              <DetailRow label="Action">
                <Mono>{selected.action}</Mono>
              </DetailRow>
              <DetailRow label="Entity">
                {humanize(selected.entityType)} · {selected.entityLabel}
              </DetailRow>
              <DetailRow label="Entity ID">
                <Mono>{selected.entityId}</Mono>
              </DetailRow>
              <DetailRow label="Workspace">{selected.workspaceName ?? "—"}</DetailRow>
              <DetailRow label="IP address">{selected.ip}</DetailRow>
              <DetailRow label="User agent">
                <span className="text-xs">{selected.userAgent || "—"}</span>
              </DetailRow>
              <DetailRow label="Entry ID">
                <Mono>{selected.id}</Mono>
              </DetailRow>
            </dl>
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-ink">Before</h3>
              <JsonBlock value={selected.before} />
            </div>
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-ink">After</h3>
              <JsonBlock value={selected.after} />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
