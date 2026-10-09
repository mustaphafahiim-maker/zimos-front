import type { ReactNode } from "react";
import { ReportTakeaway, type ReportTakeawayAction, type ReportTone } from "@/components/report";
import { fmt, useT } from "@/i18n/LocaleContext";
import { countOf } from "@/lib/plural";
import { MIN_FINISHED, outOfTen, type AdsVerdict, type SourcesVerdict } from "./adsData";
import { Figure, Name, fill, type AdsMoney } from "./adsFormat";
import { ADS_STRINGS } from "./adsStrings";

/**
 * The tab's ONE sentence, said from the verdict `judgeCampaigns` reached
 * (the rule, its thresholds and its minimum sample are written there, in
 * adsData.ts). Rates are said as «٤ من كل ١٠ أوردرات»; names and amounts keep
 * their own direction inside the Arabic line.
 */
export function CampaignVerdict({ verdict, money }: { verdict: AdsVerdict; money: AdsMoney["money"] }) {
  const t = useT(ADS_STRINGS);
  const rate = (share: number) => fmt(t.outOfTenOrders, { n: outOfTen(share), ten: 10 });
  const campaigns: ReportTakeawayAction = { label: t.actionCampaigns, to: "/ads" };

  let tone: ReportTone = "info";
  let sentence: ReactNode = t.sayEven;
  let action: ReportTakeawayAction | undefined;

  switch (verdict.kind) {
    case "thin":
      sentence = fmt(t.sayThin, { min: countOf("order", MIN_FINISHED) });
      break;
    case "noOrders":
      tone = "warn";
      sentence = fill(t.sayNoOrders, { spend: <Figure>{money(verdict.spend)}</Figure> });
      action = { label: t.actionBuilder, to: "/marketing" };
      break;
    case "winner": {
      const row = verdict.row;
      const parts: Record<string, ReactNode> = {
        name: <Name>{row.name}</Name>,
        amount: <Figure>{money(row.profit)}</Figure>,
        spend: <Figure>{money(row.spend)}</Figure>,
        sales: <Figure>{money(row.deliveredSales)}</Figure>,
      };
      if (verdict.returns) {
        tone = "warn";
        parts.other = <Name>{verdict.returns.row.name}</Name>;
        parts.rate = rate(verdict.returns.share);
        sentence = fill(verdict.by === "profit" ? t.sayWinnerProfitAndReturns : t.sayWinnerRoasAndReturns, parts);
      } else {
        tone = "good";
        sentence = fill(verdict.by === "profit" ? t.sayWinnerProfit : t.sayWinnerRoas, parts);
      }
      action = campaigns;
      break;
    }
    case "loser": {
      const row = verdict.row;
      tone = "bad";
      sentence = fill(verdict.by === "profit" ? t.sayLoserProfit : t.sayLoserRoas, {
        name: <Name>{row.name}</Name>,
        // A loss is said as the amount lost, without the minus sign.
        amount: <Figure>{money(Math.abs(row.profit ?? 0))}</Figure>,
        spend: <Figure>{money(row.spend)}</Figure>,
        sales: <Figure>{money(row.deliveredSales)}</Figure>,
      });
      action = campaigns;
      break;
    }
    case "returns":
      tone = "warn";
      sentence = fill(t.sayReturnsOnly, { name: <Name>{verdict.row.name}</Name>, rate: rate(verdict.share) });
      action = campaigns;
      break;
    case "even":
      break;
  }

  return (
    <ReportTakeaway tone={tone} action={action}>
      {sentence}
    </ReportTakeaway>
  );
}

/** The sentence for a role that reads the order sources only — from `judgeSources` (adsData.ts). */
export function SourcesTakeaway({ verdict, money }: { verdict: SourcesVerdict; money: AdsMoney["money"] }) {
  const t = useT(ADS_STRINGS);
  const builder: ReportTakeawayAction = { label: t.actionBuilder, to: "/marketing" };

  if (verdict.kind === "untracked") {
    return (
      <ReportTakeaway tone="warn" action={builder}>
        {fmt(t.sayUntracked, { rate: fmt(t.outOfTenOrders, { n: outOfTen(verdict.share), ten: 10 }) })}
      </ReportTakeaway>
    );
  }
  if (verdict.kind === "top") {
    return (
      <ReportTakeaway tone="info">
        {fill(t.sayTopSource, {
          name: <Name>{verdict.name}</Name>,
          amount: <Figure>{money(verdict.deliveredSales)}</Figure>,
          orders: countOf("order", verdict.orders),
        })}
      </ReportTakeaway>
    );
  }
  return <ReportTakeaway tone="info">{t.sayThinSources}</ReportTakeaway>;
}
