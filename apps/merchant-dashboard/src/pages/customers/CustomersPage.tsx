import { useState } from "react";
import { Link } from "react-router-dom";
import type { Customer } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { LoadMore } from "@/components/LoadMore";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Customers",
    description: "Everyone who has ordered, keyed on their phone number.",
    blacklistedOnly: "Blacklisted only",
    emptyBlacklisted: "No blacklisted customers.",
    empty: "No customers yet.",
    colName: "Name",
    colPhone: "Phone",
    colOrders: "Orders",
    colRejected: "Rejected",
    colReliability: "Reliability",
    colBlacklisted: "Blacklisted",
    blacklisted: "Blacklisted",
  },
  ar: {
    title: "العملاء",
    description: "كل من طلب من متجرك، مُعرَّفًا برقم هاتفه.",
    blacklistedOnly: "المحظورون فقط",
    emptyBlacklisted: "لا يوجد عملاء محظورون.",
    empty: "لا يوجد عملاء بعد.",
    colName: "الاسم",
    colPhone: "الهاتف",
    colOrders: "الطلبات",
    colRejected: "المرفوضة",
    colReliability: "الموثوقية",
    colBlacklisted: "محظور",
    blacklisted: "محظور",
  },
} satisfies Messages;

export function CustomersPage() {
  const t = useT(STRINGS);
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

  return (
    <div className="max-w-5xl">
      <PageHeader title={t.title} description={t.description} />

      <label className="mb-4 flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="accent-primary"
          checked={blacklistedOnly}
          onChange={(e) => setBlacklistedOnly(e.target.checked)}
        />
        {t.blacklistedOnly}
      </label>

      <DataState
        loading={list.loading}
        error={list.items.length ? null : list.error}
        empty={list.items.length === 0}
        emptyMessage={blacklistedOnly ? t.emptyBlacklisted : t.empty}
        onRetry={list.reload}
      >
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-start text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 text-start font-medium">{t.colName}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colPhone}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colOrders}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colRejected}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colReliability}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colBlacklisted}</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((customer) => (
                <tr key={customer.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-4 py-3">
                    <Link to={`/customers/${customer.id}`} className="font-medium text-ink hover:text-primary" dir="auto">
                      {customer.fullName || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    <bdi dir="ltr">{customer.phoneRaw || customer.phoneNormalized}</bdi>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-soft">{customer.totalOrders}</td>
                  <td className="px-4 py-3 tabular-nums text-ink-soft">{customer.totalRejectedOrders}</td>
                  <td className="px-4 py-3 tabular-nums text-ink-soft">{customer.reliabilityScore}</td>
                  <td className="px-4 py-3">
                    {customer.isBlacklisted ? (
                      <span className="inline-flex items-center rounded-full border border-danger/25 bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                        {t.blacklisted}
                      </span>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>
    </div>
  );
}
