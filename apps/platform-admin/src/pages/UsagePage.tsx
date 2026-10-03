import { useState } from "react";
import { Link } from "react-router-dom";
import { adminUsage } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { NativeSelect } from "@/components/forms";
import { Panel } from "@/components/Panel";
import { useAsync } from "@/lib/useAsync";
import { apiClient } from "@/lib/apiClient";
import { formatNumber } from "@/lib/format";

/** What stores used in a month: orders, messages, AI requests, storage. Counted by the worker. */

function bytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function UsagePage() {
  const [period, setPeriod] = useState<string | undefined>(undefined);
  const { data, loading, error, refresh } = useAsync(() => adminUsage(apiClient, period), [period]);

  return (
    <div>
      <PageHeader
        title="Usage"
        description="What each store used in a month. Recounted every 15 minutes."
        actions={
          data && data.periods.length > 0 ? (
            <NativeSelect aria-label="Month" value={data.period} onChange={(e) => setPeriod(e.target.value)} className="w-auto">
              {(data.periods.includes(data.period) ? data.periods : [data.period, ...data.periods]).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </NativeSelect>
          ) : undefined
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <KpiCard label="Active stores" value={formatNumber(data.totals.stores)} />
              <KpiCard label="Orders" value={formatNumber(data.totals.orders)} />
              <KpiCard label="Messages sent" value={formatNumber(data.totals.messages)} />
              <KpiCard label="AI requests" value={formatNumber(data.totals.aiRequests)} />
              <KpiCard label="Storage" value={bytes(data.totals.storageBytes)} />
            </div>
            <Panel title="Stores" description="Busiest first." flush>
              {data.stores.length === 0 ? (
                <div className="p-4">
                  <EmptyBlock message="No store used anything in this month." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-ink-soft uppercase">
                      <tr className="border-b border-line">
                        <th className="px-4 py-2 text-start font-medium">Store</th>
                        <th className="px-4 py-2 text-end font-medium">Orders</th>
                        <th className="px-4 py-2 text-end font-medium">Messages</th>
                        <th className="px-4 py-2 text-end font-medium">AI requests</th>
                        <th className="px-4 py-2 text-end font-medium">Storage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {data.stores.map((store) => (
                        <tr key={store.workspaceId}>
                          <td className="px-4 py-2">
                            <Link to={`/workspaces/${store.workspaceId}`} className="font-medium text-ink hover:text-primary">
                              {store.name}
                            </Link>
                            <span className="ms-2 text-xs text-ink-soft">{store.slug}</span>
                          </td>
                          <td className="px-4 py-2 text-end tabular-nums">{formatNumber(store.orders)}</td>
                          <td className="px-4 py-2 text-end tabular-nums">{formatNumber(store.messages)}</td>
                          <td className="px-4 py-2 text-end tabular-nums">{formatNumber(store.aiRequests)}</td>
                          <td className="px-4 py-2 text-end tabular-nums">{bytes(store.storageBytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        )}
      </DataState>
    </div>
  );
}
