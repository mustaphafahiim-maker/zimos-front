import { useState } from "react";
import { Button } from "@store-builder/ui";
import { RFM_LABELS, rfmCustomers, type RfmCustomer, type RfmLabel, type RfmSort } from "@store-builder/api-client";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { IconPeople } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { Segmented } from "@/components/Segmented";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useCursorList } from "@/lib/useCursorList";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useIsDesktop } from "@/pages/orders/list/useIsDesktop";
import { TABLE_SHEET } from "./crmAccess";
import { useRfmGroupParam } from "./RfmGroupFilter";
import { RFM_STRINGS, RFM_TONE, rfmLabelHelp, rfmLabelName } from "./rfmStrings";

const PAGE_SIZE = 50;

/** R, F and M as three small chips; the letters are the same in every language. */
export function RfmScoreChips({ scores }: { scores: RfmCustomer["scores"] }) {
  const chips: [string, number][] = [
    ["R", scores.r],
    ["F", scores.f],
    ["M", scores.m],
  ];
  return (
    <span dir="ltr" className="inline-flex gap-1">
      {chips.map(([letter, score]) => (
        <span
          key={letter}
          className="zimos-contact-chip inline-flex h-6 items-center rounded-full bg-paper-sunken px-2 text-xs leading-none font-medium text-ink-soft tabular-nums"
        >
          {letter} {fmt("{n}", { n: score })}
        </span>
      ))}
    </span>
  );
}

/**
 * Customers list with «المجموعة» chosen: the customers of one
 * RFM group, from /rfm/customers?label=. It stands in for the contacts table,
 * because a group only lists customers with a delivered order and takes none
 * of the list's other filters.
 *
 * The nine groups are a row of chips (the chosen one filled), the sort a
 * segmented control; «كل المجموعات» goes back to the group cards and «اعرض كل
 * العملاء» to the whole contacts list. A table on a sheet from md up, a card
 * per customer on a phone; a row opens the customer.
 */
export function RfmGroupList({ label }: { label: RfmLabel }) {
  const t = useT(RFM_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const errorMessage = useErrorMessage();
  const navigate = useViewNavigate();
  const desktop = useIsDesktop();
  const [, setGroup] = useRfmGroupParam();
  const [sort, setSort] = useState<RfmSort>("spent");
  const [total, setTotal] = useState<number | null>(null);

  // The API pages by offset: the "cursor" is how many rows are already here.
  const list = useCursorList<RfmCustomer>(
    async (cursor) => {
      const offset = cursor ? Number(cursor) : 0;
      const page = await rfmCustomers(apiClient, workspaceId, { label, sort, limit: PAGE_SIZE, offset });
      setTotal(page.total);
      const loaded = offset + page.customers.length;
      return { items: page.customers, nextCursor: page.customers.length > 0 && loaded < page.total ? String(loaded) : null };
    },
    [workspaceId, label, sort]
  );

  const name = rfmLabelName(t, label);
  const to = (row: RfmCustomer) => `/customers/${row.customerId}`;
  const columns: Column<RfmCustomer>[] = [
    {
      key: "customer",
      header: t.colCustomer,
      cell: (row) => (
        <ViewLink to={to(row)} className="rounded-sm font-medium text-ink hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <bdi>{row.fullName || t.noName}</bdi>
        </ViewLink>
      ),
    },
    { key: "scores", header: t.colScores, cell: (row) => <RfmScoreChips scores={row.scores} /> },
    {
      key: "orders",
      header: t.colOrders,
      align: "end",
      cell: (row) => <span className="tabular-nums">{fmt("{n}", { n: row.orders })}</span>,
    },
    {
      key: "spent",
      header: t.colSpent,
      align: "end",
      cell: (row) => (
        <span className="font-semibold text-ink tabular-nums">
          <bdi>{formatMoney(row.spent, currency)}</bdi>
        </span>
      ),
    },
    {
      key: "lastOrder",
      header: t.colLastOrder,
      cell: (row) => (
        <time dateTime={row.lastOrderAt} title={formatDate(row.lastOrderAt)} className="whitespace-nowrap text-ink-soft">
          {formatRelativeTime(row.lastOrderAt)}
        </time>
      ),
    },
  ];

  const pill = "min-h-11 rounded-full px-4";

  return (
    <div className="flex flex-col gap-3">
      {/* The nine groups: the chosen one filled; another one is one tap away. */}
      <ChipRow<RfmLabel>
        label={t.groupFilter}
        value={label}
        onChange={(next) => setGroup(next)}
        collapseEmpty={false}
        items={RFM_LABELS.map((value) => ({ value, label: rfmLabelName(t, value) }))}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Segmented
          label={t.sortLabel}
          size="sm"
          value={sort}
          onChange={setSort}
          className="max-sm:w-full"
          options={[
            { value: "spent", label: t.sort_spent },
            { value: "recent", label: t.sort_recent },
            { value: "orders", label: t.sort_orders },
          ]}
        />
        <div className="flex flex-wrap gap-2 max-sm:w-full">
          <Button asChild variant="outline" className={`${pill} max-sm:flex-1`}>
            <ViewLink to="/customers?tab=groups">{t.allGroups}</ViewLink>
          </Button>
          <Button type="button" variant="outline" className={`${pill} max-sm:flex-1`} onClick={() => setGroup(null)}>
            {t.showEveryone}
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-sm leading-6 text-ink">
          <StatusBadge value={label} tone={RFM_TONE[label]} text={name} />
          {total !== null && <span className="font-semibold tabular-nums">{pluralOf(t, "customers", total)}</span>}
          <span className="text-ink-soft">{rfmLabelHelp(t, label)}</span>
        </p>
        <p className="max-w-3xl text-xs leading-5 text-ink-soft">{t.listHint}</p>
      </div>

      <DataState loading={list.loading} error={list.items.length === 0 ? list.error : null} onRetry={list.reload} skeleton={<ListSkeleton rows={6} />}>
        {list.items.length === 0 ? (
          <EmptyState icon={<IconPeople aria-hidden />} title={t.listEmpty} description={rfmLabelHelp(t, label)} />
        ) : (
          <>
            {desktop ? (
              <div className={TABLE_SHEET}>
                <DataTable columns={columns} rows={list.items} rowKey={(row) => row.customerId} minWidth="44rem" />
              </div>
            ) : (
              <ul aria-label={name} className="flex flex-col gap-2.5">
                {list.items.map((row) => (
                  <li key={row.customerId}>
                    <ListRowCard
                      title={<bdi>{row.fullName || t.noName}</bdi>}
                      amount={<bdi>{formatMoney(row.spent, currency)}</bdi>}
                      status={<RfmScoreChips scores={row.scores} />}
                      meta={
                        <time dateTime={row.lastOrderAt} title={formatDate(row.lastOrderAt)}>
                          {formatRelativeTime(row.lastOrderAt)}
                        </time>
                      }
                      footer={
                        <span className="text-xs leading-5 text-ink-soft">
                          {t.colOrders}: <span className="font-medium text-ink tabular-nums">{fmt("{n}", { n: row.orders })}</span>
                        </span>
                      }
                      onOpen={() => navigate(to(row))}
                    />
                  </li>
                ))}
              </ul>
            )}
            <p className="max-w-3xl text-xs leading-5 text-ink-soft">{t.scoresLegend}</p>
            {list.error ? (
              <p role="alert" className="text-sm text-danger">
                {errorMessage(list.error)}
              </p>
            ) : null}
            <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
          </>
        )}
      </DataState>
    </div>
  );
}
