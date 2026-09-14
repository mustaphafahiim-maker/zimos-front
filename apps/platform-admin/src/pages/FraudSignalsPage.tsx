import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, Globe, Phone } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilterChips, SearchInput, TextAreaField } from "@/components/forms";
import { Panel, SortHead, Td, Th, compareValues, type SortState } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAsync } from "@store-builder/ui";
import { adminApi } from "@/mock/adminApi";
import type { FraudSignal } from "@/mock/types";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";

type Filter = "all" | "phone" | "ip";
type SortKey = "stores" | "rto" | "lastSeen";

export function FraudSignalsPage() {
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.listFraudSignals(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "stores", dir: "desc" });
  const [blocking, setBlocking] = useState<FraudSignal | null>(null);
  const [reason, setReason] = useState("");

  const rows = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(
    () =>
      rows
        .filter((s) => (filter === "all" || s.type === filter) && (!query.trim() || s.value.replace(/\s/g, "").includes(query.replace(/\s/g, ""))))
        .sort((a, b) => {
          if (sort.key === "rto") return compareValues(a.rtoCount / Math.max(a.ordersCount, 1), b.rtoCount / Math.max(b.ordersCount, 1), sort.dir);
          if (sort.key === "lastSeen") return compareValues(a.lastSeenAt, b.lastSeenAt, sort.dir);
          return compareValues(a.storesCount, b.storesCount, sort.dir);
        }),
    [rows, filter, query, sort]
  );

  const options = (
    [
      ["all", "All"],
      ["phone", "Phones"],
      ["ip", "IP addresses"],
    ] as Array<[Filter, string]>
  ).map(([value, label]) => ({ value, label, count: value === "all" ? rows.length : rows.filter((s) => s.type === value).length }));

  return (
    <div>
      <PageHeader
        title="Fraud signals"
        description="Phones and IPs seen with suspicious outcomes across more than one store."
        actions={
          <Link to="/blocklist" className="text-sm font-medium text-primary hover:underline">
            View global blocklist
          </Link>
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips options={options} value={filter} onChange={setFilter} />
          <SearchInput value={query} onChange={setQuery} placeholder="Search phone or IP" />
        </div>
        {filtered.length === 0 ? (
          <EmptyBlock message={rows.length === 0 ? "No cross-store signals detected." : "No signals match these filters."} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Signal</Th>
                  <SortHead label="Stores" sortKey="stores" sort={sort} onSort={setSort} className="text-end" />
                  <Th className="text-end">Orders</Th>
                  <SortHead label="RTO" sortKey="rto" sort={sort} onSort={setSort} className="text-end" />
                  <Th>Seen at</Th>
                  <Th>First seen</Th>
                  <SortHead label="Last seen" sortKey="lastSeen" sort={sort} onSort={setSort} />
                  <Th className="text-end">Action</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const rtoPct = Math.round((s.rtoCount / Math.max(s.ordersCount, 1)) * 100);
                  return (
                    <TableRow key={s.id}>
                      <Td>
                        <span className="flex items-center gap-2">
                          {s.type === "phone" ? <Phone className="size-3.5 text-ink-soft" aria-hidden /> : <Globe className="size-3.5 text-ink-soft" aria-hidden />}
                          <span className="tabular font-mono text-sm">{s.value}</span>
                        </span>
                      </Td>
                      <Td className="tabular text-end font-medium">{s.storesCount}</Td>
                      <Td className="tabular text-end">{formatNumber(s.ordersCount)}</Td>
                      <Td className="tabular text-end">
                        <span className={rtoPct >= 60 ? "text-danger" : rtoPct >= 40 ? "text-warning" : "text-ink"}>
                          {s.rtoCount} ({rtoPct}%)
                        </span>
                      </Td>
                      <Td className="max-w-56 truncate text-ink-soft" >
                        <span title={s.workspaceNames.join(", ")}>
                          {s.workspaceNames.slice(0, 2).join(", ")}
                          {s.workspaceNames.length > 2 ? ` +${s.workspaceNames.length - 2}` : ""}
                        </span>
                      </Td>
                      <Td className="text-ink-soft">{formatDate(s.firstSeenAt)}</Td>
                      <Td className="text-ink-soft">{formatRelative(s.lastSeenAt)}</Td>
                      <Td className="text-end">
                        {s.blocked ? (
                          <StatusBadge tone="danger" dot>
                            Blocked
                          </StatusBadge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReason(`Seen across ${s.storesCount} stores with ${s.rtoCount} returned orders (${rtoPct}% RTO).`);
                              setBlocking(s);
                            }}
                          >
                            <Ban /> Add to global blocklist
                          </Button>
                        )}
                      </Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>

      <ConfirmDialog
        open={!!blocking}
        title="Add to global blocklist?"
        description={blocking ? `${blocking.value} will be blocked at checkout on every store on the platform.` : undefined}
        confirmLabel="Block globally"
        destructive
        confirmDisabled={!reason.trim()}
        onCancel={() => setBlocking(null)}
        onConfirm={async () => {
          if (!blocking) return;
          const next = await adminApi.blockFraudSignal(blocking.id, reason);
          setData((prev) => (prev ?? []).map((x) => (x.id === next.id ? next : x)));
          toast.success(`${blocking.value} added to the global blocklist.`);
          setBlocking(null);
        }}
      >
        <TextAreaField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
      </ConfirmDialog>
    </div>
  );
}
