import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@store-builder/ui";
import type { Customer } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type Column } from "@/components/DataTable";
import { LoadMore } from "@/components/LoadMore";

export function CustomersPage() {
  const workspaceId = useWorkspaceId();
  const [blacklistedOnly, setBlacklistedOnly] = useState(false);

  const list = useCursorList<Customer>(
    (cursor) =>
      apiClient
        .listCustomers(workspaceId, {
          cursor,
          limit: 50,
          blacklistedOnly: blacklistedOnly || undefined,
        })
        .then((r) => ({ items: r.customers, nextCursor: r.nextCursor })),
    [workspaceId, blacklistedOnly]
  );

  const columns: ReadonlyArray<Column<Customer>> = [
    {
      key: "name",
      header: "Name",
      cell: (customer) => (
        <Link
          to={`/customers/${customer.id}`}
          className="font-medium text-ink hover:text-primary"
        >
          {customer.fullName || "—"}
        </Link>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      className: "text-ink-soft",
      cell: (customer) => customer.phoneRaw || customer.phoneNormalized,
    },
    {
      key: "orders",
      header: "Orders",
      className: "text-ink-soft",
      cell: (customer) => customer.totalOrders,
    },
    {
      key: "rejected",
      header: "Rejected",
      className: "text-ink-soft",
      cell: (customer) => customer.totalRejectedOrders,
    },
    {
      key: "reliability",
      header: "Reliability",
      className: "text-ink-soft",
      cell: (customer) => customer.reliabilityScore,
    },
    {
      key: "blacklisted",
      header: "Blacklisted",
      cell: (customer) =>
        customer.isBlacklisted ? (
          <StatusBadge value="blacklisted" tone="danger" />
        ) : (
          <span className="text-ink-soft">—</span>
        ),
    },
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Customers"
        description="Everyone who has ordered, keyed on their phone number."
      />

      <label className="mb-4 flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={blacklistedOnly}
          onChange={(e) => setBlacklistedOnly(e.target.checked)}
        />
        Blacklisted only
      </label>

      <DataState
        loading={list.loading}
        error={list.items.length ? null : list.error}
        empty={list.items.length === 0}
        emptyMessage={
          blacklistedOnly ? "No blacklisted customers." : "No customers yet."
        }
        onRetry={list.reload}
      >
        <Card className="gap-0 p-0">
          <DataTable
            columns={columns}
            rows={list.items}
            rowKey={(customer) => customer.id}
            minWidth="47.5rem"
          />
        </Card>
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>
    </div>
  );
}
