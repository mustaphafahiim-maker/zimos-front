import { adminNetworkStats, type AdminNetworkStats } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { Panel } from "@/components/Panel";
import { useAsync } from "@/lib/useAsync";
import { apiClient } from "@/lib/apiClient";
import { formatBp, formatNumber } from "@/lib/format";

/**
 * The delivery network in aggregate: how customers seen across stores behave
 * on delivery. Totals only — the data is keyed by a hash of the phone number
 * and no single customer is listed here.
 */

const BAND_LABEL: Record<AdminNetworkStats["bands"][number]["band"], { label: string; hint: string; bar: string }> = {
  good: { label: "Reliable", hint: "80% or more of their orders delivered", bar: "bg-success" },
  mixed: { label: "Mixed", hint: "50–79% delivered", bar: "bg-accent" },
  poor: { label: "Unreliable", hint: "Under 50% delivered", bar: "bg-danger" },
  no_history: { label: "No finished order yet", hint: "Nothing delivered or returned so far", bar: "bg-line-strong" },
};

export function NetworkStatsPage() {
  const { data, loading, error, refresh } = useAsync(() => adminNetworkStats(apiClient), []);
  const total = data ? data.bands.reduce((sum, band) => sum + band.customers, 0) : 0;

  return (
    <div>
      <PageHeader title="Delivery network" description="How customers seen across stores behave on delivery. Aggregates only." />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data &&
          (data.totals.customers === 0 ? (
            <EmptyBlock message="No customer has been recorded in the network yet." />
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Customers tracked" value={formatNumber(data.totals.customers)} hint={`${formatNumber(data.totals.seenInSeveralStores)} seen in more than one store`} />
                <KpiCard label="Orders" value={formatNumber(data.totals.orders)} />
                <KpiCard label="Delivery rate" value={data.deliveryRateBp === null ? "—" : formatBp(data.deliveryRateBp)} hint="Delivered out of delivered + returned" />
                <KpiCard label="Returned to sender" value={formatNumber(data.totals.returned)} />
                <KpiCard label="Delivered" value={formatNumber(data.totals.delivered)} />
                <KpiCard label="Rejected at confirmation" value={formatNumber(data.totals.rejected)} />
                <KpiCard label="Cancelled after confirming" value={formatNumber(data.totals.cancelledAfterConfirm)} />
                <KpiCard label="Spam reports" value={formatNumber(data.totals.spamReports)} />
              </div>
              <Panel title="Customers by reliability">
                <ul className="space-y-3">
                  {data.bands.map((band) => {
                    const meta = BAND_LABEL[band.band];
                    const share = total > 0 ? Math.round((band.customers / total) * 100) : 0;
                    return (
                      <li key={band.band}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                          <span className="font-medium text-ink">
                            {meta.label} <span className="font-normal text-ink-soft">· {meta.hint}</span>
                          </span>
                          <span className="tabular-nums text-ink-soft">
                            {formatNumber(band.customers)} · {share}%
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
                          <div className={`h-full ${meta.bar}`} style={{ width: `${share}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            </div>
          ))}
      </DataState>
    </div>
  );
}
