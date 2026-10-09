import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { IconPayout, IconSchedule, IconWarning } from "@/components/icons";
import { Button, cn } from "@store-builder/ui";
import { ON_ACCOUNT_LIMITS, onAccountCustomersList, type OnAccountCustomerRow } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatMoney, parseMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DataState, SkeletonBar } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs, type FilterTab } from "@/components/FilterTabs";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { B2B_STRINGS } from "./b2bStrings";

/** The Customers page's tab key for this list (`/customers?tab=on-account`). */
export const ON_ACCOUNT_TAB = "on-account";

/** Whether the page's `?tab=` value is this list. */
export function isOnAccountTab(value: string | null | undefined): value is typeof ON_ACCOUNT_TAB {
  return value === ON_ACCOUNT_TAB;
}

/** The tab for the Customers page's tab row: it sits beside «الكل» rather than in the side menu, as a list opened now and then. */
export function useOnAccountContactTab(): FilterTab<typeof ON_ACCOUNT_TAB> {
  const t = useT(B2B_STRINGS);
  return { value: ON_ACCOUNT_TAB, label: t.balancesTab };
}

type Filter = "all" | "overdue";

/**
 * Customers → «حسابات الآجل» (handoff 229; GET /account-credit,
 * customers.view): every customer approved to pay later, and anyone who still
 * has on-account orders, with what they owe, what is late and the next due
 * date — the most overdue first. «المتأخرين بس» asks the API for the late
 * ones (`?overdue=true`) and lives in the URL (`&overdue=1`), so the list can
 * be linked to. A row opens the customer, where payments are recorded.
 */
export function OnAccountBalancesTab({ onOpenCustomers }: { onOpenCustomers: () => void }) {
  const t = useT(B2B_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter: Filter = searchParams.get("overdue") === "1" ? "overdue" : "all";
  const list = useAsync(() => onAccountCustomersList(apiClient, workspaceId, { overdue: filter === "overdue" }), [workspaceId, filter]);

  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const money = (n: number | string) => formatMoney(n, currency);
  const rows = list.data ?? [];
  const totalOwed = rows.reduce((sum, r) => sum + parseMoney(r.owed), 0);
  const totalOverdue = rows.reduce((sum, r) => sum + parseMoney(r.overdue), 0);
  const now = Date.now();

  function setFilter(next: Filter) {
    const params = new URLSearchParams(searchParams);
    if (next === "overdue") params.set("overdue", "1");
    else params.delete("overdue");
    setSearchParams(params, { replace: true });
  }

  const columns: Column<OnAccountCustomerRow>[] = [
    {
      key: "customer",
      header: t.colCustomer,
      cell: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            {/* A real link, so the row opens from the keyboard too; on a phone it covers the whole card. */}
            <Link to={`/customers/${r.id}`} onClick={(e) => e.stopPropagation()} className="truncate font-medium text-ink hover:text-primary hover:underline">
              <bdi>{r.fullName || r.companyName || t.noName}</bdi>
            </Link>
            {/* Never the colour alone: a late customer carries the word too. */}
            {parseMoney(r.overdue) > 0 && <StatusBadge value="overdue" tone="danger" text={t.overdue} />}
          </span>
          {r.fullName && r.companyName && (
            <span className="truncate text-xs font-normal text-ink-soft">
              <bdi>{r.companyName}</bdi>
            </span>
          )}
        </span>
      ),
    },
    {
      key: "owed",
      header: t.colOwed,
      align: "end",
      cell: (r) => <span className="font-semibold whitespace-nowrap text-ink tabular-nums">{money(r.owed)}</span>,
    },
    {
      key: "overdue",
      header: t.colOverdue,
      align: "end",
      phoneSkip: (r) => parseMoney(r.overdue) <= 0,
      cell: (r) =>
        parseMoney(r.overdue) > 0 ? (
          <span className="font-semibold whitespace-nowrap text-danger tabular-nums">{money(r.overdue)}</span>
        ) : (
          <span className="whitespace-nowrap text-ink-soft tabular-nums">{money(0)}</span>
        ),
    },
    {
      key: "nextDue",
      header: t.colNextDue,
      cell: (r) =>
        r.nextDueAt ? (
          <span className={cn("whitespace-nowrap", new Date(r.nextDueAt).getTime() < now ? "font-medium text-danger" : "text-ink")}>{formatDate(r.nextDueAt)}</span>
        ) : (
          "—"
        ),
    },
    {
      key: "limit",
      header: t.colLimit,
      align: "end",
      cell: (r) => <span className="whitespace-nowrap text-ink-soft tabular-nums">{r.creditLimit === null ? t.noLimit : money(r.creditLimit)}</span>,
    },
    {
      key: "terms",
      header: t.colTerms,
      phoneHidden: true,
      cell: (r) => (r.paymentTermsDays === null ? "—" : <span className="whitespace-nowrap text-ink-soft">{countOf("day", r.paymentTermsDays)}</span>),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-soft">{t.balancesHint}</p>
        <FilterTabs
          label={t.filterLabel}
          value={filter}
          onChange={setFilter}
          buttonClassName="min-h-11 md:min-h-0"
          tabs={[
            { value: "all", label: t.filterAll },
            { value: "overdue", label: t.filterOverdue },
          ]}
        />
      </div>

      <DataState
        loading={list.loading}
        error={list.error}
        onRetry={() => void list.refresh()}
        skeleton={
          <div className="space-y-4">
            <div className="grid gap-[var(--bento-gap)] sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-24 rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
                  <SkeletonBar className="h-2.5 w-1/2" />
                  <SkeletonBar className="mt-5 h-6 w-2/3" />
                </div>
              ))}
            </div>
            <DataState loading error={null} skeleton="table">
              {null}
            </DataState>
          </div>
        }
      >
        {rows.length === 0 ? (
          filter === "overdue" ? (
            <EmptyState
              icon={<IconSchedule aria-hidden />}
              title={t.emptyOverdueTitle}
              description={t.emptyOverdueHint}
              action={
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setFilter("all")}>
                  {t.showAll}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<IconPayout aria-hidden />}
              title={t.emptyTitle}
              description={t.emptyHint}
              action={
                <Button type="button" variant="outline" className="min-h-11" onClick={onOpenCustomers}>
                  {t.emptyAction}
                </Button>
              }
            />
          )
        ) : (
          <div className="space-y-4">
            <div className="grid gap-[var(--bento-gap)] sm:grid-cols-2">
              <KpiCard label={t.totalOwed} value={money(totalOwed)} icon={<IconPayout aria-hidden />} />
              <KpiCard
                label={t.totalOverdue}
                value={<span className={totalOverdue > 0 ? "text-danger" : undefined}>{money(totalOverdue)}</span>}
                icon={<IconWarning aria-hidden />}
              />
            </div>
            <div className="md:overflow-hidden md:rounded-[var(--radius-card)] md:bg-paper-raised md:shadow-[var(--shadow-card)] md:ring-1 md:ring-line">
              <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/customers/${r.id}`)} minWidth="46rem" />
            </div>
            {rows.length >= ON_ACCOUNT_LIMITS.listCap && <p className="text-xs text-ink-soft">{fmt(t.capped, { n: ON_ACCOUNT_LIMITS.listCap })}</p>}
          </div>
        )}
      </DataState>
    </div>
  );
}
