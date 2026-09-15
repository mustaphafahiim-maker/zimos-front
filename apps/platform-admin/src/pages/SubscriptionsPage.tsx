import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button, Table, TableBody, TableFooter, TableHeader, TableRow, cn } from "@store-builder/ui";
import type { SubscriptionStatus } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { FilterChips, SearchInput } from "@/components/forms";
import { Panel, SortHead, Td, Th, compareValues, type SortState } from "@/components/Panel";
import { Status } from "@/components/StatusBadge";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import type { AdminSubscriptionRow } from "@/lib/adminApi";
import { formatDate, formatMoney, formatRelative } from "@/lib/format";

type Filter = "all" | SubscriptionStatus;
type SortKey = "name" | "mrr" | "next";

const FILTERS: Array<[Filter, string]> = [
  ["all", "All"],
  ["trialing", "Trialing"],
  ["active", "Active"],
  ["past_due", "Past due"],
  ["canceled", "Canceled"],
];

/** Trials count down to their end date; everything else to the period end. */
function nextDate(s: AdminSubscriptionRow): string {
  return (s.status === "trialing" ? s.trialEndsAt : s.currentPeriodEnd) ?? "";
}

export function SubscriptionsPage() {
  const { data, loading, error, refresh } = useAsync(() => adminApi.listSubscriptions(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "mrr", dir: "desc" });

  const rows = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((s) => filter === "all" || s.status === filter)
      .filter(
        (s) =>
          !q ||
          (s.workspaceName ?? "").toLowerCase().includes(q) ||
          (s.workspaceSlug ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (sort.key === "name")
          return compareValues(a.workspaceName ?? "", b.workspaceName ?? "", sort.dir);
        // Undated rows sort last in ascending order.
        if (sort.key === "next")
          return compareValues(nextDate(a) || "9999", nextDate(b) || "9999", sort.dir);
        return compareValues(a.mrr, b.mrr, sort.dir);
      });
  }, [rows, filter, query, sort]);

  const options = FILTERS.map(([value, label]) => ({
    value,
    label,
    count: value === "all" ? rows.length : rows.filter((s) => s.status === value).length,
  }));

  const totalMrr = filtered.reduce((sum, s) => sum + s.mrr, 0);
  // Plans can be priced in different currencies; a single total is only
  // meaningful when every row shares one.
  const currencies = new Set(filtered.map((s) => s.currency));
  const totalCurrency = currencies.size === 1 ? [...currencies][0] : null;

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Billing state for every workspace."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips options={options} value={filter} onChange={setFilter} />
          <SearchInput value={query} onChange={setQuery} placeholder="Search workspace name or address" />
        </div>
        {filtered.length === 0 ? (
          <EmptyBlock
            message={
              rows.length === 0
                ? "No workspace has a subscription yet."
                : "No subscriptions match these filters."
            }
          />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortHead label="Workspace" sortKey="name" sort={sort} onSort={setSort} />
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <SortHead label="MRR" sortKey="mrr" sort={sort} onSort={setSort} className="text-end" />
                  <SortHead label="Next billing / trial end" sortKey="next" sort={sort} onSort={setSort} />
                  <Th>Billing</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const next = nextDate(s);
                  return (
                    <TableRow key={s.id}>
                      <Td>
                        <Link
                          to={`/workspaces/${s.workspaceId}`}
                          className="block font-medium text-ink hover:text-primary"
                        >
                          {s.workspaceName ?? "Unnamed workspace"}
                        </Link>
                        {s.workspaceSlug && (
                          <span className="text-xs text-ink-soft">{s.workspaceSlug}</span>
                        )}
                      </Td>
                      <Td>
                        {s.planName ?? "—"}
                        <span className="block text-xs text-ink-soft capitalize">{s.billingCycle}</span>
                      </Td>
                      <Td>
                        <Status value={s.status} />
                        {s.cancelAtPeriodEnd && (
                          <span className="mt-1 block text-xs text-ink-soft">Cancels at period end</span>
                        )}
                      </Td>
                      <Td className="tabular text-end">{formatMoney(s.mrr, s.currency)}</Td>
                      <Td>
                        {next ? (
                          <>
                            {formatDate(next)}
                            <span
                              className={cn(
                                "block text-xs",
                                new Date(next).getTime() < Date.now() ? "text-danger" : "text-ink-soft"
                              )}
                            >
                              {s.status === "trialing" ? "Trial ends " : ""}
                              {formatRelative(next)}
                            </span>
                          </>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </Td>
                      <Td className="text-ink-soft capitalize">{s.externalProvider ?? "—"}</Td>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <Td className="font-medium" colSpan={3}>
                    Total ({filtered.length})
                  </Td>
                  <Td className="tabular text-end font-semibold">
                    {totalCurrency ? formatMoney(totalMrr, totalCurrency) : "—"}
                  </Td>
                  <Td colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </Panel>
        )}
      </DataState>
      <p className="mt-4 text-xs text-ink-soft">
        Read-only. Changing a plan, extending a trial or cancelling needs billing mutation endpoints
        that don't exist yet.
      </p>
    </div>
  );
}
