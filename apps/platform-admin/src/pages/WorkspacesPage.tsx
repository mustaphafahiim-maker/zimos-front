import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { FilterChips, NativeSelect, SearchInput } from "@/components/forms";
import { Panel, SortHead, Td, Th, compareValues, type SortState } from "@/components/Panel";
import { WorkspaceStatus } from "@/components/workspace";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import type { AdminWorkspaceRow } from "@/lib/adminApi";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

type SortKey = "name" | "createdAt" | "mrr" | "orders";
type StatusFilter = "all" | "none" | "trialing" | "active" | "past_due" | "canceled";

function matchesStatus(row: AdminWorkspaceRow, f: StatusFilter) {
  if (f === "all") return true;
  if (f === "none") return !row.subscription;
  return row.subscription?.status === f;
}

export function WorkspacesPage() {
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useAsync(() => adminApi.listWorkspaceRows(), []);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [planId, setPlanId] = useState("all");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "createdAt", dir: "desc" });

  const rows = useMemo(() => data ?? [], [data]);

  const planOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach(({ subscription }) => {
      if (subscription?.planId) map.set(subscription.planId, subscription.planName ?? subscription.planId);
    });
    return Array.from(map.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => matchesStatus(r, status))
      .filter((r) => planId === "all" || r.subscription?.planId === planId)
      .filter(
        ({ workspace }) =>
          !q ||
          workspace.name.toLowerCase().includes(q) ||
          workspace.slug.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        switch (sort.key) {
          case "name":
            return compareValues(a.workspace.name, b.workspace.name, sort.dir);
          case "mrr":
            return compareValues(a.subscription?.mrr ?? 0, b.subscription?.mrr ?? 0, sort.dir);
          case "orders":
            return compareValues(a.workspace.orderCount, b.workspace.orderCount, sort.dir);
          default:
            return compareValues(a.workspace.createdAt, b.workspace.createdAt, sort.dir);
        }
      });
  }, [rows, query, status, planId, sort]);

  const statusOptions: Array<{ value: StatusFilter; label: string; count: number }> = (
    [
      ["all", "All"],
      ["active", "Active"],
      ["trialing", "Trialing"],
      ["past_due", "Past due"],
      ["canceled", "Canceled"],
      ["none", "No subscription"],
    ] as Array<[StatusFilter, string]>
  ).map(([value, label]) => ({
    value,
    label,
    count: rows.filter((r) => matchesStatus(r, value)).length,
  }));

  return (
    <div>
      <PageHeader
        title="Workspaces"
        description="Every store created on the platform."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        <div className="mb-4 flex flex-col gap-3">
          <FilterChips options={statusOptions} value={status} onChange={setStatus} />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput value={query} onChange={setQuery} placeholder="Search name or address" />
            <NativeSelect
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="sm:w-44"
              aria-label="Filter by plan"
            >
              <option value="all">All plans</option>
              {planOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </NativeSelect>
            <span className="text-sm text-ink-soft sm:ms-auto">
              {filtered.length} of {rows.length}
            </span>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyBlock message="No workspaces have been created yet." />
        ) : filtered.length === 0 ? (
          <EmptyBlock message="No workspaces match these filters." />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortHead label="Workspace" sortKey="name" sort={sort} onSort={setSort} />
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <SortHead label="MRR" sortKey="mrr" sort={sort} onSort={setSort} className="text-end" />
                  <SortHead label="Orders" sortKey="orders" sort={sort} onSort={setSort} className="text-end" />
                  <Th>Currency</Th>
                  <SortHead label="Created" sortKey="createdAt" sort={sort} onSort={setSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const { workspace, subscription } = row;
                  return (
                    <TableRow
                      key={workspace.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/workspaces/${workspace.id}`)}
                    >
                      <Td>
                        <Link
                          to={`/workspaces/${workspace.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block font-medium text-ink hover:text-primary"
                        >
                          {workspace.name}
                        </Link>
                        <span className="text-xs text-ink-soft">{workspace.slug}</span>
                      </Td>
                      <Td>
                        {subscription?.planName ?? "—"}
                        {subscription && (
                          <span className="block text-xs text-ink-soft capitalize">
                            {subscription.billingCycle}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <WorkspaceStatus row={row} />
                      </Td>
                      <Td className="tabular text-end">
                        {subscription ? formatMoney(subscription.mrr, subscription.currency) : "—"}
                      </Td>
                      <Td className="tabular text-end">{formatNumber(workspace.orderCount)}</Td>
                      <Td className="text-ink-soft">{workspace.defaultCurrency}</Td>
                      <Td className="text-ink-soft">{formatDate(workspace.createdAt)}</Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>
      <p className="mt-4 text-xs text-ink-soft">
        Orders is a lifetime count. GMV, a 30-day window, owner and location need workspace metrics
        on <code className="font-mono">GET /admin/workspaces</code>, which doesn't return them yet.
      </p>
    </div>
  );
}
