import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow, useAsync } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Panel, SortHead, Td, Th, compareValues, type SortState } from "@/components/Panel";
import { FilterChips, NativeSelect, SearchInput } from "@/components/forms";
import { Status, useStatusLabel } from "@/components/StatusBadge";
import { adminApi, type AdminWorkspaceRow } from "@/lib/adminApi";
import { formatDate, formatNumber } from "@/lib/format";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Workspaces",
    description: "{n} workspaces on the platform.",
    search: "Search by name or id…",
    allPlans: "All plans",
    plan: "Plan",
    name: "Workspace",
    subscription: "Subscription",
    trialEnds: "Trial ends",
    periodEnd: "Period ends",
    orders: "Orders",
    empty: "No workspaces yet.",
    noMatch: "No workspaces match these filters.",
  },
  ar: {
    title: "مساحات العمل",
    description: "{n} مساحة عمل على المنصة.",
    search: "دوّر بالاسم أو الـ id…",
    allPlans: "كل الباقات",
    plan: "الباقة",
    name: "مساحة العمل",
    subscription: "الاشتراك",
    trialEnds: "نهاية التجربة",
    periodEnd: "نهاية الفترة",
    orders: "الطلبات",
    empty: "مفيش مساحات عمل لسه.",
    noMatch: "مفيش مساحات عمل بالفلاتر دي.",
  },
};

type SortKey = "workspaceName" | "plan" | "status" | "currentPeriodEnd" | "orderCount";

export function WorkspacesPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const statusLabel = useStatusLabel();
  const { data, loading, error, refresh } = useAsync(() => adminApi.listWorkspaces(), []);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "orderCount", dir: "desc" });

  const rows = data ?? [];
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))], [rows]);
  const plans = useMemo(() => [...new Set(rows.map((r) => r.plan).filter(Boolean))], [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (status === "all" || r.status === status) && (!plan || r.plan === plan) && (!needle || `${r.workspaceName} ${r.workspaceId}`.toLowerCase().includes(needle)))
      .sort((a: AdminWorkspaceRow, b: AdminWorkspaceRow) => compareValues(a[sort.key] ?? "", b[sort.key] ?? "", sort.dir));
  }, [rows, q, status, plan, sort]);

  return (
    <div>
      <PageHeader
        title={t.title}
        description={data ? fmt(t.description, { n: formatNumber(rows.length) }) : undefined}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> {c.refresh}
          </Button>
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()} empty={!!data && rows.length === 0} emptyMessage={t.empty}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips
            value={status}
            onChange={setStatus}
            options={[{ value: "all", label: c.all, count: rows.length }, ...statuses.map((s) => ({ value: s, label: statusLabel(s), count: rows.filter((r) => r.status === s).length }))]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <NativeSelect value={plan} onChange={(e) => setPlan(e.target.value)} aria-label={t.plan} className="sm:w-44">
              <option value="">{t.allPlans}</option>
              {plans.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </NativeSelect>
            <SearchInput value={q} onChange={setQ} placeholder={t.search} />
          </div>
        </div>
        <Panel flush>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortHead label={t.name} sortKey="workspaceName" sort={sort} onSort={setSort} />
                  <SortHead label={t.plan} sortKey="plan" sort={sort} onSort={setSort} />
                  <SortHead label={t.subscription} sortKey="status" sort={sort} onSort={setSort} />
                  <Th>{t.trialEnds}</Th>
                  <SortHead label={t.periodEnd} sortKey="currentPeriodEnd" sort={sort} onSort={setSort} />
                  <SortHead label={t.orders} sortKey="orderCount" sort={sort} onSort={setSort} className="text-end" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <Td colSpan={6} className="py-10 text-center text-ink-soft">
                      {t.noMatch}
                    </Td>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.workspaceId}>
                      <Td>
                        <Link to={`/workspaces/${r.workspaceId}`} className="font-medium text-ink hover:text-primary">
                          {r.workspaceName}
                        </Link>
                        <span className="block font-mono text-xs text-ink-muted" dir="ltr">
                          {r.workspaceId.slice(0, 8)}
                        </span>
                      </Td>
                      <Td>{r.plan || "—"}</Td>
                      <Td>
                        <Status value={r.status} />
                      </Td>
                      <Td className="text-ink-soft">{formatDate(r.trialEndsAt)}</Td>
                      <Td className="text-ink-soft">{formatDate(r.currentPeriodEnd)}</Td>
                      <Td className="tabular text-end">{formatNumber(r.orderCount)}</Td>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </DataState>
    </div>
  );
}
