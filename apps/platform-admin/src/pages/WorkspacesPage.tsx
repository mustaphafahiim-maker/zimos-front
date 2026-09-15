import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { FilterChips, NativeSelect, SearchInput } from "@/components/forms";
import { Panel, SortHead, SourceNotice, Td, Th, compareValues, type SortState } from "@/components/Panel";
import { WorkspaceStatus, countryName } from "@/components/workspace";
import { useAsync } from "@/lib/useAsync";
import { adminApi } from "@/mock/adminApi";
import type { AdminWorkspace, SubscriptionStatus } from "@/mock/types";
import { formatDate, formatMoneyCompact, formatNumber } from "@/lib/format";

type SortKey = "name" | "createdAt" | "orders" | "gmv";
type StatusFilter = "all" | SubscriptionStatus | "suspended";

function matchesStatus(ws: AdminWorkspace, f: StatusFilter) {
  if (f === "all") return true;
  if (f === "suspended") return ws.meta.suspended;
  return ws.meta.subscriptionStatus === f;
}

export function WorkspacesPage() {
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useAsync(() => adminApi.listWorkspaces(), []);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [planId, setPlanId] = useState("all");
  const [country, setCountry] = useState("all");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "createdAt", dir: "desc" });

  const rows = useMemo(() => data?.rows ?? [], [data]);

  const planOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((w) => w.plan && map.set(w.plan.id, w.plan.name));
    return Array.from(map.entries());
  }, [rows]);

  const countryOptions = useMemo(() => Array.from(new Set(rows.map((w) => w.meta.country))).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((w) => matchesStatus(w, status))
      .filter((w) => planId === "all" || w.meta.planId === planId)
      .filter((w) => country === "all" || w.meta.country === country)
      .filter(
        (w) =>
          !q ||
          w.name.toLowerCase().includes(q) ||
          w.slug.toLowerCase().includes(q) ||
          w.meta.ownerEmail.toLowerCase().includes(q) ||
          w.meta.ownerName.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        switch (sort.key) {
          case "name":
            return compareValues(a.name, b.name, sort.dir);
          case "orders":
            return compareValues(a.meta.ordersLast30d, b.meta.ordersLast30d, sort.dir);
          case "gmv":
            return compareValues(a.meta.gmvLast30d, b.meta.gmvLast30d, sort.dir);
          default:
            return compareValues(a.createdAt, b.createdAt, sort.dir);
        }
      });
  }, [rows, query, status, planId, country, sort]);

  const statusOptions: Array<{ value: StatusFilter; label: string; count: number }> = (
    [
      ["all", "All"],
      ["active", "Active"],
      ["trialing", "Trialing"],
      ["past_due", "Past due"],
      ["canceled", "Canceled"],
      ["suspended", "Suspended"],
    ] as Array<[StatusFilter, string]>
  ).map(([value, label]) => ({ value, label, count: rows.filter((w) => matchesStatus(w, value)).length }));

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
        {data && (
          <>
            <SourceNotice result={data} />
            <div className="mb-4 flex flex-col gap-3">
              <FilterChips options={statusOptions} value={status} onChange={setStatus} />
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <SearchInput value={query} onChange={setQuery} placeholder="Search name, slug or owner email" />
                <NativeSelect value={planId} onChange={(e) => setPlanId(e.target.value)} className="sm:w-44" aria-label="Filter by plan">
                  <option value="all">All plans</option>
                  {planOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect value={country} onChange={(e) => setCountry(e.target.value)} className="sm:w-48" aria-label="Filter by country">
                  <option value="all">All countries</option>
                  {countryOptions.map((c) => (
                    <option key={c} value={c}>
                      {countryName(c)}
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
                      <Th>Owner</Th>
                      <Th>Plan</Th>
                      <Th>Status</Th>
                      <Th>Country</Th>
                      <SortHead label="Orders 30d" sortKey="orders" sort={sort} onSort={setSort} className="text-end" />
                      <SortHead label="GMV 30d" sortKey="gmv" sort={sort} onSort={setSort} className="text-end" />
                      <SortHead label="Created" sortKey="createdAt" sort={sort} onSort={setSort} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((ws) => (
                      <TableRow key={ws.id} className="cursor-pointer" onClick={() => navigate(`/workspaces/${ws.id}`)}>
                        <Td>
                          <Link
                            to={`/workspaces/${ws.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block font-medium text-ink hover:text-primary"
                          >
                            {ws.name}
                          </Link>
                          <span className="text-xs text-ink-soft">{ws.slug}</span>
                        </Td>
                        <Td>
                          <span className="block">{ws.meta.ownerName}</span>
                          <span className="text-xs text-ink-soft">{ws.meta.ownerEmail}</span>
                        </Td>
                        <Td>{ws.plan?.name ?? "—"}</Td>
                        <Td>
                          <WorkspaceStatus ws={ws} />
                        </Td>
                        <Td className="text-ink-soft">{countryName(ws.meta.country)}</Td>
                        <Td className="tabular text-end">{formatNumber(ws.meta.ordersLast30d)}</Td>
                        <Td className="tabular text-end">{formatMoneyCompact(ws.meta.gmvLast30d)}</Td>
                        <Td className="text-ink-soft">{formatDate(ws.createdAt)}</Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            )}
          </>
        )}
      </DataState>
    </div>
  );
}
