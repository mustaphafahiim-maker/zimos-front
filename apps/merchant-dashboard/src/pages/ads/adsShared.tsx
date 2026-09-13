/**
 * Small presentational pieces shared by the ads pages and the analytics
 * "Campaigns" tab. Metric maths lives in @/lib/adMetrics.
 */
import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@store-builder/ui";
import type { AdAccount, AdCreative, Campaign, ProductEconomics } from "@/mock/types2";
import { formatMoney } from "@/lib/format";
import { computeBreakEven, computeMetrics, fmtPct, fmtX, PLATFORM_CLASS, platformLabel, VERDICT_CLASS, verdictLabel, verdictFor, type Verdict } from "@/lib/adMetrics";
import { useLocale, useT } from "@/i18n/LocaleContext";
import { ADS_COMMON } from "./ads.strings";

/** Numbers, money, percentages and multipliers always read left-to-right. */
export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("tabular-nums", className)}>
      {children}
    </bdi>
  );
}

/** Like `fmt`, but placeholders can be React nodes (links, pills). */
export function fmtNodes(template: string, values: Record<string, ReactNode>): ReactNode {
  const parts = template.split(/(\{\w+\})/g);
  return parts.map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return <Fragment key={i}>{m && m[1] in values ? values[m[1]] : part}</Fragment>;
  });
}

/** Locale-aware labels for ads enums (campaign / account status, creative format, objective). */
export function useAdsLabels() {
  const t = useT(ADS_COMMON);
  const campaignStatus: Record<Campaign["status"], string> = { active: t.statusActive, paused: t.statusPaused, ended: t.statusEnded };
  const accountStatus: Record<AdAccount["status"], string> = { connected: t.accConnected, token_expired: t.accTokenExpired, disconnected: t.accDisconnected };
  const creativeFormat: Record<AdCreative["format"], string> = { video: t.fmtVideo, image: t.fmtImage, carousel: t.fmtCarousel };
  const objective: Record<Campaign["objective"], string> = { conversions: t.objConversions, traffic: t.objTraffic, leads: t.objLeads };
  return { t, campaignStatus, accountStatus, creativeFormat, objective };
}

export function PlatformChip({ platform, className }: { platform: Campaign["platform"]; className?: string }) {
  const { locale } = useLocale();
  return (
    <span dir="ltr" className={cn("inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", PLATFORM_CLASS[platform], className)}>
      {platformLabel(platform, locale)}
    </span>
  );
}

export function VerdictPill({ verdict, className }: { verdict: Verdict | null; className?: string }) {
  const { locale } = useLocale();
  const t = useT(ADS_COMMON);
  if (!verdict) {
    return (
      <span className="text-xs text-ink-soft" title={t.noVerdict} aria-label={t.noVerdict}>
        —
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold", VERDICT_CLASS[verdict], className)}>
      {verdictLabel(verdict, locale)}
    </span>
  );
}

export function breakEvenCpdFor(campaign: Campaign, economics: ProductEconomics[]): number | null {
  const econ = economics.find((e) => e.productId === campaign.productId);
  return econ ? computeBreakEven(econ).cpd : null;
}

export const thClass = "px-3 py-2.5 text-start text-[11px] font-medium uppercase tracking-wide text-ink-soft whitespace-nowrap";
export const tdNum = "px-3 py-2.5 text-end tabular-nums whitespace-nowrap";

/** Compact read-only campaigns table for the analytics page. */
export function CompactCampaignsTable({ campaigns, economics, currency }: { campaigns: Campaign[]; economics: ProductEconomics[]; currency: string }) {
  const t = useT(ADS_COMMON);
  const { intlLocale } = useLocale();
  const rows = campaigns
    .map((c) => {
      const m = computeMetrics(c);
      const be = breakEvenCpdFor(c, economics);
      return { c, m, be, verdict: verdictFor(m.cpd, be) };
    })
    .sort((a, b) => b.m.netProfit - a.m.netProfit);
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-line bg-paper">
            <th className={thClass}>{t.campaign}</th>
            <th className={cn(thClass, "text-end")}>{t.spend}</th>
            <th className={cn(thClass, "text-end")}>{t.orders}</th>
            <th className={cn(thClass, "text-end")} title={t.tipConf}>
              {t.confPct}
            </th>
            <th className={cn(thClass, "text-end")} title={t.tipDeliv}>
              {t.delivPct}
            </th>
            <th className={cn(thClass, "text-end")} title={t.tipCpco}>
              {t.cpco}
            </th>
            <th className={cn(thClass, "text-end")} title={t.tipCpd}>
              {t.cpd}
            </th>
            <th className={cn(thClass, "text-end")} title={t.tipRoas}>
              {t.roas}
            </th>
            <th className={cn(thClass, "text-end")}>{t.netProfit}</th>
            <th className={thClass}>{t.verdict}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ c, m, verdict }) => (
            <tr key={c.id} className="border-b border-line last:border-0 hover:bg-paper">
              <td className="px-3 py-2.5">
                <Link to={`/ads/${c.id}`} className="flex items-center gap-2 hover:text-primary">
                  <PlatformChip platform={c.platform} />
                  <span className="truncate text-ink">{c.name}</span>
                </Link>
              </td>
              <td className={cn(tdNum, "text-ink")}>
                <Num>{formatMoney(c.spendAmount, currency)}</Num>
              </td>
              <td className={cn(tdNum, "text-ink-soft")}>
                <Num>{c.orders.toLocaleString(intlLocale)}</Num>
              </td>
              <td className={cn(tdNum, "text-ink-soft")}>
                <Num>{fmtPct(m.confirmationRate)}</Num>
              </td>
              <td className={cn(tdNum, "text-ink-soft")}>
                <Num>{fmtPct(m.deliveryRate)}</Num>
              </td>
              <td className={cn(tdNum, "text-ink-soft")}>
                <Num>{m.cpco === null ? "—" : formatMoney(Math.round(m.cpco), currency)}</Num>
              </td>
              <td className={cn(tdNum, "text-ink")}>
                <Num>{m.cpd === null ? "—" : formatMoney(Math.round(m.cpd), currency)}</Num>
              </td>
              <td className={cn(tdNum, "text-ink-soft")}>
                <Num>{fmtX(m.roas)}</Num>
              </td>
              <td className={cn(tdNum, "font-medium", m.netProfit < 0 ? "text-danger" : "text-success")}>
                <Num>{formatMoney(m.netProfit, currency)}</Num>
              </td>
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
