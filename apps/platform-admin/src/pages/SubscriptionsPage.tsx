import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button, Table, TableBody, TableFooter, TableHeader, TableRow, cn } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilterChips, SearchInput } from "@/components/forms";
import { Panel, SortHead, SourceNotice, Td, Th, compareValues, type SortState } from "@/components/Panel";
import { DemoBadge, LOCAL_ONLY_LABEL, Unknown, WorkspaceStatus, planLabel } from "@/components/workspace";
import { useToast } from "@/components/Toast";
import { ExtendTrialModal } from "@/components/SubscriptionDialogs";
import { useAsync } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";
import { adminApi } from "@/mock/adminApi";
import type { AdminWorkspace, SubscriptionStatus, WorkspaceListResult } from "@/mock/types";
import { formatDate, formatMoney, formatRelative } from "@/lib/format";

type Filter = "all" | SubscriptionStatus;
type SortKey = "name" | "mrr" | "next";

function nextDate(ws: AdminWorkspace): string {
  return ws.meta.subscriptionStatus === "trialing" ? ws.meta.trialEndsAt ?? "" : ws.meta.nextBillingAt ?? "";
}

export function SubscriptionsPage() {
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.listWorkspaces(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "mrr", dir: "desc" });
  const [trialFor, setTrialFor] = useState<AdminWorkspace | null>(null);
  const [cancelFor, setCancelFor] = useState<AdminWorkspace | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const rows = useMemo(() => data?.rows ?? [], [data]);

  const replace = (ws: AdminWorkspace) =>
    setData((prev) => {
      const base: WorkspaceListResult = prev ?? { rows: [], source: "api", apiError: null };
      return { ...base, rows: base.rows.map((r) => (r.id === ws.id ? ws : r)) };
    });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((w) => filter === "all" || w.meta.subscriptionStatus === filter)
      .filter((w) => !q || w.name.toLowerCase().includes(q) || (w.meta.ownerEmail ?? "").toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort.key === "name") return compareValues(a.name, b.name, sort.dir);
        if (sort.key === "next") return compareValues(nextDate(a) || "9999", nextDate(b) || "9999", sort.dir);
        return compareValues(a.mrr, b.mrr, sort.dir);
      });
  }, [rows, filter, query, sort]);

  const options = (
    [
      ["all", "All"],
      ["trialing", "Trialing"],
      ["active", "Active"],
      ["past_due", "Past due"],
      ["canceled", "Canceled"],
    ] as Array<[Filter, string]>
  ).map(([value, label]) => ({
    value,
    label,
    count: value === "all" ? rows.length : rows.filter((w) => w.meta.subscriptionStatus === value).length,
  }));

  const totalMrr = filtered.reduce((s, w) => s + w.mrr, 0);

  async function retry(ws: AdminWorkspace) {
    setRetrying(ws.id);
    try {
      const { ok, workspace } = await adminApi.retryPayment(ws.id);
      replace(workspace);
      if (ok) toast.success(`Payment for ${ws.name} succeeded.`);
      else toast.error(`Payment for ${ws.name} failed again.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRetrying(null);
    }
  }

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
        {data && (
          <>
            <SourceNotice result={data} />
            <p className="mb-3 text-xs text-ink-soft">Retry, extend trial and cancel are {LOCAL_ONLY_LABEL.toLowerCase()}.</p>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <FilterChips options={options} value={filter} onChange={setFilter} />
              <SearchInput value={query} onChange={setQuery} placeholder="Search workspace or owner email" />
            </div>
            {filtered.length === 0 ? (
              <EmptyBlock message={rows.length === 0 ? "No subscriptions yet." : "No subscriptions match these filters."} />
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
                      <Th>Last failure</Th>
                      <Th className="text-end">Actions</Th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((ws) => {
                      const s = ws.meta.subscriptionStatus;
                      const next = nextDate(ws);
                      return (
                        <TableRow key={ws.id}>
                          <Td>
                            <Link to={`/workspaces/${ws.id}?tab=subscription`} className="block font-medium text-ink hover:text-primary">
                              {ws.name}
                            </Link>
                            <span className="flex items-center gap-2 text-xs text-ink-soft">{ws.meta.ownerEmail ?? <Unknown />}{ws.origin === "demo" && <DemoBadge />}</span>
                          </Td>
                          <Td>
                            {planLabel(ws) ?? <Unknown />}
                            <span className="block text-xs text-ink-soft capitalize">{ws.meta.billingCycle ?? <Unknown />}</span>
                          </Td>
                          <Td>
                            <WorkspaceStatus ws={{ ...ws, meta: { ...ws.meta, suspended: false } }} />
                          </Td>
                          <Td className="tabular text-end">{formatMoney(ws.mrr)}</Td>
                          <Td>
                            {next ? (
                              <>
                                {formatDate(next)}
                                <span className={cn("block text-xs", new Date(next).getTime() < Date.now() ? "text-danger" : "text-ink-soft")}>
                                  {s === "trialing" ? "Trial ends " : ""}
                                  {formatRelative(next)}
                                </span>
                              </>
                            ) : (
                              <span className="text-ink-soft">—</span>
                            )}
                          </Td>
                          <Td className="text-ink-soft">
                            {ws.meta.lastPaymentFailedAt ? <span className="text-danger">{formatRelative(ws.meta.lastPaymentFailedAt)}</span> : "—"}
                          </Td>
                          <Td>
                            <div className="flex justify-end gap-1.5">
                              {s === "past_due" && (
                                <Button size="sm" variant="outline" onClick={() => retry(ws)} disabled={retrying === ws.id}>
                                  <RefreshCw className={cn(retrying === ws.id && "animate-spin")} /> Retry
                                </Button>
                              )}
                              {(s === "trialing" || s === "canceled") && (
                                <Button size="sm" variant="outline" onClick={() => setTrialFor(ws)}>
                                  Extend trial
                                </Button>
                              )}
                              {s !== "canceled" && (
                                <Button size="sm" variant="ghost" className="text-danger" onClick={() => setCancelFor(ws)}>
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </Td>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="hover:bg-transparent">
                      <Td className="font-medium" colSpan={3}>
                        Total ({filtered.length})
                      </Td>
                      <Td className="tabular text-end font-semibold">{formatMoney(totalMrr)}</Td>
                      <Td colSpan={3} />
                    </TableRow>
                  </TableFooter>
                </Table>
              </Panel>
            )}
          </>
        )}
      </DataState>

      <ExtendTrialModal ws={trialFor} open={!!trialFor} onClose={() => setTrialFor(null)} onDone={replace} />
      <ConfirmDialog
        open={!!cancelFor}
        title={`Cancel ${cancelFor?.name ?? ""} subscription?`}
        description="Paid features stop at the end of the current period."
        confirmLabel="Cancel subscription"
        destructive
        onCancel={() => setCancelFor(null)}
        onConfirm={async () => {
          if (!cancelFor) return;
          const next = await adminApi.cancelSubscription(cancelFor.id);
          replace(next);
          toast.success("Subscription canceled.");
          setCancelFor(null);
        }}
      />
    </div>
  );
}
