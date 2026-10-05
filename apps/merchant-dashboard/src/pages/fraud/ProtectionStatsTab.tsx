import { useState } from "react";
import { Card } from "@store-builder/ui";
import { protectionStats, type ProtectionStats } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMinorMoney } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { FilterTabs } from "@/components/FilterTabs";
import { KpiCard } from "@/components/KpiCard";
import { useOrderLabels } from "@/pages/orders/orderLabels";

const PERIODS = ["7", "30", "90"] as const;
type Period = (typeof PERIODS)[number];

const STRINGS = {
  en: {
    periodLabel: "Period",
    days: "Last {n} days",
    prevented: "Orders prevented",
    preventedHint: "Refused at checkout by a rule, the blocklist or bot protection",
    blockedCancelled: "Blocked and cancelled",
    blockedCancelledHint: "Orders you blocked from the suspicious list",
    saved: "Estimated money saved",
    savedHint: "{count} orders × a round trip at your average shipping fee ({fee})",
    savedNoFee: "Needs orders with a shipping fee to estimate",
    flagged: "Orders flagged",
    flaggedHint: "Placed, and marked for review",
    highRisk: "High-risk orders",
    highRiskHint: "Out of {orders} orders in the period",
    entries: "Blocked entries",
    entriesHint: "Phones, IPs, emails, devices and names on your blocklist",
    reasonsTitle: "Why orders were refused",
    reasonsEmpty: "No order was refused in this period.",
    reason_bot_honeypot: "Bot: filled the hidden field",
    reason_bot_token: "Bot: no valid page token",
    reason_bot_too_fast: "Bot: ordered within three seconds",
    reason_bot_captcha: "Bot: failed the challenge",
  },
  ar: {
    periodLabel: "الفترة",
    days: "آخر {n} يوم",
    prevented: "أوردرات تم منعها",
    preventedHint: "رُفضت عند الطلب بقاعدة أو بقائمة الحظر أو بالحماية من البوتات",
    blockedCancelled: "تم حظرها وإلغاؤها",
    blockedCancelledHint: "أوردرات حظرتها من قائمة المشتبه بها",
    saved: "المبلغ التقديري الذي تم توفيره",
    savedHint: "{count} أوردر × شحن ذهاب وعودة بمتوسط مصاريف شحنك ({fee})",
    savedNoFee: "يحتاج أوردرات عليها مصاريف شحن لحساب التقدير",
    flagged: "أوردرات مشتبه بها",
    flaggedHint: "سُجّلت وتم تمييزها للمراجعة",
    highRisk: "أوردرات عالية الخطورة",
    highRiskHint: "من أصل {orders} أوردر في الفترة",
    entries: "المحظورون",
    entriesHint: "أرقام وعناوين IP وإيميلات وأجهزة وأسماء في قائمة الحظر",
    reasonsTitle: "أسباب رفض الأوردرات",
    reasonsEmpty: "لم يُرفض أي أوردر في هذه الفترة.",
    reason_bot_honeypot: "بوت: ملأ الحقل المخفي",
    reason_bot_token: "بوت: بدون رمز صفحة صحيح",
    reason_bot_too_fast: "بوت: طلب خلال ثلاث ثوانٍ",
    reason_bot_captcha: "بوت: فشل في التحدي",
  },
} satisfies Messages;

/** Fraud protection → Statistics: what the protection layer stopped, and what that saved. */
export function ProtectionStatsTab() {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const workspaceId = useWorkspaceId();
  const [period, setPeriod] = useState<Period>("30");
  const stats = useAsync<ProtectionStats>(() => {
    const to = new Date();
    const from = new Date(to.getTime() - Number(period) * 24 * 60 * 60 * 1000);
    return protectionStats(apiClient, workspaceId, { from: from.toISOString(), to: to.toISOString() });
  }, [workspaceId, period]);
  const data = stats.data;

  const reasonLabel = (flag: string) =>
    (t as Record<string, string>)[`reason_${flag}`] ?? labels.riskFlag(flag);
  const reasons = data ? Object.entries(data.preventedByReason).sort((a, b) => b[1] - a[1]) : [];
  const top = reasons.length ? reasons[0][1] : 0;

  return (
    <div className="space-y-4">
      <FilterTabs
        label={t.periodLabel}
        value={period}
        onChange={setPeriod}
        tabs={PERIODS.map((value) => ({ value, label: fmt(t.days, { n: value }) }))}
      />

      <DataState loading={stats.loading} error={stats.error} onRetry={() => void stats.refresh()}>
        {data && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard label={t.prevented} value={String(data.prevented)} hint={t.preventedHint} />
              <KpiCard label={t.blockedCancelled} value={String(data.blockedCancelled)} hint={t.blockedCancelledHint} />
              <KpiCard
                label={t.saved}
                value={formatMinorMoney(data.estimatedSavedAmount, data.currency)}
                hint={
                  Number(data.averageShippingAmount) > 0
                    ? fmt(t.savedHint, {
                        count: data.prevented + data.blockedCancelled,
                        fee: formatMinorMoney(data.averageShippingAmount, data.currency),
                      })
                    : t.savedNoFee
                }
              />
              <KpiCard label={t.flagged} value={String(data.flagged)} hint={t.flaggedHint} />
              <KpiCard label={t.highRisk} value={String(data.highRisk)} hint={fmt(t.highRiskHint, { orders: data.orders })} />
              <KpiCard label={t.entries} value={String(data.blockedEntries)} hint={t.entriesHint} />
            </div>

            <Card className="space-y-3 p-5">
              <h2 className="font-display text-lg font-medium text-ink">{t.reasonsTitle}</h2>
              {reasons.length === 0 ? (
                <p className="text-sm text-ink-soft">{t.reasonsEmpty}</p>
              ) : (
                <ul className="space-y-2">
                  {reasons.map(([flag, count]) => (
                    <li key={flag} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-ink">{reasonLabel(flag)}</span>
                        <span className="font-medium text-ink">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-line">
                        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${top ? Math.round((count / top) * 100) : 0}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </DataState>
    </div>
  );
}
