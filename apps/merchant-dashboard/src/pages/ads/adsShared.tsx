/**
 * Small presentational pieces shared by the ads pages and the analytics
 * "Campaigns" tab. Metric maths lives in @/lib/adMetrics.
 */
import { Link } from "react-router-dom";
import { cn } from "@store-builder/ui";
import type { Campaign, ProductEconomics } from "@/mock/types2";
import { formatMoney } from "@/lib/format";
import { computeBreakEven, computeMetrics, fmtPct, fmtX, PLATFORM_CLASS, PLATFORM_LABEL, VERDICT_CLASS, VERDICT_LABEL, verdictFor, type Verdict } from "@/lib/adMetrics";

export function PlatformChip({ platform, className }: { platform: Campaign["platform"]; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", PLATFORM_CLASS[platform], className)}>
      {PLATFORM_LABEL[platform]}
    </span>
  );
}

export function VerdictPill({ verdict, className }: { verdict: Verdict | null; className?: string }) {
  if (!verdict) return <span className="text-xs text-ink-soft">—</span>;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", VERDICT_CLASS[verdict], className)}>
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

export function breakEvenCpdFor(campaign: Campaign, economics: ProductEconomics[]): number | null {
  const econ = economics.find((e) => e.productId === campaign.productId);
  return econ ? computeBreakEven(econ).cpd : null;
}

export const thClass = "px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-ink-soft whitespace-nowrap";
export const tdNum = "px-3 py-2.5 text-right tabular-nums whitespace-nowrap";

/** Compact read-only campaigns table for the analytics page. */
export function CompactCampaignsTable({ campaigns, economics, currency }: { campaigns: Campaign[]; economics: ProductEconomics[]; currency: string }) {
  const rows = campaigns
    .map((c) => {
      const m = computeMetrics(c);
      const be = breakEvenCpdFor(c, economics);
      return { c, m, be, verdict: verdictFor(m.cpd, be) };
    })
    .sort((a, b) => b.m.netProfit - a.m.netProfit);
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-line bg-paper-raised">
            <th className={thClass}>Campaign</th>
            <th className={cn(thClass, "text-right")}>Spend</th>
            <th className={cn(thClass, "text-right")}>Orders</th>
            <th className={cn(thClass, "text-right")}>Conf %</th>
            <th className={cn(thClass, "text-right")}>Deliv %</th>
            <th className={cn(thClass, "text-right")}>CPCO</th>
            <th className={cn(thClass, "text-right")}>CPD</th>
            <th className={cn(thClass, "text-right")}>ROAS</th>
            <th className={cn(thClass, "text-right")}>Net profit</th>
            <th className={thClass}>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ c, m, verdict }) => (
            <tr key={c.id} className="border-b border-line last:border-0 hover:bg-paper-raised">
              <td className="px-3 py-2.5">
                <Link to={`/ads/${c.id}`} className="flex items-center gap-2 hover:text-primary">
                  <PlatformChip platform={c.platform} />
                  <span className="truncate text-ink">{c.name}</span>
                </Link>
              </td>
              <td className={cn(tdNum, "text-ink")}>{formatMoney(c.spendAmount, currency)}</td>
              <td className={cn(tdNum, "text-ink-soft")}>{c.orders.toLocaleString()}</td>
              <td className={cn(tdNum, "text-ink-soft")}>{fmtPct(m.confirmationRate)}</td>
              <td className={cn(tdNum, "text-ink-soft")}>{fmtPct(m.deliveryRate)}</td>
              <td className={cn(tdNum, "text-ink-soft")}>{m.cpco === null ? "—" : formatMoney(Math.round(m.cpco), currency)}</td>
              <td className={cn(tdNum, "text-ink")}>{m.cpd === null ? "—" : formatMoney(Math.round(m.cpd), currency)}</td>
              <td className={cn(tdNum, "text-ink-soft")}>{fmtX(m.roas)}</td>
              <td className={cn(tdNum, "font-medium", m.netProfit < 0 ? "text-danger" : "text-success")}>{formatMoney(m.netProfit, currency)}</td>
              <td className="px-3 py-2.5">
                <VerdictPill verdict={verdict} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
