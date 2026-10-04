import { offersStatsGet, type OfferStat, type OfferStats } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney } from "@/lib/format";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    views: "{n} views",
    accepted: "{n} accepted",
    rate: "({rate})",
    revenue: "{amount} added",
    period: "last {days} days",
  },
  ar: {
    views: "{n} مشاهدة",
    accepted: "{n} قبول",
    rate: "({rate})",
    revenue: "{amount} إيراد إضافي",
    period: "آخر {days} يوم",
  },
} satisfies Messages;

/** The offers hub's numbers, once per page (offers/offerStats.js); null while loading or when they fail. */
export function useOfferStats(days = 30): OfferStats | null {
  const workspaceId = useWorkspaceId();
  return useAsync(() => offersStatsGet(apiClient, workspaceId, days).catch(() => null), [workspaceId, days]).data ?? null;
}

/**
 * One offer's line of numbers (SPEC §10.11): views, acceptances (with the
 * rate when it has views) and the revenue it added. Nothing until loaded.
 */
export function OfferNumbers({ stat, days = 30 }: { stat: OfferStat | null | undefined; days?: number }) {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  if (!stat) return null;
  const currency = (currentWorkspace as { defaultCurrency?: string } | null)?.defaultCurrency ?? "EGP";
  const rate = stat.impressions > 0 ? `${((stat.accepted / stat.impressions) * 100).toFixed(1)}%` : null;
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-soft">
      <span>{fmt(t.views, { n: stat.impressions.toLocaleString() })}</span>
      <span>
        {fmt(t.accepted, { n: stat.accepted.toLocaleString() })}
        {rate && <> {fmt(t.rate, { rate })}</>}
      </span>
      {stat.revenue !== null && <span className="font-medium text-ink">{fmt(t.revenue, { amount: formatMoney(stat.revenue, currency) })}</span>}
      <span>· {fmt(t.period, { days })}</span>
    </p>
  );
}
