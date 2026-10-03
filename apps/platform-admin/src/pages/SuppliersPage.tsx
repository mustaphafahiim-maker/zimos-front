import { adminSuppliers } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Mono, Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { useAsync } from "@/lib/useAsync";
import { apiClient } from "@/lib/apiClient";
import { formatNumber } from "@/lib/format";

/**
 * Dropshipping suppliers: the provider adapters this server runs and how many
 * stores use each, and the ones planned. A supplier appears as available once
 * its adapter is added to the backend (modules/dropship/providers).
 */
export function SuppliersPage() {
  const { data, loading, error, refresh } = useAsync(() => adminSuppliers(apiClient), []);

  return (
    <div>
      <PageHeader title="Suppliers" description="Dropshipping providers merchants can connect." />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data && (
          <div className="space-y-6">
            <Panel title="Available" flush>
              {data.providers.length === 0 ? (
                <div className="p-4">
                  <EmptyBlock message="No supplier adapter is registered on this server." />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {data.providers.map((provider) => (
                    <li key={provider.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                          {provider.name}
                          <Mono>{provider.code}</Mono>
                          {provider.isTest && <StatusBadge tone="warning">Test</StatusBadge>}
                        </p>
                      </div>
                      <span className="text-sm text-ink-soft">
                        {formatNumber(provider.stores)} store(s) connected · {formatNumber(provider.orders)} order(s) forwarded
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Planned" description="Shown to merchants as coming soon until their adapter is built.">
              <ul className="flex flex-wrap gap-2">
                {data.planned.map((provider) => (
                  <li key={provider.code} className="rounded-full border border-line px-3 py-1 text-sm text-ink-soft">
                    {provider.name}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        )}
      </DataState>
    </div>
  );
}
